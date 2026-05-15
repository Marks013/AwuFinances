import { createHash } from "node:crypto";

import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";

export type EvolutionWebhookPayload = Record<string, unknown>;

export type IncomingEvolutionWebhookMessage = {
  eventId: string;
  phoneNumber: string | null;
  body: string | null;
  type: "text" | "audio" | "image" | "video" | string | null;
  mediaId: string | null;
  mimeType: string | null;
  caption: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stripJid(value: string | null) {
  if (!value) {
    return null;
  }

  return value.split("@")[0]?.replace(/\D/g, "") || null;
}

function getMessageCandidates(payload: EvolutionWebhookPayload) {
  const data = asRecord(payload.data);
  const messages = Array.isArray(data?.messages) ? data.messages : null;

  if (messages) {
    return messages.filter(isRecord);
  }

  if (data) {
    return [data];
  }

  return [payload].filter(isRecord);
}

function isMessagesUpsertEvent(payload: EvolutionWebhookPayload) {
  const event = asString(payload.event)?.toLowerCase().replace(/[._-]/g, "");
  return event === "messagesupsert";
}

function getNestedMessageText(message: Record<string, unknown>) {
  const extendedText = asRecord(message.extendedTextMessage);
  const image = asRecord(message.imageMessage);
  const video = asRecord(message.videoMessage);
  const document = asRecord(message.documentMessage);
  const buttons = asRecord(message.buttonsResponseMessage);
  const list = asRecord(message.listResponseMessage);

  return (
    asString(message.conversation) ??
    asString(extendedText?.text) ??
    asString(image?.caption) ??
    asString(video?.caption) ??
    asString(document?.caption) ??
    asString(buttons?.selectedDisplayText) ??
    asString(buttons?.selectedButtonId) ??
    asString(list?.title) ??
    null
  );
}

function getMediaInfo(message: Record<string, unknown>) {
  const image = asRecord(message.imageMessage);
  const audio = asRecord(message.audioMessage);
  const video = asRecord(message.videoMessage);
  const document = asRecord(message.documentMessage);
  const media = image ?? audio ?? video ?? document;

  if (!media) {
    return {
      mediaId: null,
      mimeType: null
    };
  }

  return {
    mediaId:
      asString(media.base64) ??
      asString(media.url) ??
      asString(media.directPath) ??
      asString(media.mediaUrl) ??
      asString(media.id) ??
      null,
    mimeType: asString(media.mimetype) ?? asString(media.mimeType) ?? null
  };
}

function resolveMessageType(rawType: string | null, message: Record<string, unknown>) {
  if (rawType?.includes("audio") || message.audioMessage) {
    return "audio";
  }

  if (rawType?.includes("image") || message.imageMessage) {
    return "image";
  }

  if (rawType?.includes("video") || message.videoMessage) {
    return "video";
  }

  if (rawType?.includes("conversation") || rawType?.includes("text") || message.conversation || message.extendedTextMessage) {
    return "text";
  }

  return rawType;
}

export function extractIncomingEvolutionWebhookMessages(
  payload: EvolutionWebhookPayload
): IncomingEvolutionWebhookMessage[] {
  const dedupedMessages = new Map<string, IncomingEvolutionWebhookMessage>();

  if (!isMessagesUpsertEvent(payload)) {
    return [];
  }

  const instance = asString(payload.instance) ?? "unknown-instance";

  for (const item of getMessageCandidates(payload)) {
    const key = asRecord(item.key);
    const message = asRecord(item.message);
    const rawType = asString(item.messageType) ?? asString(item.type);

    if (!key || !message) {
      continue;
    }

    if (key.fromMe === true) {
      continue;
    }

    const remoteJid = asString(key.remoteJid);
    const participant = asString(key.participant);
    const senderPn = asString(key.senderPn) ?? asString(item.senderPn) ?? asString(item.cleanedSenderPn);
    const jidForRouting = participant ?? senderPn ?? remoteJid;

    if (!jidForRouting || /@g\.us$|@broadcast$|status@broadcast/i.test(jidForRouting)) {
      continue;
    }

    const rawEventId = asString(key.id);
    if (!rawEventId) {
      continue;
    }

    const phoneNumber = normalizeWhatsAppPhone(stripJid(senderPn) ?? stripJid(remoteJid) ?? jidForRouting);
    const body = getNestedMessageText(message);
    const { mediaId, mimeType } = getMediaInfo(message);
    const type = resolveMessageType(rawType, message);
    const eventId = `evolution:${createHash("sha256")
      .update([instance, jidForRouting, rawEventId, type ?? "unknown"].join("|"))
      .digest("hex")}`;

    dedupedMessages.set(eventId, {
      eventId,
      phoneNumber,
      body,
      type,
      mediaId,
      mimeType,
      caption: body
    });
  }

  return [...dedupedMessages.values()];
}
