import { Prisma } from "@prisma/client";
import { after, NextResponse } from "next/server";
import { format } from "date-fns";

import { subscriptionFormSchema } from "@/features/subscriptions/schemas/subscription-schema";
import { syncDueSubscriptionTransactions } from "@/lib/automation/subscriptions";
import { requireSessionUser } from "@/lib/auth/session";
import { revalidateFinanceReports } from "@/lib/cache/finance-read-models";
import { buildCardBillingSnapshotForDate } from "@/lib/cards/statement";
import { BenefitWalletRuleError, validateBenefitWalletTransaction } from "@/lib/finance/benefit-wallet";
import { ensureTitheCategory, syncTitheForMonthKeys } from "@/lib/finance/tithe";
import { resolveTransactionClassification } from "@/lib/finance/transaction-classification";
import { assertTenantTransactionReferences, TenantReferenceError } from "@/lib/finance/tenant-reference-guard";
import { captureRequestError, captureUnexpectedError } from "@/lib/observability/sentry";
import { prisma } from "@/lib/prisma/client";
import { advanceSubscriptionBillingDate, isBeforeCurrentSubscriptionMonth } from "@/lib/subscriptions/recurrence";

type Params = {
  params: Promise<{ id: string }>;
};

function getBillingDayFromOccurrenceDate(date: Date) {
  return date.getDate();
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function monthOffsetFromNextBillingDate(nextBillingDate: Date, transactionDate: Date) {
  return (
    (transactionDate.getFullYear() - nextBillingDate.getFullYear()) * 12 +
    (transactionDate.getMonth() - nextBillingDate.getMonth())
  );
}

export async function PATCH(request: Request, context: Params) {
  try {
    const user = await requireSessionUser({ feature: "automation" });
    const { id } = await context.params;
    const body = subscriptionFormSchema.parse(await request.json());
    const nextBillingDate = new Date(`${body.nextBillingDate}T12:00:00`);
    const billingDay = getBillingDayFromOccurrenceDate(nextBillingDate);

    if (isBeforeCurrentSubscriptionMonth(nextBillingDate)) {
      return NextResponse.json(
        { message: "Assinaturas retroativas só podem começar no mês atual. Use uma transação manual para meses anteriores." },
        { status: 400 }
      );
    }

    await assertTenantTransactionReferences({
      tenantId: user.tenantId,
      accountId: body.accountId,
      cardId: body.cardId,
      categoryId: body.categoryId
    });
    await validateBenefitWalletTransaction({
      tenantId: user.tenantId,
      type: body.type,
      paymentMethod: body.cardId ? "credit_card" : "money",
      accountId: body.accountId,
      destinationAccountId: null,
      categoryId: body.categoryId || null,
      cardId: body.cardId
    });

    const classification = await resolveTransactionClassification({
      tenantId: user.tenantId,
      type: body.type,
      description: body.name,
      paymentMethod: body.cardId ? "credit_card" : "money",
      categoryId: body.categoryId || null
    });
    const titheCategoryId = body.type === "income" && body.autoTithe ? await ensureTitheCategory(user.tenantId) : null;
    const selectedCard =
      body.cardId
        ? await prisma.card.findFirst({
            where: {
              id: body.cardId,
              tenantId: user.tenantId,
              isActive: true
            },
            select: {
              id: true,
              closeDay: true,
              dueDay: true,
              statementMonthAnchor: true
            }
          })
        : null;

    if (body.cardId && !selectedCard) {
      return NextResponse.json({ message: "Cartão selecionado não foi encontrado" }, { status: 404 });
    }

    const futureTransactions = await prisma.transaction.findMany({
      where: {
        tenantId: user.tenantId,
        subscriptionId: id,
        date: {
          gte: startOfCurrentMonth()
        },
        settledAt: null
      },
      select: {
        id: true,
        date: true,
        competence: true,
        titheAmount: true
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }]
    });
    const affectedTitheMonths = futureTransactions
      .filter((transaction) => Number(transaction.titheAmount ?? 0) > 0)
      .map((transaction) => transaction.competence);
    const obsoleteFutureTransactions = futureTransactions.filter((transaction) => transaction.date < nextBillingDate);
    const updatableFutureTransactions = futureTransactions.filter((transaction) => transaction.date >= nextBillingDate);

    await prisma.subscription.update({
      where: { id, tenantId: user.tenantId },
      data: {
        name: body.name,
        amount: body.amount,
        billingDay,
        categoryId: classification.categoryId,
        accountId: body.accountId || null,
        cardId: body.cardId || null,
        nextBillingDate,
        type: body.type,
        isActive: body.isActive,
        autoTithe: body.autoTithe && body.type === "income"
      }
    });

    if (obsoleteFutureTransactions.length > 0) {
      await prisma.transaction.deleteMany({
        where: {
          id: {
            in: obsoleteFutureTransactions.map((transaction) => transaction.id)
          }
        }
      });
    }

    for (const transaction of updatableFutureTransactions) {
      const monthOffset = Math.max(0, monthOffsetFromNextBillingDate(nextBillingDate, transaction.date));
      const occurrenceDate = advanceSubscriptionBillingDate(nextBillingDate, billingDay, monthOffset);
      const cardSnapshot = selectedCard
        ? await buildCardBillingSnapshotForDate({
            tenantId: user.tenantId,
            card: selectedCard,
            referenceDate: occurrenceDate,
            client: prisma
          })
        : null;

      await prisma.transaction.update({
        where: {
          id: transaction.id
        },
        data: {
          date: occurrenceDate,
          competence: cardSnapshot?.competence ?? format(occurrenceDate, "yyyy-MM"),
          amount: new Prisma.Decimal(body.amount.toFixed(2)),
          description: `Assinatura: ${body.name}`,
          type: body.type,
          paymentMethod: body.cardId ? "credit_card" : "money",
          categoryId: classification.categoryId,
          accountId: body.cardId ? null : body.accountId || null,
          cardId: body.cardId || null,
          statementCloseDate: cardSnapshot?.closeDate ?? null,
          statementDueDate: cardSnapshot?.dueDate ?? null,
          titheAmount:
            body.type === "income" && body.autoTithe
              ? new Prisma.Decimal((body.amount * 0.1).toFixed(2))
              : null,
          titheCategoryId,
          classificationSource: classification.classificationSource,
          classificationKeyword: classification.classificationKeyword,
          classificationReason: classification.reason,
          classificationVersion: 2,
          aiClassified: classification.aiClassified,
          aiConfidence:
            classification.confidence !== null ? new Prisma.Decimal(classification.confidence.toFixed(2)) : null
        }
      });
    }

    if (affectedTitheMonths.length > 0 || (body.type === "income" && body.autoTithe && updatableFutureTransactions.length > 0)) {
      await syncTitheForMonthKeys({
        tenantId: user.tenantId,
        userId: user.id,
        monthKeys: [
          ...affectedTitheMonths,
          ...updatableFutureTransactions.map((transaction) => {
            const monthOffset = Math.max(0, monthOffsetFromNextBillingDate(nextBillingDate, transaction.date));
            return format(advanceSubscriptionBillingDate(nextBillingDate, billingDay, monthOffset), "yyyy-MM");
          })
        ]
      });
    }
    revalidateFinanceReports(user.tenantId);

    after(async () => {
      await syncDueSubscriptionTransactions({
        tenantId: user.tenantId,
        userId: user.id
      }).catch((error) =>
        captureUnexpectedError(error, {
          surface: "api-post-processing",
          route: `/api/subscriptions/${id}`,
          operation: "PATCH",
          feature: "subscriptions",
          tenantId: user.tenantId,
          userId: user.id,
          entityId: id,
          dedupeKey: `subscriptions:post-update-sync:${id}`
        })
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof TenantReferenceError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (error instanceof BenefitWalletRuleError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    captureRequestError(error, { request, feature: "subscriptions" });
    return NextResponse.json({ message: "Failed to update subscription" }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Params) {
  try {
    const user = await requireSessionUser({ feature: "automation" });
    const { id } = await context.params;

    const subscription = await prisma.subscription.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      },
      select: {
        id: true
      }
    });

    if (!subscription) {
      return NextResponse.json({ message: "Subscription not found" }, { status: 404 });
    }

    const futureTransactions = await prisma.transaction.findMany({
      where: {
        tenantId: user.tenantId,
        subscriptionId: id,
        date: {
          gte: startOfCurrentMonth()
        },
        settledAt: null
      },
      select: {
        id: true,
        competence: true,
        titheAmount: true
      }
    });
    const affectedTitheMonths = futureTransactions
      .filter((transaction) => Number(transaction.titheAmount ?? 0) > 0)
      .map((transaction) => transaction.competence);

    await prisma.$transaction([
      prisma.transaction.deleteMany({
        where: {
          id: {
            in: futureTransactions.map((transaction) => transaction.id)
          }
        }
      }),
      prisma.subscription.update({
        where: {
          id,
          tenantId: user.tenantId
        },
        data: {
          isActive: false
        }
      })
    ]);

    if (affectedTitheMonths.length > 0) {
      await syncTitheForMonthKeys({
        tenantId: user.tenantId,
        userId: user.id,
        monthKeys: affectedTitheMonths
      });
    }
    revalidateFinanceReports(user.tenantId);

    return NextResponse.json({ success: true, deactivated: true, deletedFutureTransactions: futureTransactions.length });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    captureRequestError(error, { request, feature: "subscriptions" });
    return NextResponse.json({ message: "Failed to delete subscription" }, { status: 400 });
  }
}
