# ClientForge by Ripple Nexus

ClientForge is the enterprise-grade Operations Workspace and Client Portal for Ripple Nexus. It handles complex, multi-currency invoicing, client onboarding, deliverable management, secure file sharing, and automated lifecycle communication for both **Ripple Nexus** (B2B Agency) and **Catalyst** (Career Booster program).

Built for **Vercel** edge deployments with a strict focus on multi-tenant security, performance, and production reliability.

---

## 🌟 Core Features

- **Multi-Tenant Architecture**: Robust edge middleware dynamically routes traffic, enforces RBAC, and segregates data between Ripple Nexus and Catalyst contexts using cryptographically signed JWTs.
- **Billing & Invoices**: Multi-currency support (INR via Razorpay, USD/International via PayPal). Dynamic pricing, live exchange rates, automated receipt generation, and tenant-aware branding.
- **Client Portals**: Dedicated secure client dashboards protected by Magic Links and PIN login. Clients can download deliverables, request revisions, and chat directly with the admin team.
- **Admin Workspace**: Centralized hub to manage clients, upload files, track email deliverability, and handle multi-brand workflows.
- **Robust File Storage**: Cloudinary integration for deliverables, hardened to respect Vercel's strict 4.5MB serverless payload limits.
- **Asynchronous Webhooks**: Both Razorpay and PayPal webhooks utilize `@vercel/functions` `waitUntil()` to process heavy database and email tasks in the background, preventing serverless timeouts.
- **Enterprise Security**: Rate limiting on authentication routes, strict database typings via Prisma, and edge middleware for route protection and tenant isolation.

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL (Supabase or Neon free tier recommended)
- Cloudinary Account (for file uploads)
- Resend Account (for transactional emails)

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local` and fill in all required keys. See `.env.example` for detailed instructions on acquiring keys.

**Critical Requirements for Deployment:**
- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL` (Pooling enabled, e.g. `?pgbouncer=true`)
- `DIRECT_URL` (No pooling, for migrations)
- Payment Keys: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
- Email & Storage: `RESEND_API_KEY`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Security: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `CAREER_PORTAL_SECRET`

### 4. Database Setup
Push the strict Prisma schema to your database:
```bash
npx prisma generate
npx prisma db push
```

### 5. Run Development Server
```bash
npm run dev
```
- Admin Dashboard: `http://localhost:3000/login`
- Catalyst Portal: `http://localhost:3000/portal/login`
- Ripple Nexus Portal: `http://localhost:3000/rn/portal/[token]`

---

## 🚀 Production Deployment (Vercel)

ClientForge is heavily optimized for Vercel. 

1. Push your code to GitHub.
2. Import the repository into Vercel.
3. Add **all** environment variables from `.env.local` into Vercel's Environment Variables settings.
4. Deploy.

### Post-Deployment Checklist
- **Cron Jobs**: Vercel will automatically read `vercel.json` and schedule the master cron job (`/api/cron/daily`) to run every day at 10:00 AM UTC. Verify this in the Vercel Dashboard under **Settings → Cron Jobs**.
- **Webhooks**: Register your production `NEXT_PUBLIC_APP_URL/api/razorpay/webhook` in Razorpay and `NEXT_PUBLIC_APP_URL/api/paypal/webhook` in PayPal.

---

## 🗄️ Database Architecture (Prisma)

ClientForge uses a highly relational PostgreSQL schema.
- **Tenant Isolation**: `brandId` and `rnServiceId` strictly enforce data ownership.
- **Invoices**: Handles line items, currencies, and payment gateway references.
- **Clients**: Separate models for `CareerClient` (Catalyst) and `RnClient` (Ripple Nexus).
- **Deliverables**: Tracks files uploaded to Cloudinary, ensuring strict limits and access control.
- **Communication**: `RevisionItem`, `CommentItem`, and `Message` power the multi-tenant communication workflows.
- **Email System**: `EmailLog` & `EmailQueue` track every transactional email sent, enabling the cron engine to retry failed deliveries.

---

## 🔐 Security Posture

- **Cryptographic Tenant Enforcements**: JWTs encode the `activeTenant` claim, preventing session leakage between Ripple Nexus and Catalyst contexts.
- **Edge Middleware**: Blocks unauthorized access before requests hit the Node.js runtime and automatically resolves routing logic based on the user's cryptographically verified role.
- **Rate Limiting**: Applied to `/api/auth/login` and portal auth routes to prevent brute-force attacks.
- **CSRF & XSS Protection**: `cf_active_brand` and session cookies are secured with `httpOnly: true` and `sameSite: lax`.
- **Payload Limits**: Hard 4MB upload limit enforced to prevent `413 Payload Too Large` crashes.

---

## 📞 Support

Built for Ripple Nexus internal operations.
