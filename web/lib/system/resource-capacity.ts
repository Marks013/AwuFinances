import { readFile, statfs } from "node:fs/promises";
import { tmpdir } from "node:os";

const GIB = 1024 ** 3;
const STATUS_PATH = "/run/server-resource-guard/status.json";
const STATUS_MAX_AGE_MS = 10 * 60 * 1_000;

type GuardStatus = {
  acceptingHeavyJobs?: boolean;
  generatedAt?: string;
};

type CapacityRequest = {
  inputBytes?: number;
  multiplier?: number;
  storagePath?: string;
};

export class ResourceCapacityError extends Error {
  constructor(
    public readonly code: "HOST_RESOURCE_PRESSURE" | "STORAGE_CAPACITY_LOW",
    message: string,
  ) {
    super(message);
    this.name = "ResourceCapacityError";
  }
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function hostGuardBlocks() {
  try {
    const status = JSON.parse(await readFile(STATUS_PATH, "utf8")) as GuardStatus;
    const generatedAt = Date.parse(status.generatedAt ?? "");
    return (
      Number.isFinite(generatedAt) &&
      Date.now() - generatedAt <= STATUS_MAX_AGE_MS &&
      status.acceptingHeavyJobs === false
    );
  } catch {
    return false;
  }
}

export function getRequestContentLength(request: Request) {
  const parsed = Number(request.headers.get("content-length"));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export async function assertResourceCapacity(request: CapacityRequest = {}) {
  const storagePath =
    request.storagePath ?? process.env.RESOURCE_STORAGE_PATH ?? tmpdir();
  const [filesystem, blockedByHost] = await Promise.all([
    statfs(storagePath),
    hostGuardBlocks(),
  ]);
  const totalBytes = Number(filesystem.blocks) * Number(filesystem.bsize);
  const availableBytes = Number(filesystem.bavail) * Number(filesystem.bsize);
  const usedPercent =
    totalBytes > 0 ? ((totalBytes - availableBytes) / totalBytes) * 100 : 100;
  const estimatedWorkingBytes = Math.ceil(
    Math.max(0, request.inputBytes ?? 0) * Math.max(1, request.multiplier ?? 1),
  );
  const blockUsedPercent = positiveNumber(
    process.env.STORAGE_BLOCK_USED_PERCENT,
    80,
  );
  const minimumFreeBytes = positiveNumber(
    process.env.STORAGE_MIN_FREE_BYTES,
    30 * GIB,
  );

  if (blockedByHost) {
    throw new ResourceCapacityError(
      "HOST_RESOURCE_PRESSURE",
      "O servidor está respirando um pouco antes de iniciar outra tarefa pesada. Aguarde alguns minutos e tente novamente.",
    );
  }

  if (
    usedPercent >= blockUsedPercent ||
    availableBytes - estimatedWorkingBytes < minimumFreeBytes
  ) {
    throw new ResourceCapacityError(
      "STORAGE_CAPACITY_LOW",
      "O servidor está preservando espaço para manter tudo estável. Aguarde alguns minutos e tente novamente.",
    );
  }
}
