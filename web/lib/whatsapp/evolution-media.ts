import { serverEnv } from "@/lib/env/server";

const MAX_EVOLUTION_MEDIA_BYTES = 18 * 1024 * 1024;

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    base64: match[2]
  };
}

function looksLikeBase64(value: string) {
  return value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function decodeBase64Media(value: string, mimeType?: string | null) {
  const dataUrl = parseDataUrl(value);
  const bytes = Buffer.from(dataUrl?.base64 ?? value, "base64");

  if (bytes.byteLength > MAX_EVOLUTION_MEDIA_BYTES) {
    throw new Error("A midia enviada e grande demais para analise inline no momento.");
  }

  return {
    bytes,
    mimeType: dataUrl?.mimeType ?? mimeType ?? "application/octet-stream",
    fileSize: bytes.byteLength
  };
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
      throw new Error(`Evolution API excedeu o tempo limite de ${timeoutMs}ms ao baixar midia.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function downloadEvolutionMedia(mediaId: string, mimeType?: string | null) {
  if (mediaId.startsWith("data:") || looksLikeBase64(mediaId)) {
    return decodeBase64Media(mediaId, mimeType);
  }

  if (!mediaId.startsWith("http://") && !mediaId.startsWith("https://")) {
    throw new Error("A midia da Evolution API nao trouxe base64 ou URL de download.");
  }

  const response = await fetchWithTimeout(
    mediaId,
    {
      headers: serverEnv.EVOLUTION_API_KEY
        ? {
            apikey: serverEnv.EVOLUTION_API_KEY
          }
        : undefined
    },
    Number(process.env.EVOLUTION_MEDIA_TIMEOUT_MS ?? 15_000)
  );

  if (!response.ok) {
    throw new Error(`Falha ao baixar midia da Evolution API (${response.status}).`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_EVOLUTION_MEDIA_BYTES) {
    throw new Error("A midia enviada e grande demais para analise inline no momento.");
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_EVOLUTION_MEDIA_BYTES) {
    throw new Error("A midia enviada e grande demais para analise inline no momento.");
  }

  return {
    bytes,
    mimeType: mimeType ?? response.headers.get("content-type") ?? "application/octet-stream",
    fileSize: bytes.byteLength
  };
}
