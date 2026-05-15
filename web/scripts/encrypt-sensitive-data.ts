import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../.env"), override: false });
loadEnv({ path: resolve(process.cwd(), ".env"), override: false });

const dryRun = process.argv.includes("--dry-run");

let prisma: (typeof import("@/lib/prisma/client"))["prisma"] | undefined;

function log(message: string) {
  console.log(`[encrypt-sensitive-data] ${message}`);
}

function getPrisma() {
  if (!prisma) {
    throw new Error("Prisma client was not initialized.");
  }

  return prisma;
}

async function encryptTransactions() {
  const db = getPrisma();
  const rows = await db.transaction.findMany({
    select: {
      id: true,
      description: true,
      notes: true,
      classificationKeyword: true,
      classificationReason: true,
      updatedAt: true
    }
  });

  if (dryRun) {
    return rows.length;
  }

  for (const row of rows) {
    await db.transaction.update({
      where: { id: row.id },
      data: {
        description: row.description,
        notes: row.notes,
        classificationKeyword: row.classificationKeyword,
        classificationReason: row.classificationReason,
        updatedAt: row.updatedAt
      }
    });
  }

  return rows.length;
}

async function encryptWhatsAppMessages() {
  const db = getPrisma();
  const rows = await db.whatsAppMessage.findMany({
    select: {
      id: true,
      body: true,
      response: true
    }
  });

  if (dryRun) {
    return rows.length;
  }

  for (const row of rows) {
    await db.whatsAppMessage.update({
      where: { id: row.id },
      data: {
        body: row.body,
        response: row.response
      }
    });
  }

  return rows.length;
}

async function encryptNotificationDeliveries() {
  const db = getPrisma();
  const rows = await db.notificationDelivery.findMany({
    select: {
      id: true,
      target: true,
      subject: true,
      message: true,
      errorMessage: true
    }
  });

  if (dryRun) {
    return rows.length;
  }

  for (const row of rows) {
    await db.notificationDelivery.update({
      where: { id: row.id },
      data: {
        target: row.target,
        subject: row.subject,
        message: row.message,
        errorMessage: row.errorMessage
      }
    });
  }

  return rows.length;
}

async function main() {
  const prismaModule = await import("@/lib/prisma/client");
  const encryptionModule = await import("@/lib/security/data-encryption");

  prisma = prismaModule.prisma;
  const { isDataEncryptionConfigured, requireDataEncryptionKey } = encryptionModule;

  requireDataEncryptionKey();

  if (!isDataEncryptionConfigured()) {
    throw new Error("DATA_ENCRYPTION_KEY is not configured.");
  }

  if (dryRun) {
    log("dry-run enabled; no records will be changed.");
  }

  const [transactions, whatsAppMessages, notificationDeliveries] = await Promise.all([
    encryptTransactions(),
    encryptWhatsAppMessages(),
    encryptNotificationDeliveries()
  ]);

  log(`transactions processed: ${transactions}`);
  log(`whatsapp messages processed: ${whatsAppMessages}`);
  log(`notification deliveries processed: ${notificationDeliveries}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
