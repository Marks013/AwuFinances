import { serverEnv } from "@/lib/env/server";

export type NotificationChannelHealth = {
  configured: boolean;
  issue: string | null;
};

export type EmailChannelHealth = NotificationChannelHealth & {
  provider: "webhook" | "resend" | "brevo";
  from: string | null;
};

export function getEmailChannelHealth(): EmailChannelHealth {
  const provider = serverEnv.EMAIL_PROVIDER;

  if (provider === "resend") {
    const configured = Boolean(serverEnv.RESEND_API_KEY && serverEnv.EMAIL_FROM);

    return {
      provider,
      configured,
      from: serverEnv.EMAIL_FROM ?? null,
      issue: configured ? null : "Defina RESEND_API_KEY e EMAIL_FROM para liberar avisos por e-mail."
    };
  }

  if (provider === "brevo") {
    const configured = Boolean(serverEnv.BREVO_API_KEY && serverEnv.EMAIL_FROM);

    return {
      provider,
      configured,
      from: serverEnv.EMAIL_FROM ?? null,
      issue: configured ? null : "Defina BREVO_API_KEY e EMAIL_FROM para liberar avisos por e-mail."
    };
  }

  const configured = Boolean(serverEnv.NOTIFICATION_EMAIL_WEBHOOK_URL);

  return {
    provider,
    configured,
    from: serverEnv.EMAIL_FROM ?? null,
    issue: configured ? null : "Defina NOTIFICATION_EMAIL_WEBHOOK_URL para encaminhar avisos por e-mail."
  };
}

export function getWhatsAppChannelHealth(): NotificationChannelHealth {
  const configured = Boolean(
    serverEnv.WHATSAPP_ASSISTANT_ENABLED === "true" &&
      serverEnv.WHATSAPP_PROVIDER === "evolution" &&
      serverEnv.WHATSAPP_INBOUND_ONLY === "true" &&
      serverEnv.EVOLUTION_API_URL &&
      serverEnv.EVOLUTION_API_KEY &&
      serverEnv.EVOLUTION_INSTANCE &&
      serverEnv.EVOLUTION_WEBHOOK_SECRET
  );

  return {
    configured,
    issue: configured
      ? null
      : "Defina Evolution API URL, API key, instancia e webhook secret para liberar o agente inbound."
  };
}
