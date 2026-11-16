# Catalyst ClientForge

> **Classification: Confidential · Internal operational software**

ClientForge is Catalyst's internal platform for managing client engagements, professional deliverables, invoicing, payment coordination, and client communications from one controlled workspace.

This repository is maintained for authorized contributors only. Do not publish production configuration, credentials, client information, payment data, database exports, or internal operational records.

## What the platform does

ClientForge supports two connected workspaces:

- **Admin operations** — client accounts, delivery workflows, invoices, reconciliation, proposals, analytics, notifications, and administrative controls.
- **Client portal** — secure access to onboarding forms, deliverables, revisions, messages, agreements, invoices, payment options, and upgrade requests.

The platform is designed for real operational use. Existing client, invoice, payment, and account data must be treated as production records.

## Core capabilities

### Revenue operations

- Multi-currency invoice creation and previews
- Isolated invoice drafts that do not create live invoices or payment links
- Razorpay, PayPal, and bank-transfer workflows
- Payment reconciliation and settlement tracking
- Branded invoice email and PDF output

### Client delivery

- Client onboarding and intake forms
- Deliverable uploads, previews, approvals, and revision requests
- Client/admin messaging and presence indicators
- SLA and agreement acceptance
- Client upgrade and consultation workflows

### Administration

- Role- and brand-aware access controls
- Session management and security audit history
- Client lifecycle and delivery tracking
- Proposal, inquiry, referral, and review management
- Operational analytics and notification workflows

## Technical foundation

| Area | Technology |
| --- | --- |
| Application | Next.js, React, TypeScript |
| Styling | Tailwind CSS and Catalyst design tokens |
| Persistence | PostgreSQL |
| Data access | Prisma ORM |
| Payments | Razorpay, PayPal, bank-transfer workflows |
| Email | Resend and SMTP-compatible mail delivery |
| Testing | Vitest, TypeScript, Next.js build validation |

## Repository structure

```text
src/
  app/          Next.js routes, pages, API handlers, and portals
  components/   Shared application and UI components
  emails/       Transactional email templates
  lib/          Authentication, database, payments, pricing, and domain logic
prisma/         Prisma schema and generated client configuration
migrations/     Reviewed additive SQL migrations
scripts/        Guarded maintenance and operational utilities
docs/           Internal runbooks and deferred audit work
```

## Local development

Use a local or disposable PostgreSQL database. Never point local development, tests, or schema tooling at production.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Required environment variables are deployment-specific. Copy values from the approved secret manager or local environment template; never commit them to this repository.

## Production change controls

Production safety takes priority over convenience.

- Review every schema change before deployment.
- Apply migrations through the approved database process.
- Back up production before structural changes.
- Prefer additive changes with explicit rollback and verification steps.
- Do not use `prisma db push` against production.
- Do not run seeds, cleanup jobs, backfills, or maintenance scripts against production without explicit authorization.
- Do not test payment, email, or destructive administrative flows with live credentials.
- Keep audit history intact unless a separately approved retention or compliance process applies.

The `InvoiceDraft` storage change is intentionally separate from the live `Invoice` model. Drafts must not create invoice numbers, payment links, emails, webhook events, or settlement records until an administrator explicitly finalizes them.

## Security and confidentiality

Do not commit or share:

- API keys, session secrets, database URLs, webhook secrets, or SMTP credentials
- Client names, emails, phone numbers, resumes, invoices, payment details, or exported database data
- Production logs, private screenshots, or internal hostnames
- Test accounts containing real personal or payment information

Report suspected credential exposure immediately, rotate the affected secret, and preserve relevant audit evidence. Removing a secret from the current file does not remove it from Git history.

## Contribution standard

Changes should be:

1. Narrowly scoped and easy to review.
2. Backward-compatible with existing client and invoice operations.
3. Covered by the smallest relevant validation command.
4. Explicit about database, payment, authentication, and email impact.
5. Delivered through an isolated branch and reviewed pull request unless an authorized hotfix process applies.

## Ownership

ClientForge is proprietary Catalyst software. Access, use, modification, and redistribution are restricted to authorized personnel and approved service providers.

---

**Confidential · Proprietary · Internal use only**
