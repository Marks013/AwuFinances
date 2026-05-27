"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/layout/theme-toggle";

export function GlobalThemeToggle() {
  const pathname = usePathname();

  if (pathname.startsWith("/dashboard")) {
    return null;
  }

  const showLogin = !pathname.startsWith("/login");

  return (
    <div className="fixed right-5 top-5 z-[90] flex items-center gap-2 max-[520px]:right-3 max-[520px]:top-3">
      {showLogin ? (
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-card)_92%,var(--color-muted))] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] shadow-[0_18px_38px_rgba(15,23,42,0.16)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)]"
          href="/login"
        >
          Login
        </Link>
      ) : null}
      <ThemeToggle compact />
    </div>
  );
}
