import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { serverEnv } from "@/lib/env/server";
import { buildGenericNotificationEmail } from "@/lib/notifications/email-template";
import { captureRequestError } from "@/lib/observability/sentry";
import { prisma } from "@/lib/prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALERT_EMAIL_TIMEOUT_MS = 8_000;
const MAX_TEXT_LENGTH = 600;
const MAX_ARRAY_ITEMS = 8;
const MAX_DEPTH = 4;
const WARNING_CONSECUTIVE_THRESHOLD = 2;
const WARNING_REPEAT_WINDOW_MS = 6 * 60 * 60 * 1000;
const CRITICAL_REPEAT_WINDOW_MS = 60 * 60 * 1000;
const INFO_REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

type AlertSeverity = "info" | "warning" | "critical";

const alertPayloadSchema = z
  .object({
    service: z.string().max(80).optional(),
    type: z.string().max(80).optional(),
    title: z.string().max(160).optional(),
    status: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    severity: z.enum(["info", "warning", "critical"]).optional(),
    fingerprint: z.string().max(160).optional(),
    dedupeKey: z.string().max(160).optional(),
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

  const validSecrets = [serverEnv.N8N_ALERT_WEBHOOK_SECRET, serverEnv.AWU_AUTOMATION_SECRET, serverEnv.AUTOMATION_CRON_SECRET].filter(
    (value): value is string => Boolean(value)
  );

  return validSecrets.some((secret) => bearerToken === secret || fallbackToken === secret);
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

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeToken(value: string | undefined, fallback: string) {
  const sanitized = sanitizeText(value ?? fallback).toLowerCase();
  return sanitized || fallback;
}

function resolveSeverity(payload: z.infer<typeof alertPayloadSchema>): AlertSeverity {
  if (payload.severity) {
    return payload.severity;
  }

  const status = `${payload.status ?? ""} ${payload.state ?? ""}`.toLowerCase();

  if (/critical|fatal|down|failed|failure|error|erro|offline|unavailable/.test(status)) {
    return "critical";
  }

  if (/degraded|warn|warning|attention|alert|pending|stale|old|atrasado|degradado/.test(status)) {
    return "warning";
  }

  const issueCount = (payload.issues?.length ?? 0) + (payload.alerts?.length ?? 0);
  if (issueCount > 0) {
    return "warning";
  }

  return "info";
}

function isRecoveryStatus(payload: z.infer<typeof alertPayloadSchema>, severity: AlertSeverity) {
  const status = `${payload.status ?? ""} ${payload.state ?? ""}`.toLowerCase();
  return severity === "info" && /ok|healthy|success|resolved|recovered|normal/.test(status);
}

function buildAlertFingerprint(payload: z.infer<typeof alertPayloadSchema>, service: string, alertType: string) {
  const explicit = payload.fingerprint ?? payload.dedupeKey;
  if (explicit) {
    return `ops:${hashText(sanitizeText(explicit))}`;
  }

  return `ops:${hashText([service, alertType].join("|"))}`;
}

function repeatWindowMs(severity: AlertSeverity) {
  if (severity === "critical") {
    return CRITICAL_REPEAT_WINDOW_MS;
  }
  if (severity === "warning") {
    return WARNING_REPEAT_WINDOW_MS;
  }
  return INFO_REPEAT_WINDOW_MS;
}

function shouldDeliver(params: {
  severity: AlertSeverity;
  consecutiveCount: number;
  lastDeliveredAt: Date | null;
  recovery: boolean;
  hadOpenIncident: boolean;
}) {
  if (params.recovery) {
    return params.hadOpenIncident ? { deliver: true, reason: "recovery" } : { deliver: false, reason: "healthy_without_open_incident" };
  }

  if (params.severity === "info") {
    return { deliver: false, reason: "info_suppressed" };
  }

  if (params.severity === "warning" && params.consecutiveCount < WARNING_CONSECUTIVE_THRESHOLD) {
    return { deliver: false, reason: "waiting_for_recurrence" };
  }

  if (params.lastDeliveredAt) {
    const elapsed = Date.now() - params.lastDeliveredAt.getTime();
    if (elapsed < repeatWindowMs(params.severity)) {
      return { deliver: false, reason: "dedupe_window" };
    }
  }

  return { deliver: true, reason: params.severity };
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
    const sanitizedPayload = sanitizeValue(payload) as Prisma.InputJsonValue;
    const service = normalizeToken(payload.service, "automation-hub");
    const alertType = normalizeToken(payload.type ?? payload.title, "operational-alert");
    const status = normalizeToken(payload.status ?? payload.state, "attention");
    const severity = resolveSeverity(payload);
    const recovery = isRecoveryStatus(payload, severity);
    const fingerprint = buildAlertFingerprint(payload, service, alertType);

    const previous = await prisma.operationalAlertState.findUnique({
      where: { fingerprint }
    });
    const hadOpenIncident = Boolean(previous && !previous.resolvedAt && previous.consecutiveCount > 0);
    const consecutiveCount = recovery ? 0 : (previous?.consecutiveCount ?? 0) + 1;

    const decision = shouldDeliver({
      severity,
      consecutiveCount,
      lastDeliveredAt: previous?.lastDeliveredAt ?? null,
      recovery,
      hadOpenIncident
    });

    const subjectPrefix = recovery ? "Recuperado" : severity === "critical" ? "Critico" : "Atencao";
    const subject = `[Awu Ops] ${subjectPrefix}: ${service} - ${alertType}`.slice(0, 180);
    const message = JSON.stringify(
      {
        service,
        type: alertType,
        status,
        severity,
        consecutiveCount,
        decision: decision.reason,
        payload: sanitizedPayload
      },
      null,
      2
    );

    const delivery = decision.deliver ? await sendAlertEmail(subject, message) : { sent: false, reason: decision.reason };

    await prisma.operationalAlertState.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        service,
        type: alertType,
        severity,
        status,
        consecutiveCount,
        resolvedAt: recovery ? new Date() : null,
        lastDeliveredAt: delivery.sent ? new Date() : null,
        lastPayload: sanitizedPayload
      },
      update: {
        service,
        type: alertType,
        severity,
        status,
        consecutiveCount,
        resolvedAt: recovery ? new Date() : null,
        lastDeliveredAt: delivery.sent ? new Date() : previous?.lastDeliveredAt ?? null,
        lastPayload: sanitizedPayload
      }
    });

    return NextResponse.json({
      ok: true,
      delivered: delivery.sent,
      suppressed: !delivery.sent,
      severity,
      consecutiveCount,
      decision: decision.reason,
      delivery,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    captureRequestError(error, { request, feature: "ops-alerts", surface: "admin-ops" });
    return NextResponse.json({ message: "Failed to process operational alert" }, { status: 400 });
  }
}
