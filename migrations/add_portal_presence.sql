-- Additive portal collaboration metadata. Does not update client or invoice rows.
ALTER TABLE "CareerClient" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);
ALTER TABLE "CareerClient" ADD COLUMN IF NOT EXISTS "lastViewedByAdminAt" TIMESTAMP(3);
ALTER TABLE "CareerClient" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);
