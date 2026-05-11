import type { Prisma } from "@prisma/client";

import { getMonthRange } from "@/lib/month";

export function getCardAwareMonthTransactionFilter(month: string): Prisma.TransactionWhereInput {
  const range = getMonthRange(month);

  return {
    OR: [
      {
        cardId: {
          not: null
        },
        statementDueDate: {
          gte: range.start,
          lte: range.end
        }
      },
      {
        cardId: {
          not: null
        },
        statementDueDate: null,
        competence: month
      },
      {
        cardId: null,
        competence: month
      }
    ]
  };
}
