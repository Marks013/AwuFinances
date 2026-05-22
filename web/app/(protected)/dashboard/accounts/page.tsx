import type { Route } from "next";
import { CreditCard, Landmark, Utensils } from "lucide-react";

import { ModuleSwitcher } from "@/components/navigation/module-switcher";
import { requireEndUserDashboardPageUser } from "@/lib/auth/session";
import { AccountsClient } from "@/features/accounts/components/accounts-client";
import { BenefitFoodClient } from "@/features/benefits/components/benefit-food-client";
import { CardsClient } from "@/features/cards/components/cards-client";

type AccountsPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
    view?: string | string[];
  }>;
};

const walletViews = [
  {
    value: "accounts",
    label: "Contas",
    description: "Saldos, bancos e carteiras do dia a dia.",
    icon: Landmark
  },
  {
    value: "cards",
    label: "Cartões",
    description: "Limites, faturas e ciclos de pagamento.",
    icon: CreditCard
  },
  {
    value: "benefits",
    label: "Vale alimentação",
    description: "Carteira alimentar, recargas e consumo.",
    icon: Utensils
  }
] as const;

type WalletView = (typeof walletViews)[number]["value"];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeWalletView(value: string | string[] | undefined): WalletView {
  const next = firstParam(value);
  return walletViews.some((item) => item.value === next) ? (next as WalletView) : "accounts";
}

function walletHref(view: WalletView, month: string | undefined) {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (view !== "accounts") params.set("view", view);
  const query = params.toString();
  return (query ? `/dashboard/accounts?${query}` : "/dashboard/accounts") as Route;
}

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  await requireEndUserDashboardPageUser();
  const params = searchParams ? await searchParams : undefined;
  const activeView = normalizeWalletView(params?.view);
  const month = firstParam(params?.month);
  const switcherItems = walletViews.map((item) => ({
    ...item,
    href: walletHref(item.value, month)
  }));

  return (
    <div className="space-y-6">
      <section className="surface content-section">
        <div className="eyebrow">Carteira</div>
        <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight">Contas, cartões e vale</h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-[var(--color-muted-foreground)]">
          Uma área única para organizar dinheiro disponível, crédito e vale alimentação sem misturar os fluxos.
        </p>

        <ModuleSwitcher activeValue={activeView} items={switcherItems} label="Alternar area da carteira" />
      </section>

      {activeView === "accounts" ? <AccountsClient /> : null}
      {activeView === "cards" ? <CardsClient /> : null}
      {activeView === "benefits" ? <BenefitFoodClient /> : null}
    </div>
  );
}
