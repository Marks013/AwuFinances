import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { serverEnv } from "@/lib/env/server";
import { getWhatsAppChannelHealth } from "@/lib/notifications/channel-health";
import { prisma } from "@/lib/prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STALE_PROCESSING_MINUTES = 15;
const RECENT_FAILURE_LIMIT = 5;
const EXTERNAL_CHECK_TIMEOUT_MS = 4_000;
const ACTIVE_DEAD_LETTER_HOURS = 24;

type StatusState = "ok" | "degraded" | "error" | "disabled" | "unknown";

function isAuthorized(request: Request) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;
  const fallbackToken = request.headers.get("x-automation-secret");

  const validSecrets = [serverEnv.AWU_AUTOMATION_SECRET, serverEnv.AUTOMATION_CRON_SECRET].filter(
    (value): value is string => Boolean(value)
  );

  return validSecrets.some((secret) => bearerToken === secret || fallbackToken === secret);
}

function sanitizeError(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.replace(/\s+/g, " ").trim().slice(0, 220) || null;
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function buildQueueStatus(
  counts: Record<string, number>,
  _deadLetterKeys: string[],
  failedKeys: string[],
  staleProcessing: number,
  activeDeadLetters = 0
): StatusState {
  if (activeDeadLetters > 0) {
    return "error";
  }

  if (failedKeys.some((key) => (counts[key] ?? 0) > 0) || staleProcessing > 0) {
    return "degraded";
  }

  return "ok";
}

async function countWebhookStatus(provider: string) {
  const rows = await prisma.webhookEvent.groupBy({
    by: ["status"],
    where: { provider },
    _count: { _all: true }
  });

  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}

async function countBillingWebhookStatus() {
  const rows = await prisma.billingWebhookEvent.groupBy({
    by: ["status"],
    _count: { _all: true }
  });

  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}

async function checkDatabase() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok" as const,
      latencyMs: Date.now() - startedAt
    };
  } catch {
    return {
      status: "error" as const,
      latencyMs: Date.now() - startedAt
    };
  }
}

async function fetchJsonWithTimeout(input: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal
    });
    const payload = (await response.json().catch(() => null)) as unknown;

    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}

function extractEvolutionState(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const instance = record.instance;
  const nestedState =
    instance && typeof instance === "object" ? (instance as Record<string, unknown>).state : null;
  const state = record.state ?? record.connectionState ?? nestedState;

  return typeof state === "string" && state.trim() ? state.trim() : null;
}

async function checkEvolutionStatus(externalCheck: boolean) {
  const health = getWhatsAppChannelHealth();
  const baseUrl = serverEnv.EVOLUTION_API_URL?.replace(/\/+$/, "") ?? null;
  const apiKey = serverEnv.EVOLUTION_API_KEY;
  const instance = serverEnv.EVOLUTION_INSTANCE;

  if (!health.configured || !baseUrl || !apiKey || !instance) {
    return {
      status: "disabled" as const,
      configured: false,
      reachable: null,
      state: null,
      issue: health.issue
    };
  }

  if (!externalCheck) {
    return {
      status: "ok" as const,
      configured: true,
      reachable: null,
      state: null,
      issue: null,
      checkSkipped: "external_check_disabled"
    };
  }

  try {
    const { response, payload } = await fetchJsonWithTimeout(
      `${baseUrl}/instance/connectionState/${encodeURIComponent(instance)}`,
      {
        headers: {
          apikey: apiKey
        }
      }
    );
    const state = extractEvolutionState(payload);

    return {
      status: response.ok ? ("ok" as const) : ("degraded" as const),
      configured: true,
      reachable: response.ok,
      state,
      httpStatus: response.status,
      issue: response.ok ? null : "evolution_status_request_failed"
    };
  } catch {
    return {
      status: "degraded" as const,
      configured: true,
      reachable: false,
      state: null,
      issue: "evolution_status_unreachable"
    };
  }
}

async function checkGeminiStatus(externalCheck: boolean) {
  const configured = serverEnv.GEMINI_ENABLED === "true" && Boolean(serverEnv.GEMINI_API_KEY);
  const model = serverEnv.GEMINI_MODEL ?? "gemini-2.5-flash";

  if (!configured) {
    return {
      status: "disabled" as const,
      configured: false,
      enabled: serverEnv.GEMINI_ENABLED === "true",
      model,
      reachable: null,
      issue: "gemini_not_enabled_or_missing_key"
    };
  }

  if (!externalCheck) {
    return {
      status: "ok" as const,
      configured: true,
      enabled: true,
      model,
      reachable: null,
      issue: null,
      checkSkipped: "external_check_disabled"
    };
  }

  try {
    const baseUrl = serverEnv.GEMINI_BASE_URL?.toString().replace(/\/+$/, "") || "https://generativelanguage.googleapis.com";
    const { response } = await fetchJsonWithTimeout(
      `${baseUrl}/v1beta/models/${encodeURIComponent(model)}`,
      {
        headers: {
          "x-goog-api-key": serverEnv.GEMINI_API_KEY ?? ""
        }
      }
    );

    return {
      status: response.ok ? ("ok" as const) : ("degraded" as const),
      configured: true,
      enabled: true,
      model,
      reachable: response.ok,
      httpStatus: response.status,
      issue: response.ok ? null : "gemini_status_request_failed"
    };
  } catch {
    return {
      status: "degraded" as const,
      configured: true,
      enabled: true,
      model,
      reachable: false,
      issue: "gemini_status_unreachable"
    };
  }
}

async function readBackupMarker(filePath: string) {
  try {
    const value = await readFile(filePath, "utf8");

    return value.trim() || null;
  } catch {
    return null;
  }
}

function parseBackupDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function getBackupStatus() {
  const backupSchedule = process.env.BACKUP_CRON_SCHEDULE?.trim() || null;
  const githubEnabled = process.env.BACKUP_GITHUB_ENABLED === "true";
  const objectStorageEnabled = process.env.BACKUP_OBJECT_STORAGE_ENABLED === "true";
  const localRetentionDays = process.env.BACKUP_LOCAL_RETENTION_DAYS
    ? Number(process.env.BACKUP_LOCAL_RETENTION_DAYS)
    : null;
  const lastSuccessValue = await readBackupMarker("/backups/last-success.txt");
  const lastFailureValue = await readBackupMarker("/backups/last-failure.txt");
  const lastSuccessAt = parseBackupDate(lastSuccessValue);
  const failureTimeMatch = lastFailureValue?.match(/(?:^|\n)time=(.+)(?:\n|$)/);
  const lastFailureAt = parseBackupDate(failureTimeMatch?.[1]?.trim() ?? null);
  const hasRecentFailure = lastFailureAt
    ? !lastSuccessAt || lastFailureAt.getTime() > lastSuccessAt.getTime()
    : false;
  const configured = Boolean(backupSchedule);

  return {
    status: !configured ? ("degraded" as const) : hasRecentFailure ? ("degraded" as const) : ("ok" as const),
    configured,
    schedule: backupSchedule,
    runOnStartup: process.env.BACKUP_RUN_ON_STARTUP === "true",
    localRetentionDays: Number.isFinite(localRetentionDays) ? localRetentionDays : null,
    githubEnabled,
    objectStorageEnabled,
    criticalPathsConfigured: Boolean(process.env.BACKUP_CRITICAL_PATHS?.trim()),
    encryptionConfigured: Boolean(process.env.BACKUP_ENCRYPTION_PASSPHRASE?.trim()),
    lastKnownRunAt: lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: hasRecentFailure ? lastFailureAt?.toISOString() ?? null : null,
    note: "Status baseado na configuracao do backup e nos marcadores sanitizados do volume /backups."
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const url = new URL(request.url);
  const externalCheck = url.searchParams.get("external") === "1";
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60_000);
  const activeDeadLetterSince = new Date(Date.now() - ACTIVE_DEAD_LETTER_HOURS * 60 * 60_000);

  const [
    database,
    whatsappCounts,
    billingCounts,
    whatsappDeadLetters,
    billingDeadLetters,
    activeWhatsAppDeadLetters,
    activeBillingDeadLetters,
    staleWhatsAppProcessing,
    staleBillingProcessing,
    lastWhatsAppEvent,
    lastBillingEvent,
    lastSubscriptionTransaction,
    supportOpen,
    supportAnswered,
    supportClosed,
    supportFailedDelivery,
    supportPendingDelivery,
    oldestOpenTicket,
    lastSupportTicket,
    recentWhatsAppFailures,
    recentBillingFailures,
    recentNotificationFailures,
    recentSupportFailures,
    evolution,
    gemini,
    backup
  ] = await Promise.all([
    checkDatabase(),
    countWebhookStatus("WHATSAPP"),
    countBillingWebhookStatus(),
    prisma.webhookEvent.count({ where: { provider: "WHATSAPP", status: "DEAD_LETTER" } }),
    prisma.billingWebhookEvent.count({ where: { status: "dead_letter" } }),
    prisma.webhookEvent.count({
      where: { provider: "WHATSAPP", status: "DEAD_LETTER", updatedAt: { gte: activeDeadLetterSince } }
    }),
    prisma.billingWebhookEvent.count({
      where: { status: "dead_letter", updatedAt: { gte: activeDeadLetterSince } }
    }),
    prisma.webhookEvent.count({
      where: { provider: "WHATSAPP", status: "PROCESSING", updatedAt: { lt: staleBefore } }
    }),
    prisma.billingWebhookEvent.count({
      where: { status: "processing", updatedAt: { lt: staleBefore } }
    }),
    prisma.webhookEvent.findFirst({
      where: { provider: "WHATSAPP" },
      orderBy: { updatedAt: "desc" },
      select: { status: true, updatedAt: true, processedAt: true }
    }),
    prisma.billingWebhookEvent.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { status: true, updatedAt: true, processedAt: true }
    }),
    prisma.transaction.findFirst({
      where: { subscriptionId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    }),
    prisma.supportTicket.count({ where: { status: "open" } }),
    prisma.supportTicket.count({ where: { status: "answered" } }),
    prisma.supportTicket.count({ where: { status: "closed" } }),
    prisma.supportTicket.count({ where: { deliveryStatus: "failed" } }),
    prisma.supportTicket.count({ where: { deliveryStatus: "pending" } }),
    prisma.supportTicket.findFirst({
      where: { status: "open" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true }
    }),
    prisma.supportTicket.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, status: true }
    }),
    prisma.webhookEvent.findMany({
      where: { provider: "WHATSAPP", status: { in: ["FAILED", "DEAD_LETTER"] } },
      orderBy: { updatedAt: "desc" },
      take: RECENT_FAILURE_LIMIT,
      select: { eventId: true, status: true, attempts: true, error: true, updatedAt: true }
    }),
    prisma.billingWebhookEvent.findMany({
      where: { status: { in: ["failed", "dead_letter"] } },
      orderBy: { updatedAt: "desc" },
      take: RECENT_FAILURE_LIMIT,
      select: { dedupeKey: true, status: true, attempts: true, error: true, updatedAt: true }
    }),
    prisma.notificationDelivery.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
      take: RECENT_FAILURE_LIMIT,
      select: { id: true, channel: true, status: true, responseCode: true, errorMessage: true, createdAt: true }
    }),
    prisma.supportTicket.findMany({
      where: { deliveryStatus: "failed" },
      orderBy: { updatedAt: "desc" },
      take: RECENT_FAILURE_LIMIT,
      select: { id: true, ticketNumber: true, deliveryAttempts: true, providerError: true, updatedAt: true }
    }),
    checkEvolutionStatus(externalCheck),
    checkGeminiStatus(externalCheck),
    getBackupStatus()
  ]);

  const whatsappQueueStatus = buildQueueStatus(
    whatsappCounts,
    ["DEAD_LETTER"],
    ["FAILED"],
    staleWhatsAppProcessing,
    activeWhatsAppDeadLetters
  );
  const billingQueueStatus = buildQueueStatus(
    billingCounts,
    ["dead_letter"],
    ["failed"],
    staleBillingProcessing,
    activeBillingDeadLetters
  );
  const deadLettersTotal = whatsappDeadLetters + billingDeadLetters;
  const activeDeadLettersTotal = activeWhatsAppDeadLetters + activeBillingDeadLetters;
  const healthStatus: StatusState =
    database.status === "error" || activeDeadLettersTotal > 0
      ? "error"
      : [whatsappQueueStatus, billingQueueStatus, evolution.status, gemini.status, backup.status].includes("degraded")
        ? "degraded"
        : "ok";

  return NextResponse.json({
    status: healthStatus,
    service: "awufinances-ops",
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    health: {
      database,
      maintenanceMode: process.env.MAINTENANCE_MODE === "true"
    },
    queues: {
      whatsapp: {
        status: whatsappQueueStatus,
        counts: whatsappCounts,
        staleProcessing: staleWhatsAppProcessing,
        lastEvent: {
          status: lastWhatsAppEvent?.status ?? null,
          updatedAt: toIso(lastWhatsAppEvent?.updatedAt),
          processedAt: toIso(lastWhatsAppEvent?.processedAt)
        }
      },
      billing: {
        status: billingQueueStatus,
        counts: billingCounts,
        staleProcessing: staleBillingProcessing,
        lastEvent: {
          status: lastBillingEvent?.status ?? null,
          updatedAt: toIso(lastBillingEvent?.updatedAt),
          processedAt: toIso(lastBillingEvent?.processedAt)
        }
      }
    },
    deadLetters: {
      total: deadLettersTotal,
      whatsapp: whatsappDeadLetters,
      billing: billingDeadLetters,
      active: activeDeadLettersTotal,
      activeWhatsApp: activeWhatsAppDeadLetters,
      activeBilling: activeBillingDeadLetters,
      historical: Math.max(0, deadLettersTotal - activeDeadLettersTotal),
      activeWindowHours: ACTIVE_DEAD_LETTER_HOURS
    },
    backup,
    integrations: {
      evolution,
      gemini
    },
    support: {
      tickets: {
        open: supportOpen,
        answered: supportAnswered,
        closed: supportClosed,
        oldestOpenAt: toIso(oldestOpenTicket?.createdAt),
        lastCreatedAt: toIso(lastSupportTicket?.createdAt),
        lastStatus: lastSupportTicket?.status ?? null
      },
      delivery: {
        pending: supportPendingDelivery,
        failed: supportFailedDelivery
      }
    },
    crons: {
      whatsappWebhook: {
        lastObservedAt: toIso(lastWhatsAppEvent?.updatedAt),
        lastProcessedAt: toIso(lastWhatsAppEvent?.processedAt),
        lastStatus: lastWhatsAppEvent?.status ?? null
      },
      billingWebhook: {
        lastObservedAt: toIso(lastBillingEvent?.updatedAt),
        lastProcessedAt: toIso(lastBillingEvent?.processedAt),
        lastStatus: lastBillingEvent?.status ?? null
      },
      automation: {
        lastSubscriptionTransactionAt: toIso(lastSubscriptionTransaction?.createdAt),
        note: "Execucao de automacao recorrente nao possui tabela de log dedicada; este campo usa o ultimo lancamento de assinatura como sinal indireto."
      }
    },
    recentFailures: {
      whatsapp: recentWhatsAppFailures.map((item) => ({
        eventId: item.eventId,
        status: item.status,
        attempts: item.attempts,
        error: sanitizeError(item.error),
        updatedAt: toIso(item.updatedAt)
      })),
      billing: recentBillingFailures.map((item) => ({
        dedupeKey: item.dedupeKey,
        status: item.status,
        attempts: item.attempts,
        error: sanitizeError(item.error),
        updatedAt: toIso(item.updatedAt)
      })),
      notifications: recentNotificationFailures.map((item) => ({
        id: item.id,
        channel: item.channel,
        status: item.status,
        responseCode: item.responseCode,
        error: sanitizeError(item.errorMessage),
        createdAt: toIso(item.createdAt)
      })),
      support: recentSupportFailures.map((item) => ({
        id: item.id,
        ticketNumber: item.ticketNumber,
        deliveryAttempts: item.deliveryAttempts,
        error: sanitizeError(item.providerError),
        updatedAt: toIso(item.updatedAt)
      }))
    }
  });
}
