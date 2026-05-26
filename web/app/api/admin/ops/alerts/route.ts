import { NextResponse } from "next/server";
import { z } from "zod";

import { serverEnv } from "@/lib/env/server";
import { buildGenericNotificationEmail } from "@/lib/notifications/email-template";
import { captureRequestError } from "@/lib/observability/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALERT_EMAIL_TIMEOUT_MS = 8_000;
const MAX_TEXT_LENGTH = 600;
const MAX_ARRAY_ITEMS = 8;
const MAX_DEPTH = 4;

const alertPayloadSchema = z
  .object({
    service: z.string().max(80).optional(),
    type: z.string().max(80).optional(),
    title: z.string().max(160).optional(),
    status: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    alerts: z.array(z.unknown()).optional(),
    issues: z.array(z.unknown()).optional(),
    summary: z.record(z.string(), z.unknown()).optional(),
    backup: z.record(z.string(), z.unknown()).optional(),
    deadLetters: z.record(z.string(), z.unknown()).optional(),
    queues: z.record(z.string(), z.unknown()).optional(),
    tickets: z.record(z.string(), z.unknown()).optional(),
    delivery: z.record(z.string(), z.unknown()).optional(),
    timestamp: z.string().max(80).optional(),
    generatedAt: z.string().max(80).optional()
  })
  .passthrough();

function isAuthorized(request: Request) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;
  const fallbackToken = request.headers.get("x-automation-secret") ?? new URL(request.url).searchParams.get("secret");

  return bearerToken === serverEnv.AUTOMATION_CRON_SECRET || fallbackToken === serverEnv.AUTOMATION_CRON_SECRET;
}

function sanitizeText(value: string) {
  return value
    .replace(/enc:v1:[A-Za-z0-9+/=_:-]+/g, "[dado criptografado indisponivel]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\b(?:\+?55)?\d{10,13}\b/g, "[telefone]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return "[limite de profundidade]";
  }

  if (typeof value === "string") {
    return sanitizeText(value);
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object" && value) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !/token|secret|password|key|authorization|cookie|payload|message|raw/i.test(key))
        .slice(0, 24)
        .map(([key, item]) => [key, sanitizeValue(item, depth + 1)])
    );
  }

  return "[valor nao serializavel]";
}

function resolveEmailSender() {
  if (!serverEnv.EMAIL_FROM) {
    return null;
  }

  return serverEnv.EMAIL_FROM_NAME ? `${serverEnv.EMAIL_FROM_NAME} <${serverEnv.EMAIL_FROM}>` : serverEnv.EMAIL_FROM;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function sendAlertEmail(subject: string, message: string) {
  const target = serverEnv.SUPPORT_EMAIL_TO ?? serverEnv.EMAIL_REPLY_TO;
  const from = resolveEmailSender();

  if (!target || !from) {
    return { sent: false, reason: "alert_email_not_configured" };
  }

  if (serverEnv.EMAIL_PROVIDER === "resend") {
    if (!serverEnv.RESEND_API_KEY) {
      return { sent: false, reason: "resend_not_configured" };
    }

    const response = await fetchWithTimeout(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serverEnv.RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from,
          to: [target],
          subject,
          text: message,
          html: buildGenericNotificationEmail(subject, message),
          ...(serverEnv.EMAIL_REPLY_TO ? { reply_to: serverEnv.EMAIL_REPLY_TO } : {})
        })
      },
      ALERT_EMAIL_TIMEOUT_MS
    );

    return { sent: response.ok, provider: "resend", status: response.status };
  }

  if (serverEnv.EMAIL_PROVIDER === "brevo") {
    if (!serverEnv.BREVO_API_KEY || !serverEnv.EMAIL_FROM) {
      return { sent: false, reason: "brevo_not_configured" };
    }

    const response = await fetchWithTimeout(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": serverEnv.BREVO_API_KEY
        },
        body: JSON.stringify({
          sender: { email: serverEnv.EMAIL_FROM, ...(serverEnv.EMAIL_FROM_NAME ? { name: serverEnv.EMAIL_FROM_NAME } : {}) },
          to: [{ email: target }],
          subject,
          textContent: message,
          htmlContent: buildGenericNotificationEmail(subject, message),
          ...(serverEnv.EMAIL_REPLY_TO ? { replyTo: { email: serverEnv.EMAIL_REPLY_TO } } : {})
        })
      },
      ALERT_EMAIL_TIMEOUT_MS
    );

    return { sent: response.ok, provider: "brevo", status: response.status };
  }

  return { sent: false, reason: "email_provider_does_not_send_directly" };
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = alertPayloadSchema.parse(await request.json());
    const sanitizedPayload = sanitizeValue(payload);
    const service = sanitizeText(payload.service ?? "automation-hub");
    const alertType = sanitizeText(payload.type ?? payload.title ?? "operational-alert");
    const status = sanitizeText(payload.status ?? payload.state ?? "attention");
    const subject = `[Awu Ops] ${service} - ${alertType} - ${status}`.slice(0, 180);
    const message = JSON.stringify(sanitizedPayload, null, 2);
    const delivery = await sendAlertEmail(subject, message);

    return NextResponse.json({
      ok: true,
      delivered: delivery.sent,
      delivery,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    captureRequestError(error, { request, feature: "ops-alerts", surface: "admin-ops" });
    return NextResponse.json({ message: "Failed to process operational alert" }, { status: 400 });
  }
}
