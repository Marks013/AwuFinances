import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  },
  z.string().url().optional()
);

const optionalString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  },
  z.string().optional()
);

const optionalPositiveNumber = z.preprocess(
  (value) => {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim();
    if (!normalized.length) {
      return undefined;
    }

    const parsed = Number(normalized.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : value;
  },
  z.number().positive().optional()
);

const serverEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    DATA_ENCRYPTION_KEY: z.string().min(32).optional(),
    AUTH_SECRET: z.string().min(1),
    AUTH_TRUST_HOST: z.enum(["true", "false"]).default("false"),
    AUTOMATION_CRON_SECRET: z.string().min(1),
    MAINTENANCE_MODE: z.enum(["true", "false"]).default("false"),
    GEMINI_ENABLED: z.enum(["true", "false"]).default("false"),
    GEMINI_API_KEY: optionalString,
    GEMINI_MODEL: optionalString,
    GEMINI_BASE_URL: optionalUrl,
    WHATSAPP_ASSISTANT_ENABLED: z.enum(["true", "false"]).default("false"),
    WHATSAPP_PROVIDER: z.literal("evolution").default("evolution"),
    WHATSAPP_INBOUND_ONLY: z.enum(["true", "false"]).default("true"),
    WHATSAPP_MAX_REPLIES_PER_INBOUND: z.coerce.number().int().positive().default(1),
    WHATSAPP_MIN_REPLY_DELAY_MS: z.coerce.number().int().nonnegative().default(900),
    WHATSAPP_MAX_REPLY_DELAY_MS: z.coerce.number().int().nonnegative().default(2500),
    WHATSAPP_USER_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(8),
    WHATSAPP_USER_RATE_LIMIT_PER_DAY: z.coerce.number().int().positive().default(200),
    EVOLUTION_API_URL: optionalUrl,
    EVOLUTION_API_KEY: optionalString,
    EVOLUTION_INSTANCE: optionalString,
    EVOLUTION_WEBHOOK_SECRET: optionalString,
    EMAIL_PROVIDER: z.enum(["webhook", "resend", "brevo"]).default("webhook"),
    EMAIL_FROM: optionalString,
    EMAIL_FROM_NAME: optionalString,
    EMAIL_REPLY_TO: optionalString,
    SUPPORT_EMAIL_TO: optionalString,
    RESEND_API_KEY: optionalString,
    RESEND_WEBHOOK_SECRET: optionalString,
    BREVO_API_KEY: optionalString,
    NOTIFICATION_EMAIL_WEBHOOK_URL: optionalUrl,
    MP_BILLING_ENABLED: z.enum(["true", "false"]).default("false"),
    MP_ACCESS_TOKEN: optionalString,
    MP_PUBLIC_KEY: optionalString,
    MP_WEBHOOK_SECRET: optionalString,
    MP_BILLING_PLAN_SLUG: z.string().default("premium-completo"),
    MP_BILLING_REASON: z.string().default("Awu Finances Premium"),
    MP_BILLING_AMOUNT: optionalPositiveNumber,
    MP_BILLING_ANNUAL_AMOUNT: optionalPositiveNumber,
    MP_BILLING_ANNUAL_MAX_INSTALLMENTS: z.coerce.number().int().positive().default(12),
    MP_BILLING_CURRENCY: z.string().default("BRL"),
    MP_BILLING_FREQUENCY: z.coerce.number().int().positive().default(1),
    MP_BILLING_FREQUENCY_TYPE: z.string().default("months")
  })
  .superRefine((value, context) => {
    if (value.WHATSAPP_MIN_REPLY_DELAY_MS > value.WHATSAPP_MAX_REPLY_DELAY_MS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["WHATSAPP_MAX_REPLY_DELAY_MS"],
        message: "WHATSAPP_MAX_REPLY_DELAY_MS must be greater than or equal to WHATSAPP_MIN_REPLY_DELAY_MS"
      });
    }

    if (value.WHATSAPP_ASSISTANT_ENABLED === "true") {
      for (const key of [
        "EVOLUTION_API_URL",
        "EVOLUTION_API_KEY",
        "EVOLUTION_INSTANCE",
        "EVOLUTION_WEBHOOK_SECRET"
      ] as const) {
        if (!value[key]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when WHATSAPP_ASSISTANT_ENABLED=true`
          });
        }
      }
    }

    if (value.MP_BILLING_ENABLED === "true") {
      for (const key of ["MP_ACCESS_TOKEN", "MP_PUBLIC_KEY", "MP_WEBHOOK_SECRET"] as const) {
        if (!value[key]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when MP_BILLING_ENABLED=true`
          });
        }
      }
    }
  });

export const serverEnv = serverEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
  AUTOMATION_CRON_SECRET: process.env.AUTOMATION_CRON_SECRET,
  MAINTENANCE_MODE: process.env.MAINTENANCE_MODE,
  GEMINI_ENABLED: process.env.GEMINI_ENABLED,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_BASE_URL: process.env.GEMINI_BASE_URL,
  WHATSAPP_ASSISTANT_ENABLED: process.env.WHATSAPP_ASSISTANT_ENABLED,
  WHATSAPP_PROVIDER: process.env.WHATSAPP_PROVIDER,
  WHATSAPP_INBOUND_ONLY: process.env.WHATSAPP_INBOUND_ONLY,
  WHATSAPP_MAX_REPLIES_PER_INBOUND: process.env.WHATSAPP_MAX_REPLIES_PER_INBOUND,
  WHATSAPP_MIN_REPLY_DELAY_MS: process.env.WHATSAPP_MIN_REPLY_DELAY_MS,
  WHATSAPP_MAX_REPLY_DELAY_MS: process.env.WHATSAPP_MAX_REPLY_DELAY_MS,
  WHATSAPP_USER_RATE_LIMIT_PER_MINUTE: process.env.WHATSAPP_USER_RATE_LIMIT_PER_MINUTE,
  WHATSAPP_USER_RATE_LIMIT_PER_DAY: process.env.WHATSAPP_USER_RATE_LIMIT_PER_DAY,
  EVOLUTION_API_URL: process.env.EVOLUTION_API_URL,
  EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY,
  EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE,
  EVOLUTION_WEBHOOK_SECRET: process.env.EVOLUTION_WEBHOOK_SECRET,
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
  EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
  SUPPORT_EMAIL_TO: process.env.SUPPORT_EMAIL_TO,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  NOTIFICATION_EMAIL_WEBHOOK_URL: process.env.NOTIFICATION_EMAIL_WEBHOOK_URL,
  MP_BILLING_ENABLED: process.env.MP_BILLING_ENABLED,
  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN,
  MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY,
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET,
  MP_BILLING_PLAN_SLUG: process.env.MP_BILLING_PLAN_SLUG,
  MP_BILLING_REASON: process.env.MP_BILLING_REASON,
  MP_BILLING_AMOUNT: process.env.MP_BILLING_AMOUNT,
  MP_BILLING_ANNUAL_AMOUNT: process.env.MP_BILLING_ANNUAL_AMOUNT,
  MP_BILLING_ANNUAL_MAX_INSTALLMENTS: process.env.MP_BILLING_ANNUAL_MAX_INSTALLMENTS,
  MP_BILLING_CURRENCY: process.env.MP_BILLING_CURRENCY,
  MP_BILLING_FREQUENCY: process.env.MP_BILLING_FREQUENCY,
  MP_BILLING_FREQUENCY_TYPE: process.env.MP_BILLING_FREQUENCY_TYPE
});
