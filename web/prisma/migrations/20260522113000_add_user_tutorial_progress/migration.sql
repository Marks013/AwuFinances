CREATE TABLE "UserTutorialProgress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tourKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentStepKey" TEXT,
    "completedStepKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "skippedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTutorialProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserTutorialProgress_userId_tourKey_key" ON "UserTutorialProgress"("userId", "tourKey");
CREATE INDEX "UserTutorialProgress_tenantId_tourKey_status_idx" ON "UserTutorialProgress"("tenantId", "tourKey", "status");

ALTER TABLE "UserTutorialProgress" ADD CONSTRAINT "UserTutorialProgress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserTutorialProgress" ADD CONSTRAINT "UserTutorialProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
