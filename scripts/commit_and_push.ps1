Write-Host "Starting structured commits..."

git add prisma/schema.prisma migrations/
git commit -m "chore: Refactor database schema for checkout conversion and strict uniqueness"

git add package.json package-lock.json next.config.js .env.example
git commit -m "chore: Update dependencies, env defaults, and build configurations"

git add src/lib/features.ts src/lib/idempotency.ts src/lib/displayIds.ts
git commit -m "feat: Core feature flags and idempotency locking mechanisms"

git add src/lib/catalog/ src/lib/invoiceLineItems.ts
git commit -m "feat: Implement self-service product catalog and invoice line item generators"

git add src/lib/publicForms.ts src/lib/publicRateLimit.ts
git commit -m "feat: Add rate limiting and form validation for public endpoints"

git add src/lib/flywheel/ src/lib/email.ts
git commit -m "feat: Sync statuses to flywheel and update email notification models"

git add src/lib/sales/
git commit -m "feat: Implement the core Sales Checkout and Funnel logic"

git add src/middleware.ts src/components/AppShell.tsx
git commit -m "refactor: Route protections and UI Shell updates for checkout flow"

git add src/app/(public)/checkout/ src/app/(public)/apply/page.tsx
git commit -m "feat: Deprecate apply page and migrate to direct Checkout Conversion pipeline"

git add src/app/(public)/proposal/ src/app/(public)/inquire/page.tsx
git commit -m "feat: Implement interactive Proposals and redesign Sales Inquiries"

git add src/app/api/public/
git commit -m "feat: Refactor public API routes for rate-limited, lock-protected conversions"

git add src/app/(protected)/flywheel/ src/app/api/admin/
git commit -m "feat: Admin Flywheel tracking for sales qualification flows"

git add src/app/(protected)/sales/
git commit -m "feat: Internal Sales Dashboard to track proposals and checkout sessions"

git add src/app/api/razorpay/ src/app/api/paypal/ src/app/api/invoices/
git commit -m "fix: Harden payment webhooks against silent failures and enforce env safety"

git add src/lib/career/onboarding.ts scripts/
git commit -m "fix: Refactor onboarding pipeline to handle transient failures securely"

# Add anything left over just in case
git add .
git commit -m "chore: Final project alignments and miscellaneous refinements"

git push origin master

Write-Host "Pushed to production!"
