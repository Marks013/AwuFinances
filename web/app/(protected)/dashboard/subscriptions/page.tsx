import type { Route } from "next";
import { RefreshCcw, Split } from "lucide-react";

import { ModuleSwitcher } from "@/components/navigation/module-switcher";
import { requireEndUserDashboardPageUser } from "@/lib/auth/session";
import { InstallmentsClient } from "@/features/installments/components/installments-client";
import { SubscriptionsClient } from "@/features/subscriptions/components/subscriptions-client";

type SubscriptionsPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
    view?: string | string[];
  }>;
};

const recurringViews = [
  {
    value: "subscriptions",
    label: "Recorrências",
    description: "Assinaturas, receitas fixas e cobranças mensais.",
    icon: RefreshCcw
  },
  {
    value: "installments",
    label: "Parcelas",
    description: "Compras parceladas, vencidas e saldo restante.",
    icon: Split
  }
] as const;

type RecurringView = (typeof recurringViews)[number]["value"];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeRecurringView(value: string | string[] | undefined): RecurringView {
  const next = firstParam(value);
  return recurringViews.some((item) => item.value === next) ? (next as RecurringView) : "subscriptions";
}

function recurringHref(view: RecurringView, month: string | undefined) {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (view !== "subscriptions") params.set("view", view);
  const query = params.toString();
  return (query ? `/dashboard/subscriptions?${query}` : "/dashboard/subscriptions") as Route;
}

export default async function SubscriptionsPage({ searchParams }: SubscriptionsPageProps) {
  await requireEndUserDashboardPageUser();
  const params = searchParams ? await searchParams : undefined;
  const activeView = normalizeRecurringView(params?.view);
  const month = firstParam(params?.month);
  const switcherItems = recurringViews.map((item) => ({
    ...item,
    href: recurringHref(item.value, month)
  }));

  return (
    <div className="space-y-6">
      <section className="surface content-section">
        <div className="eyebrow">Recorrências</div>
        <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight">Recorrências e parcelas</h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-[var(--color-muted-foreground)]">
          Uma área única para acompanhar compromissos fixos e compras parceladas sem transformar tudo em uma lista longa.
        </p>

        <ModuleSwitcher activeValue={activeView} items={switcherItems} label="Alternar area de recorrencias" />
      </section>

      {activeView === "subscriptions" ? <SubscriptionsClient /> : null}
      {activeView === "installments" ? <InstallmentsClient /> : null}
    </div>
  );
}
