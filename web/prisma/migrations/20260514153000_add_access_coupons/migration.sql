CREATE TYPE "AccessCouponTarget" AS ENUM ('trial', 'subscription');

CREATE TABLE "AccessCoupon" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "target" "AccessCouponTarget" NOT NULL DEFAULT 'trial',
  "days" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "maxRedemptions" INTEGER,
  "maxRedemptionsPerTenant" INTEGER NOT NULL DEFAULT 1,
  "maxRedemptionsPerUser" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccessCoupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessCouponRedemption" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "daysApplied" INTEGER NOT NULL,
  "previousTrialExpiresAt" TIMESTAMP(3),
  "newTrialExpiresAt" TIMESTAMP(3),
  "previousExpiresAt" TIMESTAMP(3),
  "newExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccessCouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccessCoupon_code_key" ON "AccessCoupon"("code");
CREATE INDEX "AccessCoupon_enabled_startsAt_endsAt_idx" ON "AccessCoupon"("enabled", "startsAt", "endsAt");
CREATE INDEX "AccessCoupon_target_enabled_idx" ON "AccessCoupon"("target", "enabled");
CREATE INDEX "AccessCouponRedemption_couponId_createdAt_idx" ON "AccessCouponRedemption"("couponId", "createdAt");
CREATE INDEX "AccessCouponRedemption_tenantId_createdAt_idx" ON "AccessCouponRedemption"("tenantId", "createdAt");
CREATE INDEX "AccessCouponRedemption_userId_createdAt_idx" ON "AccessCouponRedemption"("userId", "createdAt");
CREATE INDEX "AccessCouponRedemption_couponId_tenantId_idx" ON "AccessCouponRedemption"("couponId", "tenantId");

ALTER TABLE "AccessCouponRedemption"
  ADD CONSTRAINT "AccessCouponRedemption_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "AccessCoupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessCouponRedemption"
  ADD CONSTRAINT "AccessCouponRedemption_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessCouponRedemption"
  ADD CONSTRAINT "AccessCouponRedemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
