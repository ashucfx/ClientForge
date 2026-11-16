-- Additive production migration: stores incomplete invoice form snapshots
-- separately from Invoice. It does not alter Invoice rows, statuses, or payment flows.
CREATE TABLE "InvoiceDraft" (
  "id" TEXT NOT NULL,
  "draftNumber" TEXT NOT NULL,
  "brandId" TEXT NOT NULL DEFAULT 'catalyst',
  "clientId" TEXT,
  "clientName" TEXT,
  "clientEmail" TEXT,
  "payload" JSONB NOT NULL,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceDraft_draftNumber_key" ON "InvoiceDraft"("draftNumber");
CREATE INDEX "InvoiceDraft_brandId_updatedAt_idx" ON "InvoiceDraft"("brandId", "updatedAt");
CREATE INDEX "InvoiceDraft_clientId_idx" ON "InvoiceDraft"("clientId");
CREATE INDEX "InvoiceDraft_clientEmail_idx" ON "InvoiceDraft"("clientEmail");
