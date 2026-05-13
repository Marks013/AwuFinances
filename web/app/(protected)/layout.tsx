import type { ReactNode } from "react";
import { headers } from "next/headers";
import { after } from "next/server";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCurrentTenantAccess } from "@/lib/auth/session";
import { syncDueSubscriptionTransactions } from "@/lib/automation/subscriptions";
import { isAuthError } from "@/lib/observability/errors";
import { captureUnexpectedError } from "@/lib/observability/sentry";
import { sanitizeSearch } from "@/lib/security/sensitive-url";

type ProtectedLayoutProps = {
  children: ReactNode;
};

const PATHNAME_HEADER = "x-awu-finances-pathname";
const SEARCH_HEADER = "x-awu-finances-search";

function isNextRedirectError(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT");
}

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  try {
    const requestHeaders = await headers();
    const pathname = requestHeaders.get(PATHNAME_HEADER);
    const search = sanitizeSearch(requestHeaders.get(SEARCH_HEADER)) ?? "";
    const access = await getCurrentTenantAccess({
      allowBlocked: true
    });

    if (!access.license.canAccessApp) {
      redirect(`/license?reason=${access.blockedReason ?? "expired"}`);
    }

    if (access.isPlatformAdmin && pathname?.startsWith("/dashboard")) {
      const isAdminRoute = pathname === "/dashboard/admin" || pathname?.startsWith("/dashboard/admin/");

      if (isAdminRoute && new URLSearchParams(search).has("month")) {
        redirect(pathname as Parameters<typeof redirect>[0]);
      }

      if (!isAdminRoute) {
        redirect("/dashboard/admin");
      }
    }

    if (!access.isPlatformAdmin && access.license.features.automation) {
      const syncContext = {
        tenantId: access.tenantId,
        userId: access.id,
        role: access.role,
        isPlatformAdmin: access.isPlatformAdmin
      };

      after(async () => {
        await syncDueSubscriptionTransactions({
          tenantId: syncContext.tenantId,
          userId: syncContext.userId
        }).catch((error) =>
          captureUnexpectedError(error, {
            surface: "layout",
            route: "/dashboard",
            operation: "sync",
            feature: "subscriptions",
            tenantId: syncContext.tenantId,
            userId: syncContext.userId,
            role: syncContext.role,
            isPlatformAdmin: syncContext.isPlatformAdmin
          })
        );
      });
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    if (isAuthError(error)) {
      redirect("/login");
    }

    captureUnexpectedError(error, {
      surface: "layout",
      route: "/dashboard",
      operation: "access",
      feature: "protected-layout"
    });
    throw error;
  }

  const requestHeaders = await headers();
  const currentPathname = requestHeaders.get(PATHNAME_HEADER);

  return <DashboardShell currentPathname={currentPathname}>{children}</DashboardShell>;
}
