import * as Sentry from "@sentry/nextjs";

import { ApiRequestError, isExpectedError } from "@/lib/observability/errors";
import { sanitizeSearch } from "@/lib/security/sensitive-url";

export { sanitizeSearch } from "@/lib/security/sensitive-url";

type AccessScopeInput = {
  id?: string | null;
  tenantId?: string | null;
  role?: string | null;
  isPlatformAdmin?: boolean | null;
  plan?: string | null;
  licenseStatus?: string | null;
};

type CaptureUnexpectedErrorOptions = {
  surface?: string;
  route?: string;
  operation?: string;
  feature?: string;
  requestId?: string | null;
  tenantId?: string | null;
  userId?: string | null;
  role?: string | null;
  isPlatformAdmin?: boolean | null;
  entityId?: string | null;
  tags?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
  dedupeKey?: string;
  dedupeWindowMs?: number;
};

type CaptureRequestErrorOptions = Omit<CaptureUnexpectedErrorOptions, "route" | "operation" | "requestId"> & {
  request?: Pick<Request, "url" | "method" | "headers"> | null;
  route?: string;
  operation?: string;
};

const recentClientCaptures = new Map<string, number>();
const safeRequestHeaderNames = new Set([
  "accept",
  "content-type",
  "host",
  "origin",
  "referer",
  "user-agent",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-request-id",
  "x-vercel-id"
]);

function buildClientLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  return {
    pathname: window.location.pathname,
    search: sanitizeSearch(window.location.search)
  };
}

function shouldSkipDuplicateCapture(key: string | undefined, windowMs: number) {
  if (typeof window === "undefined" || !key) {
    return false;
  }

  const now = Date.now();
  const lastSeen = recentClientCaptures.get(key) ?? 0;
  if (now - lastSeen < windowMs) {
    return true;
  }

  recentClientCaptures.set(key, now);
  return false;
}

function setOptionalTag(scope: Sentry.Scope, key: string, value: string | number | boolean | null | undefined) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  scope.setTag(key, String(value));
}

function resolveRequestRoute(request: Pick<Request, "url"> | null | undefined) {
  if (!request?.url) {
    return undefined;
  }

  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Non-Error value thrown";
}

function getErrorCause(error: unknown) {
  if (!(error instanceof Error) || !("cause" in error) || error.cause === undefined) {
    return null;
  }

  const cause = error.cause;
  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message
    };
  }

  return {
    name: typeof cause,
    message: String(cause)
  };
}

function parseLikelySourceFrame(error: unknown) {
  if (!(error instanceof Error) || !error.stack) {
    return null;
  }

  const frame = error.stack
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.includes("/app/") || line.includes("web/") || line.includes("@/"));

  if (!frame) {
    return null;
  }

  const match = frame.match(/^at\s+(?<functionName>.*?)\s+\((?<location>.*):(?<line>\d+):(?<column>\d+)\)$/) ??
    frame.match(/^at\s+(?<location>.*):(?<line>\d+):(?<column>\d+)$/);

  if (!match?.groups) {
    return { raw: frame };
  }

  return {
    function: match.groups.functionName ?? null,
    file: match.groups.location,
    line: Number(match.groups.line),
    column: Number(match.groups.column)
  };
}

function sanitizeRequestUrl(url: string | undefined) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    parsed.search = sanitizeSearch(parsed.search) ?? "";
    return {
      full: parsed.toString(),
      origin: parsed.origin,
      pathname: parsed.pathname,
      query: parsed.search || null
    };
  } catch {
    return {
      full: url,
      origin: null,
      pathname: url,
      query: null
    };
  }
}

function getSafeRequestHeaders(headers: Headers | undefined) {
  if (!headers) {
    return {};
  }

  const safeHeaders: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (safeRequestHeaderNames.has(lowerKey)) {
      safeHeaders[lowerKey] = value;
    }
  }

  return safeHeaders;
}

function getInvestigationHint(input: {
  errorName: string;
  errorMessage: string;
  route?: string;
  operation?: string;
  feature?: string;
  likelySource: ReturnType<typeof parseLikelySourceFrame>;
}) {
  const source = input.likelySource && "file" in input.likelySource ? `${input.likelySource.file}:${input.likelySource.line}` : null;

  return {
    summary: `${input.errorName} em ${input.operation ?? "operation"} ${input.route ?? "unknown route"}`,
    likely_owner: input.feature ?? "unknown",
    first_file_to_open: source,
    error_message: input.errorMessage,
    what_to_check: [
      "Abra o primeiro arquivo indicado e revise a linha/função apontada pelo stack trace.",
      "Compare os dados em request_context com as validações esperadas da rota.",
      "Se houver prisma/error code em error_context, confira schema, constraints e dados de entrada.",
      "Use requestId/x-vercel-id para correlacionar com logs do servidor quando existir."
    ]
  };
}

function buildCopyPasteDiagnostic(input: {
  errorName: string;
  errorMessage: string;
  route?: string;
  operation?: string;
  feature?: string;
  requestId?: string | null;
  tenantId?: string | null;
  userId?: string | null;
  likelySource: ReturnType<typeof parseLikelySourceFrame>;
}) {
  const source = input.likelySource && "file" in input.likelySource
    ? `${input.likelySource.file}:${input.likelySource.line}:${input.likelySource.column}`
    : "unknown";

  return [
    `Erro: ${input.errorName}`,
    `Mensagem: ${input.errorMessage}`,
    `Rota: ${input.operation ?? "unknown"} ${input.route ?? "unknown"}`,
    `Feature: ${input.feature ?? "unknown"}`,
    `Primeiro arquivo para abrir: ${source}`,
    `Tenant: ${input.tenantId ?? "unknown"}`,
    `Usuario: ${input.userId ?? "unknown"}`,
    `Request ID: ${input.requestId ?? "unknown"}`,
    "",
    "O que corrigir:",
    "1. Abra o primeiro arquivo indicado e revise a linha/função do stack trace.",
    "2. Compare request_context com as validacoes esperadas da rota.",
    "3. Se houver prismaCode/cause em error_context, confira schema, constraints e dados de entrada.",
    "4. Use Request ID ou x-vercel-id para correlacionar com logs do servidor."
  ].join("\n");
}

export function syncSentryAccessScope(input: AccessScopeInput | null | undefined) {
  if (!input?.id) {
    Sentry.setUser(null);
    Sentry.setTag("auth_state", "anonymous");
    Sentry.setTag("tenantId", "anonymous");
    Sentry.setTag("role", "guest");
    Sentry.setTag("isPlatformAdmin", "false");
    Sentry.setContext("access", {
      tenantId: null,
      role: null,
      isPlatformAdmin: false,
      plan: null,
      licenseStatus: null
    });
    return;
  }

  Sentry.setUser({
    id: input.id
  });
  Sentry.setTag("auth_state", "authenticated");
  Sentry.setTag("tenantId", input.tenantId ?? "unknown");
  Sentry.setTag("role", input.role ?? "unknown");
  Sentry.setTag("isPlatformAdmin", input.isPlatformAdmin ? "true" : "false");
  Sentry.setContext("access", {
    tenantId: input.tenantId ?? null,
    role: input.role ?? null,
    isPlatformAdmin: Boolean(input.isPlatformAdmin),
    plan: input.plan ?? null,
    licenseStatus: input.licenseStatus ?? null
  });
}

export function captureUnexpectedError(error: unknown, options: CaptureUnexpectedErrorOptions = {}) {
  if (isExpectedError(error)) {
    return;
  }

  if (shouldSkipDuplicateCapture(options.dedupeKey, options.dedupeWindowMs ?? 60_000)) {
    return;
  }

  Sentry.withScope((scope) => {
    const errorName = getErrorName(error);
    const errorMessage = getErrorMessage(error);
    const likelySource = parseLikelySourceFrame(error);
    const copyPasteDiagnostic = buildCopyPasteDiagnostic({
      errorName,
      errorMessage,
      route: options.route,
      operation: options.operation,
      feature: options.feature,
      requestId: options.requestId,
      tenantId: options.tenantId,
      userId: options.userId,
      likelySource
    });

    setOptionalTag(scope, "surface", options.surface);
    setOptionalTag(scope, "route", options.route);
    setOptionalTag(scope, "operation", options.operation);
    setOptionalTag(scope, "feature", options.feature);
    setOptionalTag(scope, "errorName", errorName);
    setOptionalTag(scope, "requestId", options.requestId);
    setOptionalTag(scope, "tenantId", options.tenantId);
    setOptionalTag(scope, "userId", options.userId);
    setOptionalTag(scope, "role", options.role);
    setOptionalTag(scope, "isPlatformAdmin", options.isPlatformAdmin);
    setOptionalTag(scope, "entityId", options.entityId);

    for (const [key, value] of Object.entries(options.tags ?? {})) {
      setOptionalTag(scope, key, value);
    }

    if (error instanceof ApiRequestError) {
      scope.setFingerprint(
        options.fingerprint ?? [
          "{{ default }}",
          error.method ?? "unknown",
          error.path ?? "unknown",
          String(error.status)
        ]
      );
      scope.setContext("request", {
        status: error.status,
        method: error.method ?? null,
        path: error.path ?? null,
        requestId: error.requestId ?? null,
        details: error.details ?? null
      });
    } else if (options.fingerprint?.length) {
      scope.setFingerprint(options.fingerprint);
    }

    scope.setContext("error_context", {
      name: errorName,
      message: errorMessage,
      cause: getErrorCause(error),
      likelySource,
      prismaCode: typeof error === "object" && error !== null && "code" in error ? String(error.code) : null
    });

    scope.setContext("investigation", getInvestigationHint({
      errorName,
      errorMessage,
      route: options.route,
      operation: options.operation,
      feature: options.feature,
      likelySource
    }));

    scope.setContext("diagnostic", {
      copy_paste: copyPasteDiagnostic
    });
    scope.setExtra("copy_paste_diagnostic", copyPasteDiagnostic);

    const clientLocation = buildClientLocation();
    if (clientLocation) {
      scope.setContext("client_location", clientLocation);
    }

    if (options.extra && Object.keys(options.extra).length > 0) {
      scope.setContext("details", options.extra);
    }

    Sentry.captureException(error);
  });
}

export function captureRequestError(error: unknown, options: CaptureRequestErrorOptions = {}) {
  const route = options.route ?? resolveRequestRoute(options.request);
  const operation = options.operation ?? options.request?.method;
  const requestId = options.request?.headers.get("x-request-id") ?? options.request?.headers.get("x-vercel-id") ?? null;
  const sanitizedRequestUrl = sanitizeRequestUrl(options.request?.url);

  captureUnexpectedError(error, {
    ...options,
    surface: options.surface ?? "api",
    route,
    operation,
    requestId,
    tags: {
      httpMethod: operation,
      ...(options.tags ?? {})
    },
    extra: {
      ...(sanitizedRequestUrl
        ? {
            request_context: {
              method: operation ?? null,
              route: route ?? null,
              url: sanitizedRequestUrl.full,
              origin: sanitizedRequestUrl.origin,
              pathname: sanitizedRequestUrl.pathname,
              query: sanitizedRequestUrl.query,
              headers: getSafeRequestHeaders(options.request?.headers)
            }
          }
        : {}),
      ...(options.extra ?? {})
    }
  });
}
