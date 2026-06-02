import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { serverEnv } from "@/lib/env/server";
import { buildBrandedEmailTemplate } from "@/lib/notifications/email-template";
import { captureRequestError } from "@/lib/observability/sentry";
import { prisma } from "@/lib/prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALERT_EMAIL_TIMEOUT_MS = 8_000;
const MAX_TEXT_LENGTH = 600;
const MAX_ARRAY_ITEMS = 8;
const MAX_DEPTH = 4;
const MAX_EMAIL_SIGNALS = 10;
const WARNING_CONSECUTIVE_THRESHOLD = 2;
const WARNING_REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;
const CRITICAL_REPEAT_WINDOW_MS = 6 * 60 * 60 * 1000;
const INFO_REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

type AlertSeverity = "info" | "warning" | "critical";
type OperationalStatus = "ok" | "attention" | "degraded" | "critical";
type AlertPayload = z.infer<typeof alertPayloadSchema>;

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compactValue(value: unknown) {
  if (typeof value === "string") return sanitizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "-";
  try {
    return sanitizeText(JSON.stringify(sanitizeValue(value)));
  } catch {
    return "[valor indisponivel]";
  }
}

function issueCount(payload: AlertPayload) {
  return (payload.issues?.length ?? 0) + (payload.alerts?.length ?? 0);
}

function resolveSeverity(payload: AlertPayload): AlertSeverity {
  if (payload.severity) {
    return payload.severity;
  }

  const status = `${payload.status ?? ""} ${payload.state ?? ""}`.toLowerCase();
  const hasIssues = issueCount(payload) > 0;

  if (/critical|fatal|down|failed|failure|error|erro|offline|unavailable/.test(status)) {
    return "critical";
  }

  if (/degraded|degradado|warn|warning/.test(status)) {
    return "warning";
  }

  if (hasIssues && /attention|alert|pending|stale|old|atrasado/.test(status)) {
    return "warning";
  }

  if (hasIssues) {
    return "warning";
  }

  return "info";
}

function resolveOperationalStatus(payload: AlertPayload, severity: AlertSeverity): OperationalStatus {
  const status = `${payload.status ?? ""} ${payload.state ?? ""}`.toLowerCase();

  if (severity === "critical") return "critical";
  if (/degraded|degradado|stale|atrasado|old/.test(status)) return "degraded";
  if (severity === "warning") return "degraded";
  if (/attention|alert|pending/.test(status) && issueCount(payload) > 0) return "attention";

  return "ok";
}

function isRecoveryStatus(status: OperationalStatus, severity: AlertSeverity) {
  return status === "ok" && severity === "info";
}

function buildAlertFingerprint(payload: AlertPayload, service: string, alertType: string) {
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
  hadOpenDeliveredIncident: boolean;
}) {
  if (params.recovery) {
    return params.hadOpenDeliveredIncident ? { deliver: true, reason: "recovery" } : { deliver: false, reason: "healthy_without_open_incident" };
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

function addArraySignals(signals: string[], label: string, values: unknown[] | undefined) {
  for (const item of values?.slice(0, 4) ?? []) {
    signals.push(`${label}: ${compactValue(item)}`);
  }
}

function addQueueSignals(signals: string[], queues: Record<string, unknown> | undefined) {
  for (const [name, rawQueue] of Object.entries(queues ?? {})) {
    const queue = asRecord(rawQueue);
    if (!queue) continue;

    const status = typeof queue.status === "string" ? queue.status : null;
    if (status && !/ok|healthy|success/i.test(status)) {
      signals.push(`Fila ${name}: status ${sanitizeText(status)}`);
    }

    for (const metric of ["pending", "processing", "failed", "failedRecent", "staleProcessing", "due", "invalidCandidates", "failedOccurrences"]) {
      const value = numberValue(queue[metric]);
      if (value && value > 0) {
        signals.push(`Fila ${name}: ${metric}=${value}`);
      }
    }
  }
}

function collectOperationalSignals(payload: AlertPayload) {
  const signals: string[] = [];

  addArraySignals(signals, "Issue", payload.issues);
  addArraySignals(signals, "Alerta", payload.alerts);
  addQueueSignals(signals, payload.queues);

  const deadLetters = payload.deadLetters;
  const deadLetterTotal = numberValue(deadLetters?.total);
  if (deadLetterTotal && deadLetterTotal > 0) {
    signals.push(`Dead letters: ${deadLetterTotal}`);
  }

  const backup = payload.backup;
  const backupStatus = typeof backup?.status === "string" ? backup.status : typeof backup?.state === "string" ? backup.state : null;
  if (backupStatus && !/ok|healthy|success/i.test(backupStatus)) {
    signals.push(`Backup: ${sanitizeText(backupStatus)}`);
  }
  if (backup?.configured === false) {
    signals.push("Backup: nao configurado");
  }
  const ageHours = numberValue(backup?.ageHours);
  const maxAgeHours = numberValue(backup?.maxAgeHours);
  if (ageHours !== null && maxAgeHours !== null && ageHours > maxAgeHours) {
    signals.push(`Backup: ${ageHours}h desde o ultimo sucesso; limite ${maxAgeHours}h`);
  }
  if (typeof backup?.lastFailureAt === "string") {
    signals.push(`Backup: ultima falha em ${sanitizeText(backup.lastFailureAt)}`);
  }

  const ticketsOpen = numberValue(payload.tickets?.open);
  if (ticketsOpen && ticketsOpen > 0) {
    signals.push(`Suporte: ${ticketsOpen} ticket(s) aberto(s)`);
  }
  const deliveryFailed = numberValue(payload.delivery?.failed);
  if (deliveryFailed && deliveryFailed > 0) {
    signals.push(`Entrega de suporte: ${deliveryFailed} falha(s)`);
  }
  const deliveryPending = numberValue(payload.delivery?.pending);
  if (deliveryPending && deliveryPending > 5) {
    signals.push(`Entrega de suporte: ${deliveryPending} pendente(s)`);
  }

  const whatsapp = asRecord((payload as { whatsapp?: unknown }).whatsapp);
  if (whatsapp) {
    if (whatsapp.circuitOpen === true) signals.push("WhatsApp: circuito aberto");
    for (const metric of ["pending", "processing", "failedLastHour", "failureCount"]) {
      const value = numberValue(whatsapp[metric]);
      const threshold = metric === "pending" ? 10 : 0;
      if (value !== null && value > threshold) {
        signals.push(`WhatsApp: ${metric}=${value}`);
      }
    }
  }

  return Array.from(new Set(signals)).slice(0, MAX_EMAIL_SIGNALS);
}

function labelSeverity(severity: AlertSeverity) {
  if (severity === "critical") return "Critico";
  if (severity === "warning") return "Atencao";
  return "Informativo";
}

function labelDecision(reason: string) {
  const labels: Record<string, string> = {
    recovery: "Recuperacao confirmada",
    healthy_without_open_incident: "Saudavel, sem incidente entregue aberto",
    info_suppressed: "Informativo suprimido",
    waiting_for_recurrence: "Aguardando recorrencia antes de alertar",
    dedupe_window: "Suprimido por janela anti-repeticao",
    warning: "Alerta enviado",
    critical: "Alerta critico enviado"
  };

  return labels[reason] ?? reason;
}

function buildAlertEmailContent(params: {
  service: string;
  alertType: string;
  status: OperationalStatus;
  severity: AlertSeverity;
  consecutiveCount: number;
  decisionReason: string;
  recovery: boolean;
  signals: string[];
  previousDeliveredAt: Date | null;
  generatedAt: string;
}) {
  const title = params.recovery
    ? `${params.service} voltou ao normal`
    : `${params.service} precisa de atencao operacional`;
  const intro = params.recovery
    ? `O monitor ${params.alertType} recebeu estado saudavel e o incidente operacional foi marcado como resolvido.`
    : `O monitor ${params.alertType} detectou um estado ${params.status}. O Awu Ops aplicou deduplicacao, recorrencia minima e janela de repeticao antes de decidir pelo envio.`;
  const signalText = params.signals.length
    ? params.signals.map((signal) => `- ${signal}`).join("\n")
    : "- Nenhum erro operacional ativo foi informado no payload sanitizado.";
  const note = [
    "Sinais avaliados:",
    signalText,
    "",
    params.recovery
      ? "Autogestao: o estado foi zerado e proximos sinais saudaveis ficarao silenciosos."
      : "Autogestao: novos alertas iguais respeitam a janela anti-repeticao; warnings exigem recorrencia antes de chegar por e-mail."
  ].join("\n");

  const text = [
    title,
    "",
    intro,
    "",
    `Servico: ${params.service}`,
    `Monitor: ${params.alertType}`,
    `Estado: ${params.status}`,
    `Severidade: ${labelSeverity(params.severity)}`,
    `Decisao: ${labelDecision(params.decisionReason)}`,
    `Ocorrencias consecutivas: ${params.consecutiveCount}`,
    `Gerado em: ${params.generatedAt}`,
    params.previousDeliveredAt ? `Ultimo e-mail anterior: ${params.previousDeliveredAt.toISOString()}` : "Ultimo e-mail anterior: nenhum",
    "",
    note
  ].join("\n");

  const html = buildBrandedEmailTemplate({
    preheader: `${params.service} - ${labelSeverity(params.severity)} - ${params.status}`,
    eyebrow: "Awu Ops",
    title,
    intro,
    details: [
      { label: "Servico", value: params.service },
      { label: "Monitor", value: params.alertType },
      { label: "Estado", value: params.status },
      { label: "Severidade", value: labelSeverity(params.severity) },
      { label: "Decisao", value: labelDecision(params.decisionReason) },
      { label: "Ocorrencias", value: String(params.consecutiveCount) },
      { label: "Gerado em", value: params.generatedAt }
    ],
    note,
    footer: "Mensagem automatica do Awu Ops. Dados sensiveis foram filtrados antes do envio.",
    theme: params.recovery ? "report" : params.severity === "critical" ? "security" : "generic"
  });

  return { subject: `[Awu Ops] ${params.recovery ? "Recuperado" : labelSeverity(params.severity)}: ${params.service} - ${params.alertType}`.slice(0, 180), text, html };
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

async function sendAlertEmail(subject: string, text: string, html: string) {
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
          text,
          html,
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
          textContent: text,
          htmlContent: html,
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
    const severity = resolveSeverity(payload);
    const status = resolveOperationalStatus(payload, severity);
    const recovery = isRecoveryStatus(status, severity);
    const fingerprint = buildAlertFingerprint(payload, service, alertType);
    const generatedAt = payload.generatedAt ?? payload.timestamp ?? new Date().toISOString();
    const signals = collectOperationalSignals(payload);

    const previous = await prisma.operationalAlertState.findUnique({
      where: { fingerprint }
    });
    const hadOpenDeliveredIncident = Boolean(previous && !previous.resolvedAt && previous.consecutiveCount > 0 && previous.lastDeliveredAt);
    const consecutiveCount = recovery ? 0 : (previous?.consecutiveCount ?? 0) + 1;

    const decision = shouldDeliver({
      severity,
      consecutiveCount,
      lastDeliveredAt: previous?.lastDeliveredAt ?? null,
      recovery,
      hadOpenDeliveredIncident
    });

    const email = buildAlertEmailContent({
      service,
      alertType,
      status,
      severity,
      consecutiveCount,
      decisionReason: decision.reason,
      recovery,
      signals,
      previousDeliveredAt: previous?.lastDeliveredAt ?? null,
      generatedAt
    });

    const delivery = decision.deliver ? await sendAlertEmail(email.subject, email.text, email.html) : { sent: false, reason: decision.reason };

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
      status,
      consecutiveCount,
      decision: decision.reason,
      signals,
      delivery,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    captureRequestError(error, { request, feature: "ops-alerts", surface: "admin-ops" });
    return NextResponse.json({ message: "Failed to process operational alert" }, { status: 400 });
  }
}
