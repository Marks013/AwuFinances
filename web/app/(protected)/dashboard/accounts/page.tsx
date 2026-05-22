import Link from "next/link";
import type { Route } from "next";

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
    description: "Saldos, bancos e carteiras do dia a dia."
  },
  {
    value: "cards",
    label: "Cartões",
    description: "Limites, faturas e ciclos de pagamento."
  },
  {
    value: "benefits",
    label: "Vale alimentação",
    description: "Carteira alimentar, recargas e consumo."
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
  const activeViewCopy = walletViews.find((item) => item.value === activeView)?.description;

  return (
    <div className="space-y-6">
      <section className="surface content-section">
        <div className="eyebrow">Carteira</div>
        <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight">Contas, cartões e vale</h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-[var(--color-muted-foreground)]">
          Uma área única para organizar dinheiro disponível, crédito e vale alimentação sem misturar os fluxos.
        </p>

        <div className="mt-6 grid gap-2 rounded-[1.2rem] border border-[var(--color-border)] bg-[var(--color-muted)]/18 p-2 md:grid-cols-3">
          {walletViews.map((item) => {
            const active = activeView === item.value;

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-[1rem] border border-[rgba(19,111,79,0.24)] bg-[var(--color-card)] px-4 py-3 text-sm shadow-sm"
                    : "rounded-[1rem] px-4 py-3 text-sm text-[var(--color-muted-foreground)] transition hover:bg-[var(--color-card)]"
                }
                href={walletHref(item.value, month)}
                key={item.value}
              >
                <span className="block font-semibold text-[var(--color-foreground)]">{item.label}</span>
                <span className="mt-1 block text-pretty text-xs leading-5">{item.description}</span>
              </Link>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">{activeViewCopy}</p>
      </section>

      {activeView === "accounts" ? <AccountsClient /> : null}
      {activeView === "cards" ? <CardsClient /> : null}
      {activeView === "benefits" ? <BenefitFoodClient /> : null}
    </div>
  );
}
