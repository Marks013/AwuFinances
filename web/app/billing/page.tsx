import Link from "next/link";
import { redirect } from "next/navigation";

import { AwuMascot } from "@/components/brand/awu-mascot";
import { Button } from "@/components/ui/button";
import { BillingSummaryCard } from "@/features/billing/components/billing-summary-card";
import { CheckoutClient } from "@/features/billing/components/checkout-client";
import { getBillingCheckoutPageData } from "@/lib/billing/service";
import { isAuthError, isPermissionError } from "@/lib/observability/errors";

type BillingPageProps = {
  searchParams?: Promise<{
    checkout_status?: string;
    collection_status?: string;
    cycle?: string;
    intent?: string;
    merchant_order_id?: string;
    payment_id?: string;
    preference_id?: string;
    preapproval_id?: string;
    status?: string;
  }>;
};

function normalizeCheckoutReturnStatus(params: Awaited<BillingPageProps["searchParams"]>) {
  const candidates = [params?.checkout_status, params?.collection_status, params?.status]
    .map((value) => value?.trim().toLowerCase())
    .filter(Boolean);

  if (candidates.some((value) => value === "approved" || value === "accredited")) {
    return "approved" as const;
  }

  if (candidates.some((value) => value === "pending" || value === "in_process" || value === "in_mediation")) {
    return "pending" as const;
  }

  if (
    candidates.some(
      (value) => value === "rejected" || value === "failure" || value === "cancelled" || value === "canceled"
    )
  ) {
    return "rejected" as const;
  }

  const hasMercadoPagoReference = Boolean(
    params?.payment_id || params?.preapproval_id || params?.preference_id || params?.merchant_order_id
  );

  return hasMercadoPagoReference ? ("unknown" as const) : null;
}

function BillingLoadFallback() {
  return (
    <main id="main-content" className="page-shell">
      <div className="mx-auto max-w-3xl py-10 sm:py-14">
        <section className="surface content-section">
          <div className="eyebrow">Mercado Pago</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
            Nao foi possivel abrir a central de assinatura
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--color-muted-foreground)]">
            A sua sessao foi reconhecida, mas os dados de billing nao responderam com seguranca agora. Volte ao painel e
            tente novamente; se o pagamento ja foi feito, a liberacao continua sendo conferida pelos webhooks.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/dashboard/settings">Voltar ao painel</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/license">Ver status da licenca</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/billing">Tentar novamente</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const initialCycle = params?.cycle === "annual" ? "annual" : "monthly";
  const initialIntent = params?.intent === "manage-card" ? "manage-card" : "checkout";
  const checkoutReturnStatus = normalizeCheckoutReturnStatus(params);
  let pageData: Awaited<ReturnType<typeof getBillingCheckoutPageData>>;

  try {
    pageData = await getBillingCheckoutPageData();
  } catch (error) {
    if (isAuthError(error)) {
      redirect("/login");
    }

    if (isPermissionError(error)) {
      redirect("/dashboard/admin");
    }

    return <BillingLoadFallback />;
  }

  const profile = {
    role: pageData.access.role,
    isPlatformAdmin: pageData.access.isPlatformAdmin,
    sharing: {
      canManage: pageData.access.canManageBilling
    },
    tenant: {
      name: pageData.access.tenant.name
    },
    license: {
      plan: pageData.access.license.plan,
      planLabel: pageData.access.license.planLabel,
      status: pageData.access.license.status,
      statusLabel: pageData.access.license.statusLabel,
      features: pageData.access.license.features,
      limits: pageData.access.license.effectiveLimits
    }
  } as const;

  return (
    <main id="main-content" className="page-shell">
      <div className="mx-auto max-w-5xl space-y-6 py-10 sm:py-14">
        <section className="surface content-section">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="eyebrow">Mercado Pago</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Checkout e gestão da assinatura</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-muted-foreground)]">
                Este fluxo mantém o pagamento dentro do seu domínio, sincroniza a liberação via webhook e conversa
                direto com a licença da conta.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <AwuMascot className="hidden w-24 xl:block" title="Awu comemorando assinatura" variant="success" />
              <Button asChild variant="secondary">
                <Link href={pageData.access.license.canAccessApp ? "/dashboard/settings" : "/license"}>Voltar</Link>
              </Button>
            </div>
          </div>
        </section>

        <BillingSummaryCard compact profile={profile} />

        <CheckoutClient
          amount={pageData.amount}
          annualAmount={pageData.annualAmount}
          annualMaxInstallments={pageData.annualMaxInstallments}
          checkoutReturn={
            checkoutReturnStatus
              ? {
                  merchantOrderId: params?.merchant_order_id ?? null,
                  paymentId: params?.payment_id ?? null,
                  preapprovalId: params?.preapproval_id ?? null,
                  preferenceId: params?.preference_id ?? null,
                  status: checkoutReturnStatus
                }
              : null
          }
          currencyId={pageData.currencyId}
          initialCycle={initialCycle}
          initialIntent={initialIntent}
          planName={pageData.planName}
          promotions={pageData.promotions}
          publicKey={pageData.publicKey}
        />
      </div>
    </main>
  );
}
