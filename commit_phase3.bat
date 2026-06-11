git add package.json package-lock.json
git commit -m "chore: add sanitize-html dependencies"

git add prisma/schema.prisma phase3_migration.sql
git commit -m "feat: update schema for phase 3 lifecycle and health scores"

git add src/lib/communications.ts
git commit -m "feat: core communications utility with atomic operations"

git add src/app/api/career/portal/communications/ src/app/api/admin/communications/
git commit -m "feat: communications api endpoints"

git add src/app/api/career/portal/messages/route.ts src/app/api/rn/projects/[id]/messages/route.ts src/app/api/career/admin/clients/[id]/messages/route.ts
git commit -m "feat: implement message read tracking"

git add src/app/api/career/portal/comments/route.ts src/app/api/career/admin/clients/[id]/comments/route.ts
git commit -m "feat: implement comment read tracking"

git add src/app/(protected)/rn/clients/page.tsx src/app/api/career/admin/clients/route.ts
git commit -m "feat: surface unread messages in admin dashboard"

git add src/app/rn/portal/[token]/layout.tsx src/app/rn/portal/[token]/messages/page.tsx src/app/rn/portal/[token]/page.tsx
git commit -m "feat: surface unread notifications in rn client portal"

git add src/app/(career-portal)/portal/dashboard/page.tsx src/app/api/career/portal/me/route.ts
git commit -m "feat: surface unread notifications in career portal"

git add src/components/ClientFeedbackForms.tsx src/components/rn/RnClientFeedbackForms.tsx
git commit -m "feat: client feedback components"

git add src/app/api/career/portal/feedback/
git commit -m "feat: feedback submission api with health score engine"

git add src/app/api/career/portal/review/
git commit -m "feat: testimonial submission api with xss sanitization"

git add src/app/api/admin/reviews/
git commit -m "feat: admin reviews management api"

git add src/app/api/admin/analytics/
git commit -m "feat: admin analytics api with db-level aggregations"

git add src/app/(protected)/analytics/
git commit -m "feat: executive analytics dashboard ui"

git add src/components/AppShell.tsx src/app/(protected)/career/page.tsx
git commit -m "feat: update navigation for analytics"

git add src/app/api/cron/lifecycle/route.ts
git commit -m "feat: lifecycle cron engine with idempotency"

git add src/app/api/career/portal/revisions/route.ts src/app/api/career/portal/forms/[type]/route.ts src/app/api/career/portal/upload/route.ts
git commit -m "feat: enforce strict archival access controls"

git add src/scripts/backfill-health-scores.ts src/scripts/dedupe-email-logs.ts add_sla.ts
git commit -m "chore: add db maintenance and backfill scripts"

git add src/app/api/rn/client/ src/lib/db/tenantDb.ts
git commit -m "fix: resolve tenant db and rn client typing issues"

git push
