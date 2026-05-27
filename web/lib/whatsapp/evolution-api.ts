import { serverEnv } from "@/lib/env/server";
import { prisma } from "@/lib/prisma/client";
import { peekThrottleState, takeThrottleHit } from "@/lib/security/request-throttle";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";

const EVOLUTION_SEND_TIMEOUT_MS = 10_000;
const UNLINKED_PHONE_REPLY_LIMIT_PER_HOUR = 2;
const DUPLICATE_REPLY_WINDOW_MS = 45_000;
const EVOLUTION_CIRCUIT_KEY = "global";
const EVOLUTION_FAILURE_NAMESPACE = "whatsapp-evolution-delivery-failure";
const EVOLUTION_CIRCUIT_NAMESPACE = "whatsapp-evolution-delivery-circuit";

type SendWhatsAppReplyInput = {
  to: string;
  body: string;
  inboundEventId: string;
  tenantId?: string | null;
  userId?: string | null;
};

function getEvolutionBaseUrl() {
  return serverEnv.EVOLUTION_API_URL?.replace(/\/+$/, "") ?? null;
}

function getReplyDelayMs() {
  const min = serverEnv.WHATSAPP_MIN_REPLY_DELAY_MS;
  const max = serverEnv.WHATSAPP_MAX_REPLY_DELAY_MS;

  if (max <= min) {
    return min;
  }

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Evolution API excedeu o tempo limite de ${timeoutMs}ms ao enviar mensagem.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function isEvolutionCircuitOpen() {
  const circuit = await peekThrottleState({
    key: EVOLUTION_CIRCUIT_KEY,
    limit: 1,
    namespace: EVOLUTION_CIRCUIT_NAMESPACE,
    windowMs: serverEnv.WHATSAPP_DELIVERY_CIRCUIT_OPEN_MS
  });

  return !circuit.allowed;
}

async function recordEvolutionDeliveryFailure() {
  const failureWindow = await takeThrottleHit({
    key: EVOLUTION_CIRCUIT_KEY,
    limit: serverEnv.WHATSAPP_DELIVERY_FAILURE_THRESHOLD,
    namespace: EVOLUTION_FAILURE_NAMESPACE,
    windowMs: serverEnv.WHATSAPP_DELIVERY_FAILURE_WINDOW_MS
  });

  if (failureWindow.allowed && failureWindow.remaining > 0) {
    return;
  }

  await takeThrottleHit({
    key: EVOLUTION_CIRCUIT_KEY,
    limit: 1,
    namespace: EVOLUTION_CIRCUIT_NAMESPACE,
    windowMs: serverEnv.WHATSAPP_DELIVERY_CIRCUIT_OPEN_MS
  });
}

async function clearEvolutionDeliveryFailures() {
  await prisma.$executeRaw`
    DELETE FROM "RequestThrottle"
    WHERE "namespace" = ${EVOLUTION_FAILURE_NAMESPACE}
      AND "key" = ${EVOLUTION_CIRCUIT_KEY}
  `;
}

async function assertReplyAllowed(input: SendWhatsAppReplyInput) {
  if (serverEnv.WHATSAPP_ASSISTANT_ENABLED !== "true") {
    return {
      ok: false,
      status: 503,
      messageId: null,
      skipped: true,
      reason: "WhatsApp assistant disabled."
    };
  }

  if (serverEnv.WHATSAPP_PROVIDER !== "evolution" || serverEnv.WHATSAPP_INBOUND_ONLY !== "true") {
    return {
      ok: false,
      status: 403,
      messageId: null,
      skipped: true,
      reason: "WhatsApp provider must be Evolution in inbound-only mode."
    };
  }

  if (!input.inboundEventId.trim()) {
    return {
      ok: false,
      status: 403,
      messageId: null,
      skipped: true,
      reason: "Outbound WhatsApp replies require an inbound event id."
    };
  }

  const inboundEvent = await prisma.webhookEvent.findUnique({
    where: {
      eventId: input.inboundEventId
    },
    select: {
      provider: true,
      status: true
    }
  });

  if (!inboundEvent || inboundEvent.provider !== "WHATSAPP" || inboundEvent.status !== "PROCESSING") {
    return {
      ok: false,
      status: 403,
      messageId: null,
      skipped: true,
      reason: "Outbound WhatsApp replies require a processing inbound webhook event."
    };
  }

  const normalizedPhone = normalizeWhatsAppPhone(input.to);
  if (!normalizedPhone) {
    return {
      ok: false,
      status: 400,
      messageId: null,
      skipped: true,
      reason: "Invalid WhatsApp destination."
    };
  }

  if (await isEvolutionCircuitOpen()) {
    return {
      ok: false,
      status: 503,
      messageId: null,
      skipped: true,
      reason: "WhatsApp delivery circuit is open after repeated Evolution API failures."
    };
  }

  const sinceMinute = new Date(Date.now() - 60_000);
  const sinceDay = new Date(Date.now() - 24 * 60 * 60_000);
  const duplicateSince = new Date(Date.now() - DUPLICATE_REPLY_WINDOW_MS);
  const [minuteCount, dayCount, inboundReplyCount, duplicateBodyCount] = await Promise.all([
    prisma.whatsAppMessage.count({
      where: {
        phoneNumber: normalizedPhone,
        direction: "outbound",
        createdAt: { gte: sinceMinute },
        status: { in: ["sending", "sent"] }
      }
    }),
    prisma.whatsAppMessage.count({
      where: {
        phoneNumber: normalizedPhone,
        direction: "outbound",
        createdAt: { gte: sinceDay },
        status: { in: ["sending", "sent"] }
      }
    }),
    prisma.whatsAppMessage.count({
      where: {
        idempotencyKey: `outbound:${input.inboundEventId}`,
        direction: "outbound",
        status: { in: ["sending", "sent"] }
      }
    }),
    prisma.whatsAppMessage.count({
      where: {
        phoneNumber: normalizedPhone,
        direction: "outbound",
        body: input.body,
        createdAt: { gte: duplicateSince },
        idempotencyKey: {
          not: `outbound:${input.inboundEventId}`
        },
        status: { in: ["sending", "sent"] }
      }
    })
  ]);

  if (inboundReplyCount > serverEnv.WHATSAPP_MAX_REPLIES_PER_INBOUND) {
    return {
      ok: false,
      status: 429,
      messageId: null,
      skipped: true,
      reason: "WhatsApp inbound reply limit reached for this webhook event."
    };
  }

  if (minuteCount >= serverEnv.WHATSAPP_USER_RATE_LIMIT_PER_MINUTE) {
    return {
      ok: false,
      status: 429,
      messageId: null,
      skipped: true,
      reason: "WhatsApp per-minute reply rate limit reached."
    };
  }

  if (dayCount >= serverEnv.WHATSAPP_USER_RATE_LIMIT_PER_DAY) {
    return {
      ok: false,
      status: 429,
      messageId: null,
      skipped: true,
      reason: "WhatsApp daily reply rate limit reached."
    };
  }

  if (duplicateBodyCount > 0) {
    return {
      ok: false,
      status: 429,
      messageId: null,
      skipped: true,
      reason: "WhatsApp duplicate reply suppressed in short safety window."
    };
  }

  const [persistentMinuteThrottle, persistentDayThrottle, unlinkedPhoneThrottle] = await Promise.all([
    takeThrottleHit({
      key: normalizedPhone,
      limit: serverEnv.WHATSAPP_USER_RATE_LIMIT_PER_MINUTE,
      namespace: "whatsapp-outbound-phone-minute",
      windowMs: 60_000
    }),
    takeThrottleHit({
      key: normalizedPhone,
      limit: serverEnv.WHATSAPP_USER_RATE_LIMIT_PER_DAY,
      namespace: "whatsapp-outbound-phone-day",
      windowMs: 24 * 60 * 60_000
    }),
    input.userId
      ? Promise.resolve({ allowed: true, remaining: UNLINKED_PHONE_REPLY_LIMIT_PER_HOUR, retryAfterMs: 0 })
      : takeThrottleHit({
          key: normalizedPhone,
          limit: UNLINKED_PHONE_REPLY_LIMIT_PER_HOUR,
          namespace: "whatsapp-unlinked-phone-hour",
          windowMs: 60 * 60_000
        })
  ]);

  if (!persistentMinuteThrottle.allowed) {
    return {
      ok: false,
      status: 429,
      messageId: null,
      skipped: true,
      reason: "WhatsApp persistent per-minute reply rate limit reached."
    };
  }

  if (!persistentDayThrottle.allowed) {
    return {
      ok: false,
      status: 429,
      messageId: null,
      skipped: true,
      reason: "WhatsApp persistent daily reply rate limit reached."
    };
  }

  if (!unlinkedPhoneThrottle.allowed) {
    return {
      ok: false,
      status: 429,
      messageId: null,
      skipped: true,
      reason: "WhatsApp unlinked phone reply rate limit reached."
    };
  }

  return null;
}

export async function sendWhatsAppReply(input: SendWhatsAppReplyInput) {
  const blocked = await assertReplyAllowed(input);
  if (blocked) {
    return blocked;
  }

  const baseUrl = getEvolutionBaseUrl();
  const apiKey = serverEnv.EVOLUTION_API_KEY;
  const instance = serverEnv.EVOLUTION_INSTANCE;
  const normalizedPhone = normalizeWhatsAppPhone(input.to);

  if (!baseUrl || !apiKey || !instance || !normalizedPhone) {
    return {
      ok: false,
      status: 503,
      messageId: null,
      skipped: true,
      reason: "Evolution API is not fully configured."
    };
  }

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey
        },
        body: JSON.stringify({
          number: normalizedPhone,
          text: input.body,
          delay: getReplyDelayMs(),
          linkPreview: false
        })
      },
      EVOLUTION_SEND_TIMEOUT_MS
    );

    const payload = (await response.json().catch(() => null)) as
      | {
          key?: {
            id?: string;
          };
        }
      | null;

    if (response.ok) {
      await clearEvolutionDeliveryFailures();
    } else {
      await recordEvolutionDeliveryFailure();
    }

    return {
      ok: response.ok,
      status: response.status,
      messageId: payload?.key?.id ?? null,
      skipped: false,
      reason: response.ok ? null : "Evolution API rejected reply."
    };
  } catch (error) {
    await recordEvolutionDeliveryFailure();
    return {
      ok: false,
      status: 503,
      messageId: null,
      skipped: false,
      reason: error instanceof Error ? error.message : "Evolution API delivery failed."
    };
  }
}
