import { serverEnv } from "@/lib/env/server";

function constantTimeEquals(a: string, b: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return diff === 0;
}

function extractBearerToken(value: string | null) {
  if (!value?.startsWith("Bearer ")) {
    return null;
  }

  return value.slice("Bearer ".length).trim() || null;
}

export function verifyEvolutionWebhookSecret(request: Request) {
  const expected = serverEnv.EVOLUTION_WEBHOOK_SECRET;
  if (!expected) {
    return false;
  }

  const url = new URL(request.url);
  const candidates = [
    request.headers.get("x-evolution-webhook-secret"),
    request.headers.get("x-awu-webhook-secret"),
    request.headers.get("apikey"),
    extractBearerToken(request.headers.get("authorization")),
    url.searchParams.get("secret")
  ].filter((value): value is string => Boolean(value));

  return candidates.some((candidate) => constantTimeEquals(candidate, expected));
}
