-- Prepared migration for audit item #9 — onboarding retry safety.
-- SAFE: adds a NULLABLE column (existing rows get NULL, nothing is rewritten),
-- then backfills already-onboarded paid invoices so a webhook retry will NOT
-- reprocess them. Review, back up, then run inside your maintenance window.
--
-- This SQL must be deployed TOGETHER with the code change in RUNBOOK.md §3
-- (the webhook must set onboardedAt on success and gate on it). Do not deploy
-- the code before this column exists, or Prisma reads will error.

BEGIN;

ALTER TABLE "Invoice" ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- Treat every invoice that is already PAID as already onboarded, so existing
-- clients are never re-onboarded when PayPal/Razorpay redelivers an old event.
UPDATE "Invoice"
   SET "onboardedAt" = COALESCE("paidAt", "updatedAt", NOW())
 WHERE "status" = 'PAID';

COMMIT;

-- Rollback (if needed, before the code change is deployed):
-- ALTER TABLE "Invoice" DROP COLUMN "onboardedAt";
