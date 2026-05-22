"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  ChartColumnBig,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FolderTree,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  ReceiptText,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Split,
  Target,
  MessageCircleMore,
  Wallet,
  UsersRound
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { addMonthsToMonthKey, formatMonthKeyLabel, getCurrentMonthKey, isValidMonthKey, normalizeMonthKey } from "@/lib/month";
import { cn } from "@/lib/utils";

const primaryNavigation = [
  { href: "/dashboard" as Route, label: "Painel", icon: LayoutDashboard },
  { href: "/dashboard/transactions" as Route, label: "Transações", icon: ReceiptText },
  { href: "/dashboard/accounts" as Route, label: "Carteira", icon: Landmark },
  { href: "/dashboard/reports" as Route, label: "Relatórios", icon: ChartColumnBig },
  { href: "/dashboard/subscriptions" as Route, label: "Recorrências", icon: RefreshCcw },
  { href: "/dashboard/settings" as Route, label: "Ajustes", icon: Settings }
];

const secondaryNavigation = [
  { href: "/dashboard/cards" as Route, label: "Cartões", icon: CreditCard },
  { href: "/dashboard/benefits" as Route, label: "Vale Alimentação", icon: Wallet },
  { href: "/dashboard/categories" as Route, label: "Categorias", icon: FolderTree },
  { href: "/dashboard/installments" as Route, label: "Parcelas", icon: Split },
  { href: "/dashboard/goals" as Route, label: "Metas", icon: Target },
  { href: "/dashboard/whatsapp" as Route, label: "WhatsApp", icon: MessageCircleMore },
  { href: "/dashboard/support" as Route, label: "Suporte", icon: LifeBuoy }
];

const platformAdminNavigation = [
  { href: "/dashboard/admin" as Route, label: "Admin", icon: ShieldCheck },
  { href: "/dashboard/admin/support" as Route, label: "Suporte", icon: LifeBuoy }
];

type DashboardSidebarNavProps = {
  canManageSharing: boolean;
  compact?: boolean;
  isPlatformAdmin: boolean;
};

export function DashboardSidebarNav({ canManageSharing, compact = false, isPlatformAdmin }: DashboardSidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const month = normalizeMonthKey(searchParams.get("month"));
  const monthInputId = compact ? "global-month-compact" : "global-month";
  const [draftMonthState, setDraftMonthState] = useState({ sourceMonth: month, value: month });
  const draftMonth = draftMonthState.sourceMonth === month ? draftMonthState.value : month;
  const [isPending, startTransition] = useTransition();
  const primaryItems = isPlatformAdmin ? platformAdminNavigation : primaryNavigation;
  const secondaryItems = isPlatformAdmin
    ? []
    : [
        ...secondaryNavigation,
        ...(canManageSharing ? [{ href: "/dashboard/sharing" as Route, label: "Compartilhar carteira", icon: UsersRound }] : [])
      ];

  const buildMonthRoute = useCallback(
    (nextMonth: string) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("month", nextMonth || getCurrentMonthKey());
      const query = nextParams.toString();

      return `${pathname}${query ? `?${query}` : ""}` as Route;
    },
    [pathname, searchParams]
  );

  const commitMonth = useCallback(
    (nextMonth: string) => {
      if (!isValidMonthKey(nextMonth)) {
        setDraftMonthState({ sourceMonth: month, value: month });
        return;
      }

      const normalizedMonth = normalizeMonthKey(nextMonth);
      setDraftMonthState({ sourceMonth: normalizedMonth, value: normalizedMonth });

      startTransition(() => {
        router.replace(buildMonthRoute(normalizedMonth), { scroll: false });
      });
    },
    [buildMonthRoute, month, router]
  );

  useEffect(() => {
    if (isPlatformAdmin) {
      return;
    }

    if (searchParams.get("month")) {
      return;
    }

    router.replace(buildMonthRoute(getCurrentMonthKey()), { scroll: false });
  }, [buildMonthRoute, isPlatformAdmin, router, searchParams]);

  return (
    <>
      {isPlatformAdmin ? null : (
        <section
          className={cn(
            "mb-5 rounded-[22px] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-muted)_48%,var(--color-card))] p-3.5",
            compact && "mb-3 rounded-[18px] p-3"
          )}
        >
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-foreground)]">
            Mês de análise
          </p>
          <p aria-live="polite" className="mt-1 text-sm font-semibold leading-5 text-[var(--color-foreground)]">
            {formatMonthKeyLabel(month)}
          </p>

          {compact ? null : (
            <p className="mt-2 text-xs leading-5 text-[var(--color-muted-foreground)]">
              Usa o mesmo mês em painel, transações, assinaturas, parcelas e relatórios.
            </p>
          )}

          <div className="mt-3 grid gap-2">
            <DatePickerInput
              aria-label="Selecionar competência global"
              className="h-11 w-full min-w-0 px-3 text-center text-[0.9rem]"
              disabled={isPending}
              displayAlign="center"
              id={monthInputId}
              monthDisplayMode="compact"
              type="month"
              value={draftMonth}
              onBlur={() => {
                if (!isValidMonthKey(draftMonth)) {
                  setDraftMonthState({ sourceMonth: month, value: month });
                }
              }}
              onChange={(event) => {
                const nextMonth = event.target.value;
                setDraftMonthState({ sourceMonth: month, value: nextMonth });

                if (isValidMonthKey(nextMonth)) {
                  commitMonth(nextMonth);
                }
              }}
            />

            <div className="grid grid-cols-2 gap-2">
              <Button
                aria-label="Competência anterior"
                className="h-10 rounded-[1rem] px-0"
                disabled={isPending}
                type="button"
                variant="secondary"
                onClick={() => {
                  commitMonth(addMonthsToMonthKey(month, -1));
                }}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                aria-label="Próxima competência"
                className="h-10 rounded-[1rem] px-0"
                disabled={isPending}
                type="button"
                variant="secondary"
                onClick={() => {
                  commitMonth(addMonthsToMonthKey(month, 1));
                }}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </section>
      )}

      <div className={cn("mb-3 flex items-center justify-between gap-3 px-1", compact && "mb-2")}>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted-foreground)]">
          Navegação
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {isPlatformAdmin ? "Administração da plataforma" : "Rotina financeira"}
        </p>
      </div>

      <nav className="space-y-2">
        <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 lg:block lg:space-y-2", compact && "gap-1.5")}>
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                className={cn(
                  "group flex min-w-0 items-center gap-2 rounded-[1.15rem] border border-transparent px-3 py-3 text-sm font-medium leading-5 text-[var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(19,111,79,0.14)] hover:bg-[color-mix(in_srgb,var(--color-card)_82%,var(--color-muted))] sm:gap-3 sm:px-3.5",
                  compact && "rounded-[0.95rem] px-2.5 py-2.5 text-[0.82rem]",
                  isActive && "border-[rgba(19,111,79,0.18)] bg-[color-mix(in_srgb,var(--color-card)_82%,var(--color-muted))]"
                )}
                href={isPlatformAdmin ? item.href : (`${item.href}?month=${month}` as Route)}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-[0.9rem] bg-[color-mix(in_srgb,var(--color-card)_84%,var(--color-muted))] text-[var(--color-primary)] transition group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-primary-foreground)]",
                    compact && "size-7 rounded-[0.75rem]",
                    isActive && "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {secondaryItems.length > 0 ? (
          <details
            className="rounded-[1.15rem] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-muted)_28%,transparent)]"
            open={
              secondaryItems.some(
                (item) => pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}/`))
              ) || undefined
            }
          >
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)] [&::-webkit-details-marker]:hidden">
              <span>Mais módulos</span>
              <span aria-hidden="true">+</span>
            </summary>
            <div className={cn("grid grid-cols-2 gap-1.5 border-t border-[var(--color-border)] p-2 sm:grid-cols-3 lg:block lg:space-y-1", compact && "gap-1")}>
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.href}
                    className={cn(
                      "group flex min-w-0 items-center gap-2 rounded-[0.9rem] border border-transparent px-2.5 py-2 text-xs font-medium leading-5 text-[var(--color-foreground)] transition-all duration-200 hover:border-[rgba(19,111,79,0.14)] hover:bg-[color-mix(in_srgb,var(--color-card)_82%,var(--color-muted))]",
                      isActive && "border-[rgba(19,111,79,0.18)] bg-[color-mix(in_srgb,var(--color-card)_82%,var(--color-muted))]"
                    )}
                    href={`${item.href}?month=${month}` as Route}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-[0.75rem] bg-[color-mix(in_srgb,var(--color-card)_84%,var(--color-muted))] text-[var(--color-primary)] transition group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-primary-foreground)]",
                        isActive && "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </details>
        ) : null}
      </nav>
    </>
  );
}
