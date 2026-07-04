# Migration runbook — prepared, NOT yet applied

These are prepared artifacts for the three deferred audit items. **Nothing here
has been run against any database.** Your `schema.prisma` and app code are
unchanged, so your current deploy is unaffected by these files sitting in the repo.

Apply them deliberately, in the order below, during a low-traffic window, after a
backup. My risk-adjusted recommendation for a live app with real clients:

| Order | Item | Risk | Recommendation |
|-------|------|------|----------------|
| 1 | **#6** adopt migrations (baseline) | Low | **Do it** — foundation for everything else |
| 2 | **#9** `onboardedAt` column | Very low | **Do it** — tiny, safe, closes a real gap |
| 3 | **#7** Float → Decimal | Medium–High (code surface) | **Defer + monitor** — run the reconciliation check (§5) instead, unless you see real drift |

Golden rule for all three: **the DB change and the matching `schema.prisma` +
code change must ship together.** Never deploy code that references a column
before the column exists, and never change a column type before the code that
reads it is ready.

---

## 0. Before anything — back up

```bash
# Full logical backup you can restore from
pg_dump "$DATABASE_URL" -Fc -f backup_$(date +%Y%m%d_%H%M).dump

# Confirm which DB you're pointed at — must NOT be prod when testing
psql "$DATABASE_URL" -c "select current_database(), now();"
```
Restore drill (on a scratch DB) so you know it works:
`pg_restore -d "$SCRATCH_URL" --clean --if-exists backup_*.dump`

---

## 1. #6 — Adopt Prisma migrations (baseline)

You currently use `prisma db push`, which has no history or rollback. Baselining
records the current schema as migration `0001` **without changing any data**.

`0001_baseline.sql` in this folder is the full current schema as SQL (generated
offline with `prisma migrate diff`, no DB connection). To adopt migrations:

```bash
# 1. Create the migrations dir structure from the prepared baseline
mkdir -p prisma/migrations/0001_baseline
cp docs/prepared-migrations/0001_baseline.sql prisma/migrations/0001_baseline/migration.sql

# 2. Tell Prisma this migration is ALREADY applied to production
#    (this only writes to the _prisma_migrations bookkeeping table — it does
#     NOT run the CREATE statements against your existing tables)
npx prisma migrate resolve --applied 0001_baseline

# 3. Verify
npx prisma migrate status
```
From now on: `prisma migrate dev` locally to create migrations, and
`prisma migrate deploy` in your release step. **Stop running `db push` against
production.**

⚠️ If you skip step 2 and run `migrate deploy`, Prisma will try to CREATE tables
that already exist and error out (no data loss, but a failed deploy). Always
resolve the baseline as applied first.

---

## 2. Pre-flight verification query (run before AND after each migration)

```sql
-- Totals that should never change from a type/column migration
SELECT count(*) AS invoices,
       sum("totalPayable") AS sum_total,
       sum("amountPaid")   FILTER (WHERE false) AS _ignore  -- placeholder
FROM "Invoice";
```
Record the row count and `sum_total` before, compare after. #6 and #9 must leave
both identical; #7 must leave the count identical and `sum_total` within rounding.

---

## 3. #9 — `onboardedAt` column + webhook code (ship together)

**Step A — DB:** run `0002_add_invoice_onboardedAt.sql` (adds a nullable column,
backfills PAID invoices). Safe: existing rows are not rewritten.

**Step B — schema.prisma:** add to the `Invoice` model:
```prisma
  onboardedAt   DateTime?
```

**Step C — code:** in BOTH webhook handlers gate onboarding on the flag instead
of payment status, and set it on success. In
`src/app/api/razorpay/webhook/route.ts` and `src/app/api/paypal/webhook/route.ts`,
where onboarding is triggered:

```ts
// before: if (newStatus === 'PAID') { ...onboard... }
// after:
if (newStatus === 'PAID' && !invoice.onboardedAt) {
  // ...existing onboarding waitUntil(...) ...
  // on success, mark it so a webhook retry never re-onboards:
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { onboardedAt: new Date() },
  });
}
```
Deploy B + C together with A. Rollback: drop the column (only before B/C deploy).

---

## 4. #7 — Money Float → Decimal(12,2)  (OPTIONAL, defer recommended)

Why deferred: the DB change (`0003_money_float_to_decimal.OPTIONAL.sql`) is safe
and lossless, but once columns are `Decimal`, Prisma returns `Prisma.Decimal`
objects, not `number`. Every arithmetic op, `.toFixed()`, `.toLocaleString()`,
and JSON serialization on these fields must be reviewed and updated in the SAME
deploy. On a live money app that's a large, regression-prone surface.

If/when you do it:
1. Run `0003_...OPTIONAL.sql` on a **staging copy** of prod first.
2. Edit `schema.prisma`: change each listed field `Float` → `Decimal @db.Decimal(12,2)`
   (rates like `exchangeRate`, `discountRate`, `taxRate`, `processingFeeRate`
   can stay `Float`, or become `Decimal @db.Decimal(9,4)` in a later pass).
3. `npx prisma generate`, then fix every `tsc` error — these are your code sites.
4. Add reconciliation tests (sum of line items === subtotal, etc.).
5. Deploy schema + code + DB migration together.

Rollback: `ALTER COLUMN ... TYPE double precision USING (col::double precision)`.

---

## 5. Cheaper alternative to #7 — read-only reconciliation (recommended first)

Instead of the risky type migration, get most of the safety benefit by
monitoring for drift. A read-only job (reads invoices, mutates nothing) that
flags any invoice where `subtotal + fees != totalPayable` beyond a cent, or where
`amountPaid` disagrees with the gateway. If it stays quiet for months, the Float
risk is theoretical for your data and #7 can stay deferred indefinitely.

Ask and I'll build this as a new `/api/admin/reconciliation` endpoint or a cron —
it's additive and touches no existing data.
