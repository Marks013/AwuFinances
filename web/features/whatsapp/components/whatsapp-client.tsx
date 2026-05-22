"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureApiResponse } from "@/lib/observability/http";

type WhatsAppClientProps = {
  embedded?: boolean;
};

type WhatsAppProfilePayload = {
  name: string;
  whatsappNumber: string;
  permissions: {
    canEditWhatsAppNumber: boolean;
  };
  license: {
    planLabel: string;
    features: {
      whatsappAssistant: boolean;
    };
  };
  integrations: {
    whatsappAssistantEnabled: boolean;
    whatsappConfigured: boolean;
    whatsappWebhookPath: string;
    smartClassificationEnabled: boolean;
    whatsappIssue: string | null;
  };
  preferences: {
    currency: string;
    dateFormat: string;
    emailNotifications: boolean;
    monthlyReports: boolean;
    budgetAlerts: boolean;
    dueReminders: boolean;
    autoTithe: boolean;
  };
};

async function getProfile() {
  const response = await fetch("/api/profile", { cache: "no-store" });
  await ensureApiResponse(response, {
    fallbackMessage: "Falha ao carregar configuracoes do WhatsApp",
    method: "GET",
    path: "/api/profile"
  });

  return (await response.json()) as WhatsAppProfilePayload;
}

function formatBrazilWhatsAppInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (!digits.length) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 3) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3)}`;

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function WhatsAppClient({ embedded = false }: WhatsAppClientProps) {
  const queryClient = useQueryClient();
  const [whatsappNumberDraft, setWhatsAppNumberDraft] = useState<string | null>(null);
  const profileQuery = useQuery({
    queryKey: ["profile", "whatsapp-hub"],
    queryFn: getProfile,
    staleTime: 30_000
  });

  const profile = profileQuery.data;
  const whatsappEnabledForPlan = Boolean(profile?.license.features.whatsappAssistant);
  const assistantEnabled = Boolean(profile?.integrations.whatsappAssistantEnabled);
  const canEditWhatsAppNumber = Boolean(profile?.permissions.canEditWhatsAppNumber);
  const whatsappNumber = whatsappNumberDraft ?? profile?.whatsappNumber ?? "";
  const savedWhatsAppNumber = profile?.whatsappNumber ?? "";
  const hasWhatsAppChange = normalizePhoneDigits(whatsappNumber) !== normalizePhoneDigits(savedWhatsAppNumber);
  const hasSavedWhatsAppNumber = Boolean(normalizePhoneDigits(savedWhatsAppNumber));

  const whatsappMutation = useMutation({
    mutationFn: async () => {
      if (!profile) return;

      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          whatsappNumber,
          preferences: profile.preferences
        })
      });

      await ensureApiResponse(response, {
        fallbackMessage: "Falha ao salvar WhatsApp",
        method: "PATCH",
        path: "/api/profile"
      });
    },
    onSuccess: async () => {
      toast.success("WhatsApp atualizado");
      setWhatsAppNumberDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["profile", "whatsapp-hub"] })
      ]);
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <section className="surface content-section" data-tutorial-id="settings-whatsapp">
      <div className="flex flex-wrap items-start justify-between gap-4" data-tutorial-id="settings-whatsapp-heading">
        <div className="min-w-0 flex-1">
          <div className="eyebrow">WhatsApp</div>
          <h2 className={embedded ? "mt-3 text-2xl font-semibold tracking-[-0.03em]" : "mt-3 text-3xl font-semibold tracking-[-0.03em]"}>
            Numero do assistente
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted-foreground)]">
            Cadastre o numero que identifica sua carteira. O agente responde somente mensagens iniciadas por voce.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="data-card p-5">
          <div className="space-y-2">
            <Label htmlFor="whatsapp-number">WhatsApp</Label>
            <Input
              disabled={!canEditWhatsAppNumber || whatsappMutation.isPending}
              id="whatsapp-number"
              inputMode="numeric"
              placeholder="(DD) 9 0000-0000"
              value={whatsappNumber}
              onChange={(event) => setWhatsAppNumberDraft(formatBrazilWhatsAppInput(event.target.value))}
            />
          </div>
          <Button
            className="mt-4 w-full"
            disabled={!canEditWhatsAppNumber || whatsappMutation.isPending || !hasWhatsAppChange}
            onClick={() => whatsappMutation.mutate()}
            type="button"
            variant={hasWhatsAppChange ? "default" : "secondary"}
          >
            {whatsappMutation.isPending ? (
              "Salvando..."
            ) : hasWhatsAppChange ? (
              "Salvar WhatsApp"
            ) : hasSavedWhatsAppNumber ? (
              <>
                <CheckCircle2 className="size-4" />
                WhatsApp salvo
              </>
            ) : (
              "Informe um WhatsApp"
            )}
          </Button>
        </article>

        <article className="muted-panel text-sm leading-7 text-[var(--color-muted-foreground)]">
          <p>
            Plano: <strong className="text-[var(--color-foreground)]">{profile?.license.planLabel ?? "Carregando..."}</strong>
          </p>
          <p>
            Assistente:{" "}
            <strong className="text-[var(--color-foreground)]">
              {!whatsappEnabledForPlan ? "bloqueado no plano" : assistantEnabled ? "ativo" : "desativado"}
            </strong>
          </p>
          {!whatsappEnabledForPlan ? (
            <p className="mt-3">O plano atual nao libera comandos financeiros pelo WhatsApp.</p>
          ) : null}
          {profile?.integrations.whatsappIssue ? <div className="warning-panel mt-4 text-sm">{profile.integrations.whatsappIssue}</div> : null}
        </article>
      </div>
    </section>
  );
}
