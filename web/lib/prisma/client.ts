import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { dataProtectionExtension } from "@/lib/prisma/data-protection-extension";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const adapter = new PrismaPg({
  connectionString
});

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  }).$extends(dataProtectionExtension);

  return client as unknown as PrismaClient;
}

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
