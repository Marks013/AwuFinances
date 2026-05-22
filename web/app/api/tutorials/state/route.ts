import { NextResponse } from "next/server";

import { DASHBOARD_TUTORIAL_KEY, DASHBOARD_TUTORIAL_VERSION } from "@/features/tutorials/tutorial-catalog";
import { requireSessionUser } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env/server";
import { getWhatsAppChannelHealth } from "@/lib/notifications/channel-health";
import { captureRequestError } from "@/lib/observability/sentry";
import { prisma } from "@/lib/prisma/client";
import { getSharingAuthority } from "@/lib/sharing/access";
import { getAccountPermissionFlags } from "@/lib/users/account-permissions";

const allowedStatuses = new Set(["active", "completed", "skipped"]);

function cleanStepKeys(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 40)
    )
  );
}

async function buildTutorialContext(user: Awaited<ReturnType<typeof requireSessionUser>>) {
  const [sharingAuthority, profile, accountCount, standardAccountCount, benefitFoodAccountCount, cardCount, expenseCategoryCount, incomeCategoryCount, subscriptionCount, transactionCount, installmentCount] =
    await Promise.all([
      getSharingAuthority(user),
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          whatsappNumber: true,
          preferences: {
            select: {
              autoTithe: true
            }
          }
        }
      }),
      prisma.financialAccount.count({ where: { tenantId: user.tenantId, isActive: true } }),
      prisma.financialAccount.count({ where: { tenantId: user.tenantId, isActive: true, usage: "standard" } }),
      prisma.financialAccount.count({ where: { tenantId: user.tenantId, isActive: true, usage: "benefit_food" } }),
      prisma.card.count({ where: { tenantId: user.tenantId, isActive: true } }),
      prisma.category.count({ where: { tenantId: user.tenantId, type: "expense" } }),
      prisma.category.count({ where: { tenantId: user.tenantId, type: "income" } }),
      prisma.subscription.count({ where: { tenantId: user.tenantId, isActive: true } }),
      prisma.transaction.count({ where: { tenantId: user.tenantId } }),
      prisma.transaction.count({ where: { tenantId: user.tenantId, installmentsTotal: { gt: 1 }, installmentNumber: 1 } })
    ]);

  const permissions = getAccountPermissionFlags({
    role: user.role,
    isPlatformAdmin: user.isPlatformAdmin,
    canManageSharing: sharingAuthority.canManage
  });
  const whatsappHealth = getWhatsAppChannelHealth();

  return {
    isPlatformAdmin: user.isPlatformAdmin,
    counts: {
      accounts: accountCount,
      standardAccounts: standardAccountCount,
      benefitFoodAccounts: benefitFoodAccountCount,
      cards: cardCount,
      expenseCategories: expenseCategoryCount,
      incomeCategories: incomeCategoryCount,
      subscriptions: subscriptionCount,
      transactions: transactionCount,
      installmentGroups: installmentCount
    },
    permissions: {
      canManageSharing: sharingAuthority.canManage,
      canAccessSharingPage: permissions.canAccessSharingPage,
      canEditAutoTithe: permissions.canEditAutoTithe,
      canEditWhatsAppNumber: permissions.canEditWhatsAppNumber
    },
    license: {
      plan: user.license.plan,
      planLabel: user.license.planLabel,
      status: user.license.status,
      statusLabel: user.license.statusLabel,
      features: user.license.features
    },
    integrations: {
      whatsappAssistantEnabled: serverEnv.WHATSAPP_ASSISTANT_ENABLED === "true",
      whatsappConfigured: whatsappHealth.configured,
      whatsappIssue: whatsappHealth.issue
    },
    profile: {
      whatsappNumberConfigured: Boolean(profile?.whatsappNumber),
      autoTithe: profile?.preferences?.autoTithe ?? false
    }
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();
    const [progress, context] = await Promise.all([
      prisma.userTutorialProgress.findUnique({
        where: {
          userId_tourKey: {
            userId: user.id,
            tourKey: DASHBOARD_TUTORIAL_KEY
          }
        }
      }),
      buildTutorialContext(user)
    ]);

    return NextResponse.json({
      tutorial: {
        key: DASHBOARD_TUTORIAL_KEY,
        version: DASHBOARD_TUTORIAL_VERSION
      },
      progress: progress
        ? {
            status: progress.status,
            currentStepKey: progress.currentStepKey,
            completedStepKeys: progress.completedStepKeys,
            skippedAt: progress.skippedAt?.toISOString() ?? null,
            completedAt: progress.completedAt?.toISOString() ?? null
          }
        : {
            status: "not_started",
            currentStepKey: null,
            completedStepKeys: [],
            skippedAt: null,
            completedAt: null
          },
      context
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    captureRequestError(error, { request, feature: "tutorials" });
    return NextResponse.json({ message: "Failed to load tutorial state" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = (await request.json().catch(() => ({}))) as {
      status?: string;
      currentStepKey?: string | null;
      completedStepKeys?: unknown;
    };
    const status = typeof body.status === "string" && allowedStatuses.has(body.status) ? body.status : "active";
    const completedStepKeys = cleanStepKeys(body.completedStepKeys);
    const currentStepKey = typeof body.currentStepKey === "string" && body.currentStepKey.trim() ? body.currentStepKey.trim() : null;
    const now = new Date();

    const progress = await prisma.userTutorialProgress.upsert({
      where: {
        userId_tourKey: {
          userId: user.id,
          tourKey: DASHBOARD_TUTORIAL_KEY
        }
      },
      create: {
        tenantId: user.tenantId,
        userId: user.id,
        tourKey: DASHBOARD_TUTORIAL_KEY,
        status,
        currentStepKey,
        completedStepKeys,
        version: DASHBOARD_TUTORIAL_VERSION,
        skippedAt: status === "skipped" ? now : null,
        completedAt: status === "completed" ? now : null
      },
      update: {
        tenantId: user.tenantId,
        status,
        currentStepKey,
        completedStepKeys,
        version: DASHBOARD_TUTORIAL_VERSION,
        skippedAt: status === "skipped" ? now : null,
        completedAt: status === "completed" ? now : null
      }
    });

    return NextResponse.json({
      progress: {
        status: progress.status,
        currentStepKey: progress.currentStepKey,
        completedStepKeys: progress.completedStepKeys,
        skippedAt: progress.skippedAt?.toISOString() ?? null,
        completedAt: progress.completedAt?.toISOString() ?? null
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    captureRequestError(error, { request, feature: "tutorials" });
    return NextResponse.json({ message: "Failed to update tutorial state" }, { status: 400 });
  }
}
