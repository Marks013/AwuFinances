import type { Route } from "next";
import Link from "next/link";
import type { ComponentType, CSSProperties } from "react";

import { cn } from "@/lib/utils";

export type ModuleSwitcherItem = {
  description: string;
  href: Route;
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
};

type ModuleSwitcherProps = {
  activeValue: string;
  items: ModuleSwitcherItem[];
  label: string;
};

export function ModuleSwitcher({ activeValue, items, label }: ModuleSwitcherProps) {
  return (
    <nav aria-label={label} className="mt-6">
      <div className="grid gap-3 rounded-[1.35rem] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-muted)_34%,transparent)] p-2 sm:grid-cols-2 xl:grid-cols-[repeat(var(--module-switcher-columns),minmax(0,1fr))]" style={{ "--module-switcher-columns": items.length } as CSSProperties}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeValue === item.value;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex min-w-0 items-center gap-3 rounded-[1.1rem] border px-4 py-4 text-left transition duration-200",
                active
                  ? "border-[rgba(19,111,79,0.42)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-sm"
                  : "border-transparent bg-[var(--color-card)] text-[var(--color-foreground)] hover:border-[rgba(19,111,79,0.22)] hover:bg-[color-mix(in_srgb,var(--color-card)_82%,var(--color-muted))]"
              )}
              href={item.href}
              key={item.value}
            >
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-[1rem] border transition",
                  active
                    ? "border-white/24 bg-white/16 text-[var(--color-primary-foreground)]"
                    : "border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-muted)_42%,transparent)] text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-primary-foreground)]"
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold">{item.label}</span>
                  {active ? (
                    <span className="rounded-full border border-white/24 bg-white/14 px-2 py-0.5 text-[0.68rem] font-semibold">
                      Selecionado
                    </span>
                  ) : null}
                </span>
                <span className={cn("mt-1 line-clamp-2 text-xs leading-5", active ? "text-white/78" : "text-[var(--color-muted-foreground)]")}>
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
