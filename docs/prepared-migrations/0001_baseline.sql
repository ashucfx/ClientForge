-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS', 'AGENCY_CLIENT');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'EDITOR', 'VIEWER', 'PROJECT_MANAGER', 'DESIGNER', 'BILLING');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CareerPackage" AS ENUM ('RESUME', 'LINKEDIN', 'COVER_LETTER', 'FULL');

-- CreateEnum
CREATE TYPE "CareerStatus" AS ENUM ('NOT_STARTED', 'SUBMITTED', 'UNDER_PROCESS', 'DRAFT_SENT', 'REVISION_REQUESTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InquiryChannel" AS ENUM ('INQUIRE', 'APPLY', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'QUALIFIED', 'APPROVED', 'REJECTED', 'REQUEST_INFO', 'PROPOSAL_SENT', 'INVOICE_SENT', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "InquiryPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CheckoutChannel" AS ENUM ('APPLY', 'CHECKOUT', 'ADMIN', 'MANUAL');

-- CreateEnum
CREATE TYPE "CheckoutSessionStatus" AS ENUM ('DRAFT', 'INVOICE_CREATED', 'PAID', 'ABANDONED', 'EXPIRED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'EDITOR',
    "brandAccess" TEXT[] DEFAULT ARRAY['catalyst', 'ripple_nexus']::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "clientType" "ClientType" NOT NULL,
    "country" TEXT NOT NULL,
    "companyName" TEXT,
    "currency" TEXT NOT NULL,
    "currencySymbol" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL,
    "lineItems" JSONB NOT NULL DEFAULT '[]',
    "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resumeBaseInr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "linkedinBaseInr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coverLetterBaseInr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resumeConverted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "linkedinConverted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coverLetterConverted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalConverted" DOUBLE PRECISION NOT NULL,
    "processingFeeRate" DOUBLE PRECISION NOT NULL,
    "processingFeeConverted" DOUBLE PRECISION NOT NULL,
    "totalPayable" DOUBLE PRECISION NOT NULL,
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "revisionCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "customPricing" BOOLEAN NOT NULL DEFAULT false,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "razorpayLinkId" TEXT,
    "razorpayLinkUrl" TEXT,
    "razorpayPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paymentGateway" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "paypalInvoiceId" TEXT,
    "paypalPaymentUrl" TEXT,
    "localCurrencyCode" TEXT,
    "localEquivalentAmount" DOUBLE PRECISION,
    "installmentPlan" BOOLEAN NOT NULL DEFAULT false,
    "installmentCount" INTEGER NOT NULL DEFAULT 1,
    "installments" JSONB NOT NULL DEFAULT '[]',
    "emailSentAt" TIMESTAMP(3),
    "emailResendCount" INTEGER NOT NULL DEFAULT 0,
    "abandonedCheckoutLevel" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "brandId" TEXT NOT NULL DEFAULT 'catalyst',
    "rnServiceId" TEXT,
    "sourceChannel" TEXT,
    "salesInquiryId" TEXT,
    "checkoutSessionId" TEXT,
    "proposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRateCache" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'INR',
    "targetCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRateCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerService" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formType" TEXT,

    CONSTRAINT "CareerService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerClientService" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "timeline" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerClientService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "packageType" "CareerPackage",
    "status" "CareerStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "razorpayPaymentId" TEXT,
    "razorpayOrderId" TEXT,
    "magicToken" TEXT,
    "magicTokenExpiry" TIMESTAMP(3),
    "pinHash" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "invoiceId" TEXT,
    "notes" TEXT,
    "expectedDeliveryAt" TIMESTAMP(3),
    "draftSentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "firstCompletedAt" TIMESTAMP(3),
    "slaDeadline" TIMESTAMP(3),
    "slaStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "waitingOn" TEXT NOT NULL DEFAULT 'AGENCY',
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "archiveReason" TEXT,
    "reEngagedAt" TIMESTAMP(3),
    "reEngagedFrom" TEXT,
    "lastAdminReplyAt" TIMESTAMP(3),
    "sourceChannel" TEXT,
    "checkoutSessionId" TEXT,
    "salesInquiryId" TEXT,
    "contactId" TEXT,

    CONSTRAINT "CareerClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerFormSubmission" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "formData" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerFormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerDeliverable" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "originalName" TEXT NOT NULL DEFAULT '',
    "fileCategory" TEXT NOT NULL DEFAULT 'final',
    "resourceType" TEXT NOT NULL DEFAULT 'raw',
    "uploadedBy" TEXT NOT NULL,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerEmailLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "resendId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerActivityLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL DEFAULT 'system',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerFormSchema" (
    "id" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerFormSchema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerRevision" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL DEFAULT 'client',
    "note" TEXT NOT NULL,
    "fileLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "serviceSlug" TEXT,
    "chargeStatus" TEXT NOT NULL DEFAULT 'FREE',
    "invoiceId" TEXT,
    "clientStatusBefore" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerComment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL DEFAULT 'client',
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "readByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "readByClient" BOOLEAN NOT NULL DEFAULT false,
    "readByAdminAt" TIMESTAMP(3),
    "readByClientAt" TIMESTAMP(3),
    "annotationX" DOUBLE PRECISION,
    "annotationY" DOUBLE PRECISION,
    "annotationPage" INTEGER,
    "isInternalOnly" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerMessage" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL DEFAULT 'client',
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternalOnly" BOOLEAN NOT NULL DEFAULT false,
    "readByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "readByClient" BOOLEAN NOT NULL DEFAULT false,
    "readByAdminAt" TIMESTAMP(3),
    "readByClientAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerDeleteOtp" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerDeleteOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "lineTotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceInstallment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paypalInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailQueue" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "clientId" TEXT,
    "data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnServiceModule" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workflowStages" JSONB NOT NULL,
    "revisionLimit" INTEGER NOT NULL DEFAULT 3,
    "revisionCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultSlaDays" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RnServiceModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RnOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnOrganizationMember" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "magicToken" TEXT,
    "magicTokenExpiry" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RnOrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "companyName" TEXT,
    "serviceModuleId" TEXT NOT NULL,
    "organizationId" TEXT,
    "currentStage" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "completedStages" JSONB NOT NULL DEFAULT '[]',
    "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "magicToken" TEXT,
    "magicTokenExpiry" TIMESTAMP(3),
    "pinHash" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "expectedDeliveryAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "slaDeadline" TIMESTAMP(3),
    "slaStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "waitingOn" TEXT NOT NULL DEFAULT 'AGENCY',
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "archiveReason" TEXT,
    "lastAdminReplyAt" TIMESTAMP(3),
    "contactId" TEXT,

    CONSTRAINT "RnClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnFormSubmission" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "formSlug" TEXT NOT NULL,
    "formData" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RnFormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnDeliverable" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "originalName" TEXT NOT NULL DEFAULT '',
    "fileCategory" TEXT NOT NULL DEFAULT 'final',
    "resourceType" TEXT NOT NULL DEFAULT 'raw',
    "stageContext" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RnDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnRevision" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL DEFAULT 'client',
    "note" TEXT NOT NULL,
    "fileLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "chargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RnRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnComment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "deliverableId" TEXT,
    "authorType" TEXT NOT NULL DEFAULT 'client',
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "annotationX" DOUBLE PRECISION,
    "annotationY" DOUBLE PRECISION,
    "annotationPage" INTEGER,
    "isInternalOnly" BOOLEAN NOT NULL DEFAULT false,
    "readByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "readByClient" BOOLEAN NOT NULL DEFAULT false,
    "readByAdminAt" TIMESTAMP(3),
    "readByClientAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RnComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnMessage" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL DEFAULT 'client',
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternalOnly" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB,
    "readByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "readByClient" BOOLEAN NOT NULL DEFAULT false,
    "readByAdminAt" TIMESTAMP(3),
    "readByClientAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RnMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnEmailLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "resendId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RnEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnActivityLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL DEFAULT 'system',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RnActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnDeleteOtp" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RnDeleteOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNote" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnProjectMilestone" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RnProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnProjectTask" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RnProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceClientLink" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'INITIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceClientLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientUpgradeHistory" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "previousServices" JSONB NOT NULL,
    "addedServices" JSONB NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientUpgradeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "careerClientId" TEXT,
    "rnClientId" TEXT,
    "serviceType" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "npsScore" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "deliveryQuality" INTEGER NOT NULL,
    "turnaroundTime" INTEGER NOT NULL,
    "comments" TEXT,
    "deliveryDurationDays" INTEGER,
    "revisionCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "careerClientId" TEXT,
    "rnClientId" TEXT,
    "rating" INTEGER NOT NULL,
    "testimonial" TEXT NOT NULL,
    "designation" TEXT,
    "company" TEXT,
    "linkedinUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientHealthScore" (
    "id" TEXT NOT NULL,
    "careerClientId" TEXT,
    "rnClientId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "satisfaction" DOUBLE PRECISION,
    "responseSpeed" DOUBLE PRECISION,
    "revisionRisk" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientHealthScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationReadState" (
    "id" TEXT NOT NULL,
    "careerClientId" TEXT,
    "rnClientId" TEXT,
    "unreadByAdmin" INTEGER NOT NULL DEFAULT 0,
    "unreadByClient" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageBy" TEXT NOT NULL DEFAULT 'client',
    "adminSlaDeadline" TIMESTAMP(3),
    "adminSlaEvent" TEXT,

    CONSTRAINT "ConversationReadState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientNotification" (
    "id" TEXT NOT NULL,
    "careerClientId" TEXT,
    "rnClientId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "displayId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "companyName" TEXT,
    "country" TEXT,
    "city" TEXT,
    "timezone" TEXT,
    "industry" TEXT,
    "jobTitle" TEXT,
    "linkedinUrl" TEXT,
    "contactSource" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mergedIntoContactId" TEXT,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMergeReview" (
    "id" TEXT NOT NULL,
    "sourceContactId" TEXT NOT NULL,
    "targetContactId" TEXT NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactMergeReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlywheelProfile" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "leadStatus" TEXT NOT NULL DEFAULT 'NEW',
    "lifecycleStage" TEXT NOT NULL DEFAULT 'LEAD',
    "optInStatus" BOOLEAN NOT NULL DEFAULT true,
    "optInIp" TEXT,
    "optInSource" TEXT,
    "referralCode" TEXT,
    "ownerId" TEXT,
    "engagementScore" INTEGER DEFAULT 0,
    "referralScore" INTEGER DEFAULT 0,
    "reactivationScore" INTEGER DEFAULT 0,
    "totalRevenue" DECIMAL(12,2) DEFAULT 0.00,
    "dealValue" DECIMAL(12,2) DEFAULT 0.00,
    "invoiceCount" INTEGER DEFAULT 0,
    "lastInvoiceDate" TIMESTAMP(3),
    "lastServiceDate" TIMESTAMP(3),
    "lastCampaignAt" TIMESTAMP(3),
    "lastContactedAt" TIMESTAMP(3),
    "nextActionDate" TIMESTAMP(3),
    "servicesPurchased" JSONB,
    "tags" JSONB,
    "referredById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlywheelProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationRun" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "contactsCreated" INTEGER NOT NULL DEFAULT 0,
    "contactsMatched" INTEGER NOT NULL DEFAULT 0,
    "manualReviewsCreated" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "MigrationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlywheelCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ONE_OFF',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "brandId" TEXT NOT NULL DEFAULT 'catalyst',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlywheelCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlywheelCampaignStep" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "delayHours" INTEGER NOT NULL DEFAULT 0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlywheelCampaignStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlywheelCampaignLead" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "currentStepId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "nextExecutionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlywheelCampaignLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlywheelEmailEvent" (
    "id" TEXT NOT NULL,
    "campaignLeadId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlywheelEmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnsubscribeList" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "brandId" TEXT NOT NULL DEFAULT 'catalyst',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnsubscribeList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlywheelActionCard" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "revenuePotential" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "suggestedAction" TEXT NOT NULL,
    "actionData" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlywheelActionCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "autoQualScore" INTEGER,
    "qualificationNotes" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "slaBreachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "scopeSummary" TEXT NOT NULL,
    "deliverables" JSONB NOT NULL DEFAULT '[]',
    "lineItems" JSONB NOT NULL DEFAULT '[]',
    "revisionLimits" JSONB,
    "deliveryTimeline" JSONB,
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
    "clientNotes" TEXT,
    "publicToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "CheckoutSession" (
    "id" TEXT NOT NULL,
    "channel" "CheckoutChannel" NOT NULL DEFAULT 'CHECKOUT',
    "contactId" TEXT,
    "salesInquiryId" TEXT,
    "proposalId" TEXT,
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
    "whatsapp" TEXT,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "createdClientId" TEXT,
    "portalActivatedAt" TIMESTAMP(3),
    "onboardingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "clientEmail" TEXT,
    "clientName" TEXT,
    "description" TEXT NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SysEmailLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'smtp',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "error" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SysEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_brandId_idx" ON "Invoice"("brandId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_clientType_idx" ON "Invoice"("clientType");

-- CreateIndex
CREATE INDEX "Invoice_clientEmail_idx" ON "Invoice"("clientEmail");

-- CreateIndex
CREATE INDEX "Invoice_paymentGateway_idx" ON "Invoice"("paymentGateway");

-- CreateIndex
CREATE INDEX "Invoice_sourceChannel_idx" ON "Invoice"("sourceChannel");

-- CreateIndex
CREATE INDEX "Invoice_salesInquiryId_idx" ON "Invoice"("salesInquiryId");

-- CreateIndex
CREATE INDEX "Invoice_checkoutSessionId_idx" ON "Invoice"("checkoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRateCache_baseCurrency_targetCurrency_key" ON "ExchangeRateCache"("baseCurrency", "targetCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "CareerService_slug_key" ON "CareerService"("slug");

-- CreateIndex
CREATE INDEX "CareerClientService_clientId_idx" ON "CareerClientService"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerClientService_clientId_serviceId_key" ON "CareerClientService"("clientId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerClient_email_key" ON "CareerClient"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CareerClient_razorpayPaymentId_key" ON "CareerClient"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "CareerClient_status_idx" ON "CareerClient"("status");

-- CreateIndex
CREATE INDEX "CareerClient_email_idx" ON "CareerClient"("email");

-- CreateIndex
CREATE INDEX "CareerClient_packageType_idx" ON "CareerClient"("packageType");

-- CreateIndex
CREATE INDEX "CareerClient_lifecycleStatus_idx" ON "CareerClient"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "CareerClient_completedAt_idx" ON "CareerClient"("completedAt");

-- CreateIndex
CREATE INDEX "CareerClient_contactId_idx" ON "CareerClient"("contactId");

-- CreateIndex
CREATE INDEX "CareerFormSubmission_clientId_idx" ON "CareerFormSubmission"("clientId");

-- CreateIndex
CREATE INDEX "CareerFormSubmission_clientId_formType_idx" ON "CareerFormSubmission"("clientId", "formType");

-- CreateIndex
CREATE INDEX "CareerDeliverable_clientId_idx" ON "CareerDeliverable"("clientId");

-- CreateIndex
CREATE INDEX "CareerDeliverable_clientId_fileCategory_idx" ON "CareerDeliverable"("clientId", "fileCategory");

-- CreateIndex
CREATE INDEX "CareerEmailLog_clientId_idx" ON "CareerEmailLog"("clientId");

-- CreateIndex
CREATE INDEX "CareerEmailLog_clientId_trigger_status_idx" ON "CareerEmailLog"("clientId", "trigger", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CareerEmailLog_clientId_trigger_key" ON "CareerEmailLog"("clientId", "trigger");

-- CreateIndex
CREATE INDEX "CareerActivityLog_clientId_idx" ON "CareerActivityLog"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerFormSchema_formType_key" ON "CareerFormSchema"("formType");

-- CreateIndex
CREATE INDEX "CareerRevision_clientId_idx" ON "CareerRevision"("clientId");

-- CreateIndex
CREATE INDEX "CareerComment_clientId_idx" ON "CareerComment"("clientId");

-- CreateIndex
CREATE INDEX "CareerMessage_clientId_idx" ON "CareerMessage"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerDeleteOtp_clientId_key" ON "CareerDeleteOtp"("clientId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceInstallment_invoiceId_idx" ON "InvoiceInstallment"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceInstallment_paypalInvoiceId_idx" ON "InvoiceInstallment"("paypalInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_eventId_idx" ON "WebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "EmailQueue_status_nextRunAt_idx" ON "EmailQueue"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "EmailQueue_clientId_trigger_idx" ON "EmailQueue"("clientId", "trigger");

-- CreateIndex
CREATE UNIQUE INDEX "RnServiceModule_slug_key" ON "RnServiceModule"("slug");

-- CreateIndex
CREATE INDEX "RnServiceModule_slug_idx" ON "RnServiceModule"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RnOrganizationMember_email_key" ON "RnOrganizationMember"("email");

-- CreateIndex
CREATE INDEX "RnOrganizationMember_email_idx" ON "RnOrganizationMember"("email");

-- CreateIndex
CREATE INDEX "RnOrganizationMember_orgId_idx" ON "RnOrganizationMember"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "RnClient_email_key" ON "RnClient"("email");

-- CreateIndex
CREATE INDEX "RnClient_email_idx" ON "RnClient"("email");

-- CreateIndex
CREATE INDEX "RnClient_serviceModuleId_currentStage_idx" ON "RnClient"("serviceModuleId", "currentStage");

-- CreateIndex
CREATE INDEX "RnClient_lifecycleStatus_idx" ON "RnClient"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "RnClient_contactId_idx" ON "RnClient"("contactId");

-- CreateIndex
CREATE INDEX "RnFormSubmission_clientId_idx" ON "RnFormSubmission"("clientId");

-- CreateIndex
CREATE INDEX "RnDeliverable_clientId_idx" ON "RnDeliverable"("clientId");

-- CreateIndex
CREATE INDEX "RnDeliverable_clientId_fileCategory_idx" ON "RnDeliverable"("clientId", "fileCategory");

-- CreateIndex
CREATE INDEX "RnRevision_clientId_idx" ON "RnRevision"("clientId");

-- CreateIndex
CREATE INDEX "RnComment_clientId_idx" ON "RnComment"("clientId");

-- CreateIndex
CREATE INDEX "RnComment_deliverableId_idx" ON "RnComment"("deliverableId");

-- CreateIndex
CREATE INDEX "RnMessage_clientId_idx" ON "RnMessage"("clientId");

-- CreateIndex
CREATE INDEX "RnEmailLog_clientId_idx" ON "RnEmailLog"("clientId");

-- CreateIndex
CREATE INDEX "RnEmailLog_clientId_trigger_status_idx" ON "RnEmailLog"("clientId", "trigger", "status");

-- CreateIndex
CREATE INDEX "RnActivityLog_clientId_idx" ON "RnActivityLog"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "RnDeleteOtp_clientId_key" ON "RnDeleteOtp"("clientId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_idx" ON "AuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AdminNote_clientId_idx" ON "AdminNote"("clientId");

-- CreateIndex
CREATE INDEX "AdminNote_adminId_idx" ON "AdminNote"("adminId");

-- CreateIndex
CREATE INDEX "Notification_adminId_idx" ON "Notification"("adminId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "RnProjectMilestone_clientId_idx" ON "RnProjectMilestone"("clientId");

-- CreateIndex
CREATE INDEX "RnProjectTask_milestoneId_idx" ON "RnProjectTask"("milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceClientLink_invoiceId_key" ON "InvoiceClientLink"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceClientLink_clientId_idx" ON "InvoiceClientLink"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceClientLink_clientId_invoiceId_key" ON "InvoiceClientLink"("clientId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_careerClientId_key" ON "Feedback"("careerClientId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_rnClientId_key" ON "Feedback"("rnClientId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_careerClientId_key" ON "Review"("careerClientId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_rnClientId_key" ON "Review"("rnClientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientHealthScore_careerClientId_key" ON "ClientHealthScore"("careerClientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientHealthScore_rnClientId_key" ON "ClientHealthScore"("rnClientId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationReadState_careerClientId_key" ON "ConversationReadState"("careerClientId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationReadState_rnClientId_key" ON "ConversationReadState"("rnClientId");

-- CreateIndex
CREATE INDEX "ConversationReadState_unreadByAdmin_idx" ON "ConversationReadState"("unreadByAdmin");

-- CreateIndex
CREATE INDEX "ConversationReadState_unreadByClient_idx" ON "ConversationReadState"("unreadByClient");

-- CreateIndex
CREATE INDEX "ConversationReadState_lastMessageAt_idx" ON "ConversationReadState"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ClientNotification_careerClientId_isRead_idx" ON "ClientNotification"("careerClientId", "isRead");

-- CreateIndex
CREATE INDEX "ClientNotification_rnClientId_isRead_idx" ON "ClientNotification"("rnClientId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_displayId_key" ON "Contact"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_phone_idx" ON "Contact"("phone");

-- CreateIndex
CREATE INDEX "Contact_contactSource_idx" ON "Contact"("contactSource");

-- CreateIndex
CREATE INDEX "Contact_status_idx" ON "Contact"("status");

-- CreateIndex
CREATE INDEX "Contact_displayId_idx" ON "Contact"("displayId");

-- CreateIndex
CREATE INDEX "ContactMergeReview_sourceContactId_idx" ON "ContactMergeReview"("sourceContactId");

-- CreateIndex
CREATE INDEX "ContactMergeReview_targetContactId_idx" ON "ContactMergeReview"("targetContactId");

-- CreateIndex
CREATE INDEX "ContactMergeReview_status_idx" ON "ContactMergeReview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FlywheelProfile_contactId_key" ON "FlywheelProfile"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "FlywheelProfile_referralCode_key" ON "FlywheelProfile"("referralCode");

-- CreateIndex
CREATE INDEX "FlywheelProfile_contactId_idx" ON "FlywheelProfile"("contactId");

-- CreateIndex
CREATE INDEX "FlywheelProfile_lifecycleStage_idx" ON "FlywheelProfile"("lifecycleStage");

-- CreateIndex
CREATE INDEX "FlywheelProfile_leadStatus_idx" ON "FlywheelProfile"("leadStatus");

-- CreateIndex
CREATE INDEX "FlywheelProfile_referralCode_idx" ON "FlywheelProfile"("referralCode");

-- CreateIndex
CREATE INDEX "ProcessedEvent_processedAt_idx" ON "ProcessedEvent"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEvent_eventType_eventId_key" ON "ProcessedEvent"("eventType", "eventId");

-- CreateIndex
CREATE INDEX "FlywheelCampaign_status_idx" ON "FlywheelCampaign"("status");

-- CreateIndex
CREATE INDEX "FlywheelCampaign_brandId_idx" ON "FlywheelCampaign"("brandId");

-- CreateIndex
CREATE INDEX "FlywheelCampaignStep_campaignId_idx" ON "FlywheelCampaignStep"("campaignId");

-- CreateIndex
CREATE INDEX "FlywheelCampaignLead_status_nextExecutionAt_idx" ON "FlywheelCampaignLead"("status", "nextExecutionAt");

-- CreateIndex
CREATE INDEX "FlywheelCampaignLead_contactId_idx" ON "FlywheelCampaignLead"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "FlywheelCampaignLead_campaignId_contactId_key" ON "FlywheelCampaignLead"("campaignId", "contactId");

-- CreateIndex
CREATE INDEX "FlywheelEmailEvent_campaignLeadId_idx" ON "FlywheelEmailEvent"("campaignLeadId");

-- CreateIndex
CREATE INDEX "FlywheelEmailEvent_eventType_idx" ON "FlywheelEmailEvent"("eventType");

-- CreateIndex
CREATE INDEX "UnsubscribeList_email_idx" ON "UnsubscribeList"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UnsubscribeList_email_brandId_key" ON "UnsubscribeList"("email", "brandId");

-- CreateIndex
CREATE INDEX "FlywheelActionCard_contactId_status_idx" ON "FlywheelActionCard"("contactId", "status");

-- CreateIndex
CREATE INDEX "FlywheelActionCard_status_priority_idx" ON "FlywheelActionCard"("status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInquiry_displayId_key" ON "SalesInquiry"("displayId");

-- CreateIndex
CREATE INDEX "SalesInquiry_status_idx" ON "SalesInquiry"("status");

-- CreateIndex
CREATE INDEX "SalesInquiry_channel_idx" ON "SalesInquiry"("channel");

-- CreateIndex
CREATE INDEX "SalesInquiry_email_idx" ON "SalesInquiry"("email");

-- CreateIndex
CREATE INDEX "SalesInquiry_createdAt_idx" ON "SalesInquiry"("createdAt");

-- CreateIndex
CREATE INDEX "SalesInquiry_assignedToId_idx" ON "SalesInquiry"("assignedToId");

-- CreateIndex
CREATE INDEX "SalesInquiry_contactId_idx" ON "SalesInquiry"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_publicToken_key" ON "Proposal"("publicToken");

-- CreateIndex
CREATE INDEX "Proposal_inquiryId_idx" ON "Proposal"("inquiryId");

-- CreateIndex
CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");

-- CreateIndex
CREATE INDEX "Proposal_publicToken_idx" ON "Proposal"("publicToken");

-- CreateIndex
CREATE INDEX "InquiryActivityLog_inquiryId_idx" ON "InquiryActivityLog"("inquiryId");

-- CreateIndex
CREATE INDEX "InquiryActivityLog_createdAt_idx" ON "InquiryActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "CheckoutSession_status_idx" ON "CheckoutSession"("status");

-- CreateIndex
CREATE INDEX "CheckoutSession_email_idx" ON "CheckoutSession"("email");

-- CreateIndex
CREATE INDEX "CheckoutSession_channel_idx" ON "CheckoutSession"("channel");

-- CreateIndex
CREATE INDEX "CheckoutSession_invoiceId_idx" ON "CheckoutSession"("invoiceId");

-- CreateIndex
CREATE INDEX "CheckoutSession_proposalId_idx" ON "CheckoutSession"("proposalId");

-- CreateIndex
CREATE INDEX "BugReport_status_idx" ON "BugReport"("status");

-- CreateIndex
CREATE INDEX "BugReport_clientId_idx" ON "BugReport"("clientId");

-- CreateIndex
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "SysEmailLog_sentAt_idx" ON "SysEmailLog"("sentAt");

-- CreateIndex
CREATE INDEX "SysEmailLog_trigger_idx" ON "SysEmailLog"("trigger");

-- CreateIndex
CREATE INDEX "SysEmailLog_to_idx" ON "SysEmailLog"("to");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_salesInquiryId_fkey" FOREIGN KEY ("salesInquiryId") REFERENCES "SalesInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "CheckoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerClientService" ADD CONSTRAINT "CareerClientService_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerClientService" ADD CONSTRAINT "CareerClientService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "CareerService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerClient" ADD CONSTRAINT "CareerClient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerFormSubmission" ADD CONSTRAINT "CareerFormSubmission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerDeliverable" ADD CONSTRAINT "CareerDeliverable_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerEmailLog" ADD CONSTRAINT "CareerEmailLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerActivityLog" ADD CONSTRAINT "CareerActivityLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerRevision" ADD CONSTRAINT "CareerRevision_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerComment" ADD CONSTRAINT "CareerComment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerMessage" ADD CONSTRAINT "CareerMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerDeleteOtp" ADD CONSTRAINT "CareerDeleteOtp_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceInstallment" ADD CONSTRAINT "InvoiceInstallment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnOrganizationMember" ADD CONSTRAINT "RnOrganizationMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "RnOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnClient" ADD CONSTRAINT "RnClient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "RnOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnClient" ADD CONSTRAINT "RnClient_serviceModuleId_fkey" FOREIGN KEY ("serviceModuleId") REFERENCES "RnServiceModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnClient" ADD CONSTRAINT "RnClient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnFormSubmission" ADD CONSTRAINT "RnFormSubmission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "RnClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnDeliverable" ADD CONSTRAINT "RnDeliverable_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "RnClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnRevision" ADD CONSTRAINT "RnRevision_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "RnClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnComment" ADD CONSTRAINT "RnComment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "RnClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnMessage" ADD CONSTRAINT "RnMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "RnClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnEmailLog" ADD CONSTRAINT "RnEmailLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "RnClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnActivityLog" ADD CONSTRAINT "RnActivityLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "RnClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnDeleteOtp" ADD CONSTRAINT "RnDeleteOtp_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "RnClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnProjectMilestone" ADD CONSTRAINT "RnProjectMilestone_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "RnClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnProjectTask" ADD CONSTRAINT "RnProjectTask_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "RnProjectMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceClientLink" ADD CONSTRAINT "InvoiceClientLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceClientLink" ADD CONSTRAINT "InvoiceClientLink_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientUpgradeHistory" ADD CONSTRAINT "ClientUpgradeHistory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_careerClientId_fkey" FOREIGN KEY ("careerClientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_rnClientId_fkey" FOREIGN KEY ("rnClientId") REFERENCES "RnClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_careerClientId_fkey" FOREIGN KEY ("careerClientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_rnClientId_fkey" FOREIGN KEY ("rnClientId") REFERENCES "RnClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientHealthScore" ADD CONSTRAINT "ClientHealthScore_careerClientId_fkey" FOREIGN KEY ("careerClientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientHealthScore" ADD CONSTRAINT "ClientHealthScore_rnClientId_fkey" FOREIGN KEY ("rnClientId") REFERENCES "RnClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationReadState" ADD CONSTRAINT "ConversationReadState_careerClientId_fkey" FOREIGN KEY ("careerClientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationReadState" ADD CONSTRAINT "ConversationReadState_rnClientId_fkey" FOREIGN KEY ("rnClientId") REFERENCES "RnClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNotification" ADD CONSTRAINT "ClientNotification_careerClientId_fkey" FOREIGN KEY ("careerClientId") REFERENCES "CareerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNotification" ADD CONSTRAINT "ClientNotification_rnClientId_fkey" FOREIGN KEY ("rnClientId") REFERENCES "RnClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_mergedIntoContactId_fkey" FOREIGN KEY ("mergedIntoContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMergeReview" ADD CONSTRAINT "ContactMergeReview_sourceContactId_fkey" FOREIGN KEY ("sourceContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMergeReview" ADD CONSTRAINT "ContactMergeReview_targetContactId_fkey" FOREIGN KEY ("targetContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlywheelProfile" ADD CONSTRAINT "FlywheelProfile_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlywheelProfile" ADD CONSTRAINT "FlywheelProfile_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "FlywheelProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlywheelCampaignStep" ADD CONSTRAINT "FlywheelCampaignStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "FlywheelCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlywheelCampaignLead" ADD CONSTRAINT "FlywheelCampaignLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "FlywheelCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlywheelCampaignLead" ADD CONSTRAINT "FlywheelCampaignLead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlywheelCampaignLead" ADD CONSTRAINT "FlywheelCampaignLead_currentStepId_fkey" FOREIGN KEY ("currentStepId") REFERENCES "FlywheelCampaignStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlywheelEmailEvent" ADD CONSTRAINT "FlywheelEmailEvent_campaignLeadId_fkey" FOREIGN KEY ("campaignLeadId") REFERENCES "FlywheelCampaignLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlywheelActionCard" ADD CONSTRAINT "FlywheelActionCard_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInquiry" ADD CONSTRAINT "SalesInquiry_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "SalesInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryActivityLog" ADD CONSTRAINT "InquiryActivityLog_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "SalesInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_salesInquiryId_fkey" FOREIGN KEY ("salesInquiryId") REFERENCES "SalesInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareerClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

