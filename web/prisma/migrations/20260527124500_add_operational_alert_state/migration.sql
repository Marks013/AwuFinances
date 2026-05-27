CREATE TABLE "OperationalAlertState" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "consecutiveCount" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lastDeliveredAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "lastPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalAlertState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationalAlertState_fingerprint_key" ON "OperationalAlertState"("fingerprint");
CREATE INDEX "OperationalAlertState_service_type_idx" ON "OperationalAlertState"("service", "type");
CREATE INDEX "OperationalAlertState_severity_status_idx" ON "OperationalAlertState"("severity", "status");
CREATE INDEX "OperationalAlertState_lastSeenAt_idx" ON "OperationalAlertState"("lastSeenAt");
