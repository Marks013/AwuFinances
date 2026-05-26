import "dotenv/config";

import { TransactionSource, TransactionType } from "@prisma/client";

import { processIncomingWhatsAppTextMessage } from "../lib/whatsapp/assistant";
import { prisma } from "../lib/prisma/client";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || "admin@awu-finances.local";
  const admin = await prisma.user.findFirst({
    where: {
      email: {
        equals: adminEmail,
        mode: "insensitive"
      }
    }
  });

  if (!admin) {
    throw new Error(`Admin user not found for ${adminEmail}.`);
  }

  const originalWhatsApp = admin.whatsappNumber;
  const testPhone = "5511999999998";
  const tempCardId = "smoke-whatsapp-card";
  const tempCardTxId = "smoke-whatsapp-card-transaction";
  const smokeRunKey = `smoke-${Date.now()}`;
  const smokeStartedAt = new Date();
  const smokeExpenseDescription = `mercado ${smokeRunKey}`;
  const smokeIncomeDescription = `salario ${smokeRunKey}`;
  let tempAccountId: string | null = null;
  let createdTempAccount = false;

  try {
    await prisma.user.update({
      where: {
        id: admin.id
      },
      data: {
        whatsappNumber: testPhone
      }
    });

    let account = await prisma.financialAccount.findFirst({
      where: {
        tenantId: admin.tenantId,
        ownerUserId: admin.id,
        isActive: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    if (!account) {
      account = await prisma.financialAccount.create({
        data: {
          tenantId: admin.tenantId,
          ownerUserId: admin.id,
          name: "Conta Smoke",
          type: "checking",
          openingBalance: 5000,
          currency: "BRL",
          color: "#2f8d68",
          isActive: true
        }
      });
      createdTempAccount = true;
    }

    tempAccountId = account.id;

    await prisma.card.upsert({
      where: {
        id: tempCardId
      },
      update: {
        tenantId: admin.tenantId,
        ownerUserId: admin.id,
        name: "Cartao Smoke",
        brand: "Visa",
        last4: "4455",
        limitAmount: 2000,
        dueDay: 10,
        closeDay: 3,
        color: "#243039",
        isActive: true
      },
      create: {
        id: tempCardId,
        tenantId: admin.tenantId,
        ownerUserId: admin.id,
        name: "Cartao Smoke",
        brand: "Visa",
        last4: "4455",
        limitAmount: 2000,
        dueDay: 10,
        closeDay: 3,
        color: "#243039",
        isActive: true
      }
    });

    await prisma.transaction.upsert({
      where: {
        id: tempCardTxId
      },
      update: {
        tenantId: admin.tenantId,
        userId: admin.id,
        cardId: tempCardId,
        date: new Date(),
        amount: 180.9,
        description: "Compra smoke cartao",
        type: TransactionType.expense,
        source: TransactionSource.manual,
        paymentMethod: "credit_card"
      },
      create: {
        id: tempCardTxId,
        tenantId: admin.tenantId,
        userId: admin.id,
        cardId: tempCardId,
        date: new Date(),
        amount: 180.9,
        description: "Compra smoke cartao",
        type: TransactionType.expense,
        source: TransactionSource.manual,
        paymentMethod: "credit_card"
      }
    });

    const saldo = await processIncomingWhatsAppTextMessage({
      phoneNumber: testPhone,
      body: "saldo"
    });

    const incompleteExpense = await processIncomingWhatsAppTextMessage({
      phoneNumber: testPhone,
      body: `Lançar coca-cola ${smokeRunKey} a R$ 15,00`
    });

    if (
      !incompleteExpense.response.includes("Qual forma de pagamento foi") ||
      !incompleteExpense.response.includes("Cartao Smoke") ||
      !incompleteExpense.response.includes(account.name)
    ) {
      throw new Error(`Resposta de forma de pagamento incompleta: ${incompleteExpense.response}`);
    }

    const expense = await processIncomingWhatsAppTextMessage({
      phoneNumber: testPhone,
      body: `gastei 42,50 ${smokeExpenseDescription} na ${account.name}`
    });

    const income = await processIncomingWhatsAppTextMessage({
      phoneNumber: testPhone,
      body: `recebi 1500 ${smokeIncomeDescription} no ${account.name}`
    });

    const card = await processIncomingWhatsAppTextMessage({
      phoneNumber: testPhone,
      body: "fatura cartao smoke"
    });

    console.log(
      JSON.stringify(
        {
          saldo: saldo.response,
          incompleteExpense: incompleteExpense.response,
          expense: expense.response,
          income: income.response,
          card: card.response
        },
        null,
        2
      )
    );
  } finally {
    const deleteSmokeTransactions = async () => {
      const createdTransactions = await prisma.transaction.findMany({
        where: {
          tenantId: admin.tenantId,
          userId: admin.id,
          source: TransactionSource.whatsapp,
          createdAt: {
            gte: smokeStartedAt
          }
        },
        select: {
          id: true,
          description: true
        }
      });

      const ids = [
        tempCardTxId,
        ...createdTransactions
          .filter((transaction) => transaction.description.toLowerCase().includes(smokeRunKey))
          .map((transaction) => transaction.id)
      ].filter(Boolean);

      if (ids.length > 0) {
        await prisma.transaction.deleteMany({
          where: {
            id: {
              in: ids
            }
          }
        });
      }
    };

    await prisma.whatsAppMessage.deleteMany({
      where: {
        phoneNumber: testPhone
      }
    });

    await deleteSmokeTransactions();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await deleteSmokeTransactions();

    await prisma.card.deleteMany({
      where: {
        id: tempCardId
      }
    });

    if (createdTempAccount && tempAccountId) {
      await prisma.financialAccount.deleteMany({
        where: {
          id: tempAccountId
        }
      });
    }

    await prisma.user.update({
      where: {
        id: admin.id
      },
      data: {
        whatsappNumber: originalWhatsApp
      }
    });

    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
