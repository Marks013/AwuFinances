import { Prisma } from "@prisma/client";

import { decryptSensitiveText, encryptSensitiveText } from "@/lib/security/data-encryption";

const protectedModelFields = {
  transaction: ["description", "notes", "classificationKeyword", "classificationReason"],
  whatsAppMessage: ["body", "response"],
  notificationDelivery: ["target", "subject", "message", "errorMessage"]
} as const;

const protectedFieldNames = new Set<string>(Object.values(protectedModelFields).flat());

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || value instanceof Date) {
    return false;
  }

  if (value instanceof Prisma.Decimal) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function modelKey(model: string | undefined) {
  if (!model) {
    return null;
  }

  return `${model.charAt(0).toLowerCase()}${model.slice(1)}` as keyof typeof protectedModelFields;
}

function getProtectedFields(model: string | undefined) {
  const key = modelKey(model);
  return key ? protectedModelFields[key] : undefined;
}

function encryptFieldValue(value: unknown): unknown {
  if (typeof value === "string") {
    return encryptSensitiveText(value);
  }

  if (isRecord(value) && typeof value.set === "string") {
    return {
      ...value,
      set: encryptSensitiveText(value.set)
    };
  }

  return value;
}

function encryptMutationData(data: unknown, fields: readonly string[] | undefined): unknown {
  if (!fields) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => encryptMutationData(item, fields));
  }

  if (!isRecord(data)) {
    return data;
  }

  const encrypted = { ...data };
  for (const field of fields) {
    if (Object.hasOwn(encrypted, field)) {
      encrypted[field] = encryptFieldValue(encrypted[field]);
    }
  }

  return encrypted;
}

function protectMutationArgs<TArgs>(model: string | undefined, operation: string, args: TArgs): TArgs {
  if (!isRecord(args)) {
    return args;
  }

  const fields = getProtectedFields(model);
  if (!fields) {
    return args;
  }

  const protectedArgs: Record<string, unknown> = { ...args };

  if (operation === "create" || operation === "update" || operation === "updateMany") {
    protectedArgs.data = encryptMutationData(protectedArgs.data, fields);
  }

  if (operation === "createMany" || operation === "createManyAndReturn") {
    const data = protectedArgs.data;
    protectedArgs.data = Array.isArray(data)
      ? data.map((item) => encryptMutationData(item, fields))
      : encryptMutationData(data, fields);
  }

  if (operation === "upsert") {
    protectedArgs.create = encryptMutationData(protectedArgs.create, fields);
    protectedArgs.update = encryptMutationData(protectedArgs.update, fields);
  }

  return protectedArgs as TArgs;
}

export function decryptProtectedFieldsDeep<TValue>(value: TValue): TValue {
  if (Array.isArray(value)) {
    return value.map((item) => decryptProtectedFieldsDeep(item)) as TValue;
  }

  if (!isRecord(value)) {
    return value;
  }

  const decrypted: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    decrypted[key] =
      protectedFieldNames.has(key) && typeof fieldValue === "string"
        ? decryptSensitiveText(fieldValue)
        : decryptProtectedFieldsDeep(fieldValue);
  }

  return decrypted as TValue;
}

export const dataProtectionExtension = Prisma.defineExtension({
  name: "sensitive-data-protection",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const protectedArgs = protectMutationArgs(model, operation, args);
        const result = await query(protectedArgs);
        return decryptProtectedFieldsDeep(result);
      }
    }
  }
});
