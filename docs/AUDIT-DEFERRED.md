# Deferred audit items — require live-data migration

These three items from the production audit were **intentionally not applied** in
the automated fix pass because they alter the live `Invoice` table or migrate
existing rows. They are documented here so they can be executed deliberately,
with a backup and a maintenance window, rather than as part of a routine deploy.

Everything else from the audit (auth bypass, CI branch, rate-limiter, durable
checkout lock, dependency upgrades, money-math tests) has already been applied —
none of those touched data.

**Ready-to-apply SQL + operator runbook:** see
[`prepared-migrations/RUNBOOK.md`](prepared-migrations/RUNBOOK.md). The SQL files
there are generated/hand-written but **not yet run against any database**;
`schema.prisma` and app code are unchanged, so the current deploy is unaffected.
Recommended order: #6 (baseline) → #9 (onboardedAt) → #7 deferred in favour of a
read-only reconciliation check.

---

## #6 — Adopt Prisma migrations (currently `prisma db push`)

**Problem:** there is no `prisma/migrations/` directory. Schema changes are
applied with `prisma db push`, which diffs and mutates the live database with no
recorded SQL, no review step, and no rollback path.

**Why deferred:** baselining is safe (it records the current state without
changing data), but it must be done against the real database with care so the
first migration is marked "already applied" and does not attempt to recreate
existing tables.

**Plan (zero data change when done correctly):**
1. `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0000_init/migration.sql`
2. `npx prisma migrate resolve --applied 0000_init` against production so it is
   recorded as already applied.
3. From then on, use `prisma migrate dev` locally and `prisma migrate deploy` in
   CI/CD. Stop using `db push` against production.

---

## #7 — Money stored as `Float`, should be `Decimal(12,2)`

**Problem:** monetary columns are `Float` (IEEE-754), which cannot represent
values like 0.1 exactly. Over many invoices this causes cent-level drift and
totals that do not reconcile with the payment gateway.

**Affected columns (`prisma/schema.prisma`):**
- `Invoice`: `discountAmount`, `taxAmount`, `subtotalConverted`,
  `processingFeeConverted`, `totalPayable`, `localEquivalentAmount`, `amountPaid`
- `InvoiceInstallment`: `amount`, `amountPaid`
- line-item JSON: `unitPrice`, `lineTotal`
- `Proposal`: `subtotal`, `total`
- revision `chargeAmount`

**Why deferred:** changing a column type on a table with live invoices is a
data migration. It must be done as `ALTER COLUMN ... TYPE decimal(12,2)` inside a
transaction, verified against a backup first. Prisma's `Decimal` type also
changes the TypeScript surface (`Prisma.Decimal` instead of `number`), so every
read/write site needs review — a code change that must ship together with the
column change.

**Plan:**
1. Take a database backup / snapshot.
2. Do #6 (migrations) first so this change is reviewable SQL.
3. Migrate columns to `Decimal @db.Decimal(12,2)` in a single migration.
4. Update code that does arithmetic on these fields to use `Prisma.Decimal`
   (or convert at the boundary), guided by `tsc` errors.
5. Add tests asserting reconciliation (sum of line items === subtotal, etc.).

---

## #9 — Onboarding not retried when a webhook redelivers after `PAID`

**Problem:** both payment webhooks guard with
`if (existing.status === 'PAID') return`. This correctly prevents double payment,
but if onboarding failed *after* the invoice was marked paid, a webhook retry
short-circuits and never re-runs onboarding. Today this is mitigated by a
failure-alert email, so it is operationally survivable but manual.

**Why deferred:** the clean fix adds an `onboardedAt DateTime?` column to
`Invoice` so retries are driven by onboarding state instead of payment state.
Adding a nullable column is non-destructive (existing rows get `NULL`), but it is
still a schema change to the live `Invoice` table and should ship with #6.

**Plan:**
1. Add `onboardedAt DateTime?` to `Invoice` (nullable — safe for existing rows).
2. In the webhook, gate onboarding on `!invoice.onboardedAt` instead of payment
   status; set `onboardedAt` when onboarding succeeds.
3. Backfill `onboardedAt = paidAt` for existing PAID+onboarded invoices so they
   are not reprocessed.
