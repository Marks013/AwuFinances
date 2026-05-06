import type {
  BrowserOptions,
  EdgeOptions,
  ErrorEvent as SentryErrorEvent,
  EventHint,
  NodeOptions,
  StackFrame
} from "@sentry/nextjs";

import { isExpectedError } from "./lib/observability/errors";

const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";
const release = process.env.SENTRY_RELEASE;

const clientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const serverDsn = process.env.SENTRY_DSN ?? clientDsn;

function parseSampleRate(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, parsed));
}

const defaultTraceSampleRate = environment === "production" ? 0.2 : 1;
const clientTraceSampleRate = parseSampleRate(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  defaultTraceSampleRate
);
const serverTraceSampleRate = parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, defaultTraceSampleRate);

const ignoredErrors = [
  "Unauthorized",
  "Forbidden",
  "NEXT_REDIRECT",
  "NEXT_NOT_FOUND",
  "AbortError",
  "The operation was aborted"
];

function isBrowserExtensionFrame(frame: StackFrame) {
  const filename = frame.filename ?? "";
  return filename.startsWith("chrome-extension://") || filename.startsWith("moz-extension://");
}

function shouldDropThirdPartyExtensionEvent(event: SentryErrorEvent) {
  const frames = event.exception?.values?.flatMap((value) => value.stacktrace?.frames ?? []) ?? [];
  return frames.length > 0 && frames.every(isBrowserExtensionFrame);
}

function beforeSend(event: SentryErrorEvent, hint: EventHint): SentryErrorEvent | null {
  if (isExpectedError(hint.originalException)) {
    return null;
  }

  if (shouldDropThirdPartyExtensionEvent(event)) {
    return null;
  }

  return event;
}

export function getClientSentryOptions(): BrowserOptions {
  return {
    dsn: clientDsn,
    enabled: Boolean(clientDsn),
    environment,
    release,
    sendDefaultPii: false,
    sampleRate: 1,
    tracesSampleRate: clientTraceSampleRate,
    maxBreadcrumbs: 50,
    normalizeDepth: 5,
    normalizeMaxBreadth: 100,
    ignoreErrors: ignoredErrors,
    beforeSend
  };
}

export function getServerSentryOptions(): NodeOptions | EdgeOptions {
  return {
    dsn: serverDsn,
    enabled: Boolean(serverDsn),
    environment,
    release,
    sendDefaultPii: false,
    sampleRate: 1,
    tracesSampleRate: serverTraceSampleRate,
    maxBreadcrumbs: 50,
    normalizeDepth: 5,
    normalizeMaxBreadth: 100,
    ignoreErrors: ignoredErrors,
    beforeSend
  };
}
