import { after, NextResponse } from "next/server";

import { serverEnv } from "@/lib/env/server";
import { captureUnexpectedError } from "@/lib/observability/sentry";
import {
  enqueueWhatsAppMessage,
  processQueuedWhatsAppWebhookEvents
} from "@/lib/whatsapp/async-processor";
import {
  extractIncomingEvolutionWebhookMessages,
  type EvolutionWebhookPayload
} from "@/lib/whatsapp/evolution-payload";
import { verifyEvolutionWebhookSecret } from "@/lib/whatsapp/evolution-security";

const MAX_MESSAGES_PER_WEBHOOK = 5;

export async function POST(request: Request) {
  if (serverEnv.WHATSAPP_ASSISTANT_ENABLED !== "true") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (!verifyEvolutionWebhookSecret(request)) {
    return NextResponse.json({ message: "Invalid webhook secret" }, { status: 401 });
  }

  let payload: EvolutionWebhookPayload;

  try {
    payload = (await request.json()) as EvolutionWebhookPayload;
  } catch (error) {
    console.error("[WhatsApp Evolution] Webhook payload parse error", error);
    return NextResponse.json({ error: "invalid payload" }, { status: 200 });
  }

  const messages = extractIncomingEvolutionWebhookMessages(payload).slice(0, MAX_MESSAGES_PER_WEBHOOK);

  if (!messages.length) {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  const enqueueResults = await Promise.all(
    messages.map(async (message) => {
      const queued = await enqueueWhatsAppMessage({
        eventId: message.eventId,
        phoneNumber: message.phoneNumber,
        body: message.body,
        type: message.type,
        mediaId: message.mediaId,
        mimeType: message.mimeType,
        caption: message.caption,
        payload
      });

      return queued ? message.eventId : null;
    })
  );
  const queuedEventIds = enqueueResults.filter((eventId): eventId is string => Boolean(eventId));

  if (!queuedEventIds.length) {
    return NextResponse.json({ status: "duplicate" }, { status: 200 });
  }

  after(async () => {
    try {
      await processQueuedWhatsAppWebhookEvents({
        eventIds: queuedEventIds,
        limit: queuedEventIds.length
      });
    } catch (error) {
      captureUnexpectedError(error, {
        surface: "webhook-after",
        route: "/api/integrations/whatsapp/evolution",
        operation: "POST",
        feature: "whatsapp",
        dedupeKey: "whatsapp:evolution-webhook:after"
      });
      console.error("[WhatsApp Evolution] Unhandled after() failure", error);
    }
  });

  return NextResponse.json({ status: "received" }, { status: 200 });
}
