-- Prepared migration for audit item #7 — money Float -> Decimal(12,2).
--
-- ⚠️ OPTIONAL / LOWEST PRIORITY / HIGHER RISK. Read RUNBOOK.md §4 before running.
-- The DB change below is safe and lossless (values are already rounded to 2dp on
-- write). The RISK is on the CODE side: once these columns are Decimal, Prisma
-- returns Prisma.Decimal objects instead of numbers, so every arithmetic /
-- .toFixed() / .toLocaleString() call on them must be updated IN THE SAME DEPLOY.
-- Recommendation: defer this and run the read-only reconciliation report first
-- (RUNBOOK.md §5). Only do this migration if you observe real drift.
--
-- USING ROUND(...::numeric, 2) converts existing double-precision values exactly
-- to 2-decimal fixed point. Wrap in a transaction; run on a backup/staging first.

BEGIN;

-- Invoice — amount columns (rates left as-is on purpose; see RUNBOOK §4)
ALTER TABLE "Invoice" ALTER COLUMN "discountAmount"         TYPE DECIMAL(12,2) USING (ROUND("discountAmount"::numeric, 2));
ALTER TABLE "Invoice" ALTER COLUMN "taxAmount"              TYPE DECIMAL(12,2) USING (ROUND("taxAmount"::numeric, 2));
ALTER TABLE "Invoice" ALTER COLUMN "resumeConverted"        TYPE DECIMAL(12,2) USING (ROUND("resumeConverted"::numeric, 2));
ALTER TABLE "Invoice" ALTER COLUMN "linkedinConverted"      TYPE DECIMAL(12,2) USING (ROUND("linkedinConverted"::numeric, 2));
ALTER TABLE "Invoice" ALTER COLUMN "coverLetterConverted"   TYPE DECIMAL(12,2) USING (ROUND("coverLetterConverted"::numeric, 2));
ALTER TABLE "Invoice" ALTER COLUMN "subtotalConverted"      TYPE DECIMAL(12,2) USING (ROUND("subtotalConverted"::numeric, 2));
ALTER TABLE "Invoice" ALTER COLUMN "processingFeeConverted" TYPE DECIMAL(12,2) USING (ROUND("processingFeeConverted"::numeric, 2));
ALTER TABLE "Invoice" ALTER COLUMN "totalPayable"           TYPE DECIMAL(12,2) USING (ROUND("totalPayable"::numeric, 2));
ALTER TABLE "Invoice" ALTER COLUMN "revisionCharge"         TYPE DECIMAL(12,2) USING (ROUND("revisionCharge"::numeric, 2));
ALTER TABLE "Invoice" ALTER COLUMN "localEquivalentAmount"  TYPE DECIMAL(12,2) USING (ROUND("localEquivalentAmount"::numeric, 2));

-- Line items (relational) + installments
ALTER TABLE "InvoiceLineItem"    ALTER COLUMN "unitPrice" TYPE DECIMAL(12,2) USING (ROUND("unitPrice"::numeric, 2));
ALTER TABLE "InvoiceLineItem"    ALTER COLUMN "lineTotal" TYPE DECIMAL(12,2) USING (ROUND("lineTotal"::numeric, 2));
ALTER TABLE "InvoiceInstallment" ALTER COLUMN "amount"    TYPE DECIMAL(12,2) USING (ROUND("amount"::numeric, 2));

-- Career / RN / Proposal amounts
ALTER TABLE "CareerClient"    ALTER COLUMN "amountPaid"     TYPE DECIMAL(12,2) USING (ROUND("amountPaid"::numeric, 2));
ALTER TABLE "RnClient"        ALTER COLUMN "amountPaid"     TYPE DECIMAL(12,2) USING (ROUND("amountPaid"::numeric, 2));
ALTER TABLE "RnServiceModule" ALTER COLUMN "revisionCharge" TYPE DECIMAL(12,2) USING (ROUND("revisionCharge"::numeric, 2));
ALTER TABLE "RnRevision"      ALTER COLUMN "chargeAmount"   TYPE DECIMAL(12,2) USING (ROUND("chargeAmount"::numeric, 2));
ALTER TABLE "Proposal"        ALTER COLUMN "subtotal"       TYPE DECIMAL(12,2) USING (ROUND("subtotal"::numeric, 2));
ALTER TABLE "Proposal"        ALTER COLUMN "total"          TYPE DECIMAL(12,2) USING (ROUND("total"::numeric, 2));

-- NOTE: matching prisma/schema.prisma edits (Float -> Decimal @db.Decimal(12,2))
-- and the code updates must ship in the SAME deploy. See RUNBOOK.md §4.

COMMIT;
