import Link from "next/link";
import type { Route } from "next";

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
    description: "Assinaturas, receitas fixas e cobranças mensais."
  },
  {
    value: "installments",
    label: "Parcelas",
    description: "Compras parceladas, vencidas e saldo restante."
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
  const activeViewCopy = recurringViews.find((item) => item.value === activeView)?.description;

  return (
    <div className="space-y-6">
      <section className="surface content-section">
        <div className="eyebrow">Recorrências</div>
        <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight">Recorrências e parcelas</h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-[var(--color-muted-foreground)]">
          Uma área única para acompanhar compromissos fixos e compras parceladas sem transformar tudo em uma lista longa.
        </p>

        <div className="mt-6 grid gap-2 rounded-[1.2rem] border border-[var(--color-border)] bg-[var(--color-muted)]/18 p-2 md:grid-cols-2">
          {recurringViews.map((item) => {
            const active = activeView === item.value;

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-[1rem] border border-[rgba(19,111,79,0.24)] bg-[var(--color-card)] px-4 py-3 text-sm shadow-sm"
                    : "rounded-[1rem] px-4 py-3 text-sm text-[var(--color-muted-foreground)] transition hover:bg-[var(--color-card)]"
                }
                href={recurringHref(item.value, month)}
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

      {activeView === "subscriptions" ? <SubscriptionsClient /> : null}
      {activeView === "installments" ? <InstallmentsClient /> : null}
    </div>
  );
}
