"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { BillingSummaryCard } from "@/features/billing/components/billing-summary-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SupportClient } from "@/features/support/components/support-client";
import { WhatsAppClient } from "@/features/whatsapp/components/whatsapp-client";
import { ensureApiResponse } from "@/lib/observability/http";

type ProfilePayload = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  isPlatformAdmin: boolean;
  tenant: {
    id?: string;
    name?: string;
  };
  sharing: {
    canManage: boolean;
  };
  permissions: {
    canAccessAdminPage: boolean;
    canAccessSharingPage: boolean;
    canManageFamilyInvites: boolean;
    canEditName: boolean;
    canEditWhatsAppNumber: boolean;
    canEditEmailNotifications: boolean;
    canEditMonthlyReports: boolean;
    canEditCurrency: boolean;
    canEditDateFormat: boolean;
    canEditBudgetAlerts: boolean;
    canEditDueReminders: boolean;
    canEditAutoTithe: boolean;
  };
  whatsappNumber: string;
  license: {
    plan: "free" | "pro";
    planLabel: string;
    status: string;
    statusLabel: string;
    features: {
      whatsappAssistant: boolean;
      automation: boolean;
      pdfExport: boolean;
    };
    limits: {
      users: number | null;
      accounts: number | null;
      cards: number | null;
    };
  };
  integrations: {
    whatsappAssistantEnabled: boolean;
    whatsappConfigured: boolean;
    whatsappWebhookPath: string;
    smartClassificationEnabled: boolean;
    emailProvider: "webhook" | "resend" | "brevo";
    emailConfigured: boolean;
    emailFrom: string | null;
    emailIssue: string | null;
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

type SettingsFormValues = {
  name: string;
  currency: string;
  dateFormat: string;
  emailNotifications: boolean;
  monthlyReports: boolean;
  budgetAlerts: boolean;
  dueReminders: boolean;
  autoTithe: boolean;
};

type SettingsClientProps = {
  initialEmail: string;
  initialName: string;
};

async function getProfile() {
  const response = await fetch("/api/profile", { cache: "no-store" });
  await ensureApiResponse(response, { fallbackMessage: "Falha ao carregar perfil", method: "GET", path: "/api/profile" });
  return (await response.json()) as ProfilePayload;
}

export function SettingsClient({ initialEmail, initialName }: SettingsClientProps) {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const canManageSharing = Boolean(profileQuery.data?.permissions.canAccessSharingPage);
  const settingsPermissions = profileQuery.data?.permissions;
  const hasSharedAccountRestrictions = Boolean(
    settingsPermissions &&
      (!settingsPermissions.canEditBudgetAlerts ||
        !settingsPermissions.canEditDueReminders ||
        !settingsPermissions.canEditAutoTithe)
  );
  const form = useForm<SettingsFormValues>({
    defaultValues: {
      name: "",
      currency: "BRL",
      dateFormat: "DD/MM/YYYY",
      emailNotifications: true,
      monthlyReports: true,
      budgetAlerts: true,
      dueReminders: true,
      autoTithe: false
    },
    values: profileQuery.data
      ? {
          name: profileQuery.data.name,
          currency: profileQuery.data.preferences.currency,
          dateFormat: profileQuery.data.preferences.dateFormat,
          emailNotifications: profileQuery.data.preferences.emailNotifications,
          monthlyReports: profileQuery.data.preferences.monthlyReports,
          budgetAlerts: profileQuery.data.preferences.budgetAlerts,
          dueReminders: profileQuery.data.preferences.dueReminders,
          autoTithe: profileQuery.data.preferences.autoTithe
        }
      : undefined
  });

  const profileMutation = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          preferences: {
            currency: values.currency,
            dateFormat: values.dateFormat,
            emailNotifications: values.emailNotifications,
            monthlyReports: values.monthlyReports,
            budgetAlerts: values.budgetAlerts,
            dueReminders: values.dueReminders,
            autoTithe: values.autoTithe
          }
        })
      });
      await ensureApiResponse(response, { fallbackMessage: "Falha ao salvar configuracoes", method: "PATCH", path: "/api/profile" });

      if (!response.ok) throw new Error("Falha ao salvar configuracoes");
    },
    onSuccess: async () => {
      toast.success("Configuracoes salvas");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => {
      toast.error("Nao foi possivel salvar configuracoes");
    }
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/profile", {
        method: "DELETE"
      });
      await ensureApiResponse(response, { fallbackMessage: "Nao foi possivel excluir a conta", method: "DELETE", path: "/api/profile" });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Nao foi possivel excluir a conta");
      }
    },
    onSuccess: async () => {
      toast.success("Conta excluida definitivamente");
      await signOut({ redirect: false });
      window.location.href = "/";
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  return (
    <div className="space-y-6">
      {canManageSharing ? (
        <section className="surface content-section">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="eyebrow">Compartilhamento</div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Compartilhamento familiar</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--color-muted-foreground)]">
                Convide conjuge, familiar ou alguem de confianca para usar a mesma carteira financeira da conta{" "}
                {profileQuery.data?.tenant.name ?? "principal"}.
              </p>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/dashboard/sharing">Abrir convites</Link>
            </Button>
          </div>
        </section>
      ) : null}

      <section className="surface content-section">
        <div className="page-intro">
          <div className="eyebrow">Configuracoes</div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">Conta, WhatsApp e suporte</h1>
          <p className="max-w-2xl text-sm leading-7 text-[var(--color-muted-foreground)]">
            Ajustes pessoais, numero do assistente e contato com suporte ficam juntos aqui para reduzir telas soltas.
          </p>
        </div>
        {profileQuery.data?.isPlatformAdmin ? (
          <div className="warning-panel mt-6 text-sm">
            Esta conta e o superadmin da plataforma. Recursos Premium e limites do plano ficam liberados aqui para
            suporte e auditoria, mesmo que a conta vinculada esteja em um plano restritivo.
          </div>
        ) : null}
      </section>

      {profileQuery.data ? <BillingSummaryCard profile={profileQuery.data} /> : null}

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="surface content-section">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">Perfil e preferencias</h2>
          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit((values) => profileMutation.mutate(values))}>
            <div className="space-y-2">
              <Label htmlFor="settings-name">Nome</Label>
              <Input disabled={settingsPermissions ? !settingsPermissions.canEditName : false} id="settings-name" {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-email">E-mail</Label>
              <Input disabled id="settings-email" value={profileQuery.data?.email ?? ""} />
            </div>
            {hasSharedAccountRestrictions ? (
              <div className="muted-panel text-sm text-[var(--color-muted-foreground)]">
                Como <strong>Familiar</strong>, alertas, lembretes e dizimo ficam sob controle do <strong>Admin de Conta</strong>.
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="muted-panel flex items-center gap-3 text-sm">
                <input className="app-checkbox" disabled={settingsPermissions ? !settingsPermissions.canEditEmailNotifications : false} type="checkbox" {...form.register("emailNotifications")} /> Notificacoes por e-mail
              </label>
              <label className="muted-panel flex items-center gap-3 text-sm">
                <input className="app-checkbox" disabled={settingsPermissions ? !settingsPermissions.canEditMonthlyReports : false} type="checkbox" {...form.register("monthlyReports")} /> Relatorios mensais
              </label>
              <label className="muted-panel flex items-center gap-3 text-sm">
                <input className="app-checkbox" disabled={settingsPermissions ? !settingsPermissions.canEditBudgetAlerts : false} type="checkbox" {...form.register("budgetAlerts")} /> Alertas de orcamento
              </label>
              <label className="muted-panel flex items-center gap-3 text-sm">
                <input className="app-checkbox" disabled={settingsPermissions ? !settingsPermissions.canEditDueReminders : false} type="checkbox" {...form.register("dueReminders")} /> Lembretes de vencimento
              </label>
              <label className="muted-panel flex items-center gap-3 text-sm md:col-span-2">
                <input className="app-checkbox" disabled={settingsPermissions ? !settingsPermissions.canEditAutoTithe : false} type="checkbox" {...form.register("autoTithe")} /> Marcar dizimo por padrao em novas receitas
              </label>
            </div>
            <Button className="w-full" disabled={profileMutation.isPending} type="submit">
              {profileMutation.isPending ? "Salvando..." : "Salvar configuracoes"}
            </Button>
          </form>
        </section>

        <WhatsAppClient embedded />
      </div>

      <SupportClient embedded initialEmail={initialEmail} initialName={initialName} />

      <section className="surface content-section">
        <div className="eyebrow">Zona de risco</div>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Excluir conta definitivamente</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-muted-foreground)]">
          Esta acao apaga o seu login e todos os dados vinculados a sua conta, incluindo contas, cartoes,
          transacoes, metas, assinaturas e historico proprio.
        </p>
        {profileQuery.data?.isPlatformAdmin ? (
          <div className="warning-panel mt-6 text-sm">
            A conta superadmin da plataforma nao pode ser excluida por este fluxo.
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              className="border-[var(--color-destructive)] text-[var(--color-destructive)] hover:bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)]"
              disabled={deleteAccountMutation.isPending}
              onClick={() => {
                const email = profileQuery.data?.email ?? "";
                const confirmation = window.prompt(`Digite ${email} para confirmar a exclusao definitiva da conta.`);

                if (!confirmation) {
                  return;
                }

                if (confirmation.trim().toLowerCase() !== email.trim().toLowerCase()) {
                  toast.error("O e-mail informado nao confere");
                  return;
                }

                deleteAccountMutation.mutate();
              }}
              type="button"
              variant="ghost"
            >
              {deleteAccountMutation.isPending ? "Excluindo conta..." : "Excluir minha conta"}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
