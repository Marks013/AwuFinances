import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const DATA_ENCRYPTION_PREFIX = "enc:v1:";

const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

let cachedKey: Buffer | null | undefined;

function readRawKey() {
  const value = process.env.DATA_ENCRYPTION_KEY?.trim();
  return value && value.length >= KEY_BYTES ? value : null;
}

function parseKey(rawKey: string) {
  if (/^[a-f0-9]{64}$/i.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(rawKey)) {
    const decoded = Buffer.from(rawKey, "base64");
    if (decoded.length === KEY_BYTES) {
      return decoded;
    }
  }

  return createHash("sha256").update(rawKey, "utf8").digest();
}

function getEncryptionKey() {
  if (cachedKey !== undefined) {
    return cachedKey;
  }

  const rawKey = readRawKey();
  cachedKey = rawKey ? parseKey(rawKey) : null;
  return cachedKey;
}

function assertKeyAvailable() {
  const key = getEncryptionKey();

  if (!key && process.env.NODE_ENV === "production") {
    throw new Error("DATA_ENCRYPTION_KEY is required to write sensitive data in production.");
  }

  return key;
}

export function requireDataEncryptionKey() {
  const key = getEncryptionKey();

  if (!key) {
    throw new Error("DATA_ENCRYPTION_KEY must be configured before encrypting existing data.");
  }
}

export function isDataEncryptionConfigured() {
  return Boolean(getEncryptionKey());
}

export function isEncryptedValue(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(DATA_ENCRYPTION_PREFIX);
}

export function encryptSensitiveText(value: string) {
  if (!value || isEncryptedValue(value)) {
    return value;
  }

  const key = assertKeyAvailable();
  if (!key) {
    return value;
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: AUTH_TAG_BYTES
  });
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${DATA_ENCRYPTION_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSensitiveText(value: string) {
  if (!isEncryptedValue(value)) {
    return value;
  }

  const key = getEncryptionKey();
  if (!key) {
    return value;
  }

  const payload = value.slice(DATA_ENCRYPTION_PREFIX.length);
  const [ivEncoded, tagEncoded, encryptedEncoded] = payload.split(":");

  if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
    return value;
  }

  try {
    const iv = Buffer.from(ivEncoded, "base64");
    const tag = Buffer.from(tagEncoded, "base64");
    const encrypted = Buffer.from(encryptedEncoded, "base64");

    if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) {
      return value;
    }

    const decipher = createDecipheriv("aes-256-gcm", key, iv, {
      authTagLength: AUTH_TAG_BYTES
    });
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return value;
  }
}

export function constantTimeEquals(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}
