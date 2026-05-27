import { NextResponse } from "next/server";

import { processQueuedMercadoPagoWebhookEvents } from "@/lib/billing/async-processor";
import { serverEnv } from "@/lib/env/server";
import { captureRequestError } from "@/lib/observability/sentry";

function isAuthorized(request: Request) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;
  const fallbackToken = request.headers.get("x-automation-secret");

  const validSecrets = [serverEnv.AWU_AUTOMATION_SECRET, serverEnv.AUTOMATION_CRON_SECRET].filter(
    (value): value is string => Boolean(value)
  );

  return validSecrets.some((secret) => bearerToken === secret || fallbackToken === secret);
}

async function runBillingWebhookQueue(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const result = await processQueuedMercadoPagoWebhookEvents();
    return NextResponse.json(result);
  } catch (error) {
    captureRequestError(error, { request, feature: "billing-webhook", surface: "cron" });
    return NextResponse.json({ message: "Failed to process billing webhook queue" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return runBillingWebhookQueue(request);
}

export async function POST(request: Request) {
  return runBillingWebhookQueue(request);
}
