-- Production-safe additive migration: Sales Inquiry + Proposal + CheckoutSession
-- Run manually or via deployment pipeline. Does NOT modify existing invoice/client rows.

-- Enums
CREATE TYPE "InquiryChannel" AS ENUM ('INQUIRE', 'APPLY', 'MANUAL', 'IMPORT');
CREATE TYPE "InquiryStatus" AS ENUM (
  'NEW', 'UNDER_REVIEW', 'QUALIFIED', 'APPROVED', 'REJECTED',
  'REQUEST_INFO', 'PROPOSAL_SENT', 'INVOICE_SENT', 'CONVERTED', 'LOST'
);
CREATE TYPE "InquiryPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED');
CREATE TYPE "CheckoutChannel" AS ENUM ('APPLY', 'ADMIN', 'MANUAL');
CREATE TYPE "CheckoutSessionStatus" AS ENUM ('DRAFT', 'INVOICE_CREATED', 'PAID', 'ABANDONED', 'EXPIRED');

-- SalesInquiry
CREATE TABLE "SalesInquiry" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "contactId" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "priority" "InquiryPriority" NOT NULL DEFAULT 'MEDIUM',
    "channel" "InquiryChannel" NOT NULL DEFAULT 'INQUIRE',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "requirementType" TEXT NOT NULL,
    "servicesRequested" JSONB NOT NULL DEFAULT '[]',
    "requirementNotes" TEXT,
    "qualificationScore" INTEGER,
    "assignedToId" TEXT,
    "sourceUrl" TEXT,
    "utmJson" JSONB,
    "flywheelProfileId" TEXT,
    "convertedInvoiceId" TEXT,
    "convertedClientId" TEXT,
    "legacyMetadata" JSONB,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesInquiry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesInquiry_displayId_key" ON "SalesInquiry"("displayId");
CREATE INDEX "SalesInquiry_status_idx" ON "SalesInquiry"("status");
CREATE INDEX "SalesInquiry_channel_idx" ON "SalesInquiry"("channel");
CREATE INDEX "SalesInquiry_email_idx" ON "SalesInquiry"("email");
CREATE INDEX "SalesInquiry_createdAt_idx" ON "SalesInquiry"("createdAt");
CREATE INDEX "SalesInquiry_assignedToId_idx" ON "SalesInquiry"("assignedToId");
CREATE INDEX "SalesInquiry_contactId_idx" ON "SalesInquiry"("contactId");

ALTER TABLE "SalesInquiry" ADD CONSTRAINT "SalesInquiry_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Proposal
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "scopeSummary" TEXT NOT NULL,
    "deliverables" JSONB NOT NULL DEFAULT '[]',
    "lineItems" JSONB NOT NULL DEFAULT '[]',
    "currency" TEXT NOT NULL,
    "currencySymbol" TEXT NOT NULL DEFAULT '$',
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "acceptedByEmail" TEXT,
    "publicToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Proposal_publicToken_key" ON "Proposal"("publicToken");
CREATE INDEX "Proposal_inquiryId_idx" ON "Proposal"("inquiryId");
CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");
CREATE INDEX "Proposal_publicToken_idx" ON "Proposal"("publicToken");

ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_inquiryId_fkey"
    FOREIGN KEY ("inquiryId") REFERENCES "SalesInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- InquiryActivityLog
CREATE TABLE "InquiryActivityLog" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "adminId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquiryActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InquiryActivityLog_inquiryId_idx" ON "InquiryActivityLog"("inquiryId");
CREATE INDEX "InquiryActivityLog_createdAt_idx" ON "InquiryActivityLog"("createdAt");

ALTER TABLE "InquiryActivityLog" ADD CONSTRAINT "InquiryActivityLog_inquiryId_fkey"
    FOREIGN KEY ("inquiryId") REFERENCES "SalesInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckoutSession
CREATE TABLE "CheckoutSession" (
    "id" TEXT NOT NULL,
    "channel" "CheckoutChannel" NOT NULL DEFAULT 'APPLY',
    "contactId" TEXT,
    "salesInquiryId" TEXT,
    "invoiceId" TEXT,
    "packageSlug" TEXT NOT NULL,
    "services" JSONB NOT NULL DEFAULT '[]',
    "experienceLevel" "ClientType" NOT NULL,
    "pricingSnapshot" JSONB NOT NULL,
    "status" "CheckoutSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentUrl" TEXT,
    "abandonedCheckoutLevel" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CheckoutSession_status_idx" ON "CheckoutSession"("status");
CREATE INDEX "CheckoutSession_email_idx" ON "CheckoutSession"("email");
CREATE INDEX "CheckoutSession_channel_idx" ON "CheckoutSession"("channel");
CREATE INDEX "CheckoutSession_invoiceId_idx" ON "CheckoutSession"("invoiceId");

ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_salesInquiryId_fkey"
    FOREIGN KEY ("salesInquiryId") REFERENCES "SalesInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Invoice attribution columns (nullable — existing rows unaffected)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sourceChannel" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "salesInquiryId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "checkoutSessionId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "proposalId" TEXT;

CREATE INDEX IF NOT EXISTS "Invoice_sourceChannel_idx" ON "Invoice"("sourceChannel");
CREATE INDEX IF NOT EXISTS "Invoice_salesInquiryId_idx" ON "Invoice"("salesInquiryId");
CREATE INDEX IF NOT EXISTS "Invoice_checkoutSessionId_idx" ON "Invoice"("checkoutSessionId");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_salesInquiryId_fkey"
    FOREIGN KEY ("salesInquiryId") REFERENCES "SalesInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_checkoutSessionId_fkey"
    FOREIGN KEY ("checkoutSessionId") REFERENCES "CheckoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
