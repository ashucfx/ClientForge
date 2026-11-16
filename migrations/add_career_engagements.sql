-- Additive re-onboarding storage. Existing CareerClient rows, services,
-- invoices, and payment records are not modified by this migration.
CREATE TABLE "CareerEngagement" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'RE_ONBOARDING',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "previousServices" JSONB NOT NULL,
  "addedServices" JSONB NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareerEngagement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CareerEngagement_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "CareerClient"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CareerEngagement_clientId_sequence_key"
  ON "CareerEngagement"("clientId", "sequence");
CREATE INDEX "CareerEngagement_clientId_updatedAt_idx"
  ON "CareerEngagement"("clientId", "updatedAt");
CREATE INDEX "CareerEngagement_status_updatedAt_idx"
  ON "CareerEngagement"("status", "updatedAt");
