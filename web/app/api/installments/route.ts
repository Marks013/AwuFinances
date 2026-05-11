import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/session";
import { ensureTenantCardStatementSnapshots } from "@/lib/cards/snapshot-sync";
import { captureRequestError } from "@/lib/observability/sentry";
import { prisma } from "@/lib/prisma/client";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();
    await ensureTenantCardStatementSnapshots(user.tenantId);
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const filterStart = from ? new Date(`${from}T00:00:00`) : null;
    const filterEnd = to ? new Date(`${to}T23:59:59`) : null;
    const fromMonth = from?.slice(0, 7) ?? null;
    const toMonth = to?.slice(0, 7) ?? null;
    const groupWhere: Prisma.TransactionWhereInput = {
      tenantId: user.tenantId,
      installmentsTotal: {
        gt: 1
      },
      ...(cardId ? { cardId } : {})
    };

    if (filterStart || filterEnd) {
      const statementDueDate: Prisma.DateTimeFilter = {};
      const competence: Prisma.StringFilter = {};

      if (filterStart) {
        statementDueDate.gte = filterStart;
      }

      if (filterEnd) {
        statementDueDate.lte = filterEnd;
      }

      if (fromMonth) {
        competence.gte = fromMonth;
      }

      if (toMonth) {
        competence.lte = toMonth;
      }

      groupWhere.AND = [
        {
          OR: [
            {
              cardId: {
                not: null
              },
              statementDueDate
            },
            {
              cardId: {
                not: null
              },
              statementDueDate: null,
              competence
            },
            {
              cardId: null,
              competence
            }
          ]
        }
      ];
    }

    const filteredInstallments = await prisma.transaction.findMany({
      where: groupWhere,
      select: {
        id: true,
        parentId: true
      }
    });

    const rootIds = Array.from(
      new Set(filteredInstallments.map((item) => item.parentId ?? item.id))
    );

    const roots =
      rootIds.length > 0
        ? await prisma.transaction.findMany({
            where: {
              tenantId: user.tenantId,
              id: {
                in: rootIds
              },
              parentId: null
            },
            include: {
              card: true,
              category: true
            },
            orderBy: {
              date: "desc"
            }
          })
        : [];

    const groups = await Promise.all(
      roots.map(async (root) => {
        const installments = await prisma.transaction.findMany({
          where: {
            tenantId: user.tenantId,
            OR: [{ id: root.id }, { parentId: root.id }]
          },
          orderBy: {
            installmentNumber: "asc"
          }
        });

        const today = new Date();
        const totalAmount = installments.reduce((sum, item) => sum + Number(item.amount), 0);
        const settledInstallments = installments.filter((item) => item.settledAt).length;
        const overdueOpenInstallments = installments.filter((item) => item.date <= today && !item.settledAt).length;
        const nextInstallment = installments.find((item) => !item.settledAt && item.date > today) ?? null;

        return {
          id: root.id,
          description: root.description.replace(/\s\(\d+\/\d+\)$/, ""),
          totalAmount,
          installmentAmount: installments[0] ? Number(installments[0].amount) : 0,
          installmentsTotal: root.installmentsTotal,
          installmentsPaid: settledInstallments,
          installmentsRemaining: root.installmentsTotal - settledInstallments,
          overdueOpenInstallments,
          nextInstallmentDate: nextInstallment?.date.toISOString() ?? null,
          periodDates: installments.map((item) => {
            const periodDate =
              item.cardId && item.statementDueDate
                ? item.statementDueDate
                : new Date(`${item.competence}-01T12:00:00`);
            return periodDate.toISOString();
          }),
          card: root.card ? { id: root.card.id, name: root.card.name } : null,
          category: root.category ? { id: root.category.id, name: root.category.name } : null,
          notes: root.notes
        };
      })
    );

    const filteredGroups =
      filterStart || filterEnd
        ? groups.filter((group) => {
            return group.periodDates.some((periodDateValue) => {
              const periodDate = new Date(periodDateValue);

              if (filterStart && periodDate < filterStart) {
                return false;
              }

              if (filterEnd && periodDate > filterEnd) {
                return false;
              }

              return true;
            });
          })
        : groups;

    return NextResponse.json({
      items: filteredGroups.map((group) => {
        const { periodDates, ...sanitizedGroup } = group;
        void periodDates;
        return sanitizedGroup;
      })
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    captureRequestError(error, { request, feature: "installments" });
    return NextResponse.json({ message: "Failed to load installments" }, { status: 500 });
  }
}
