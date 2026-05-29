# ClientForge by Ripple Nexus

ClientForge is the enterprise-grade Operations Workspace and Client Portal for Ripple Nexus. It handles complex, multi-currency invoicing, client onboarding, deliverable management, secure file sharing, and automated lifecycle communication for the Career Booster program and beyond.

Built for **Vercel** edge deployments with a strict focus on security, performance, and production reliability.

---

## 🌟 Core Features

- **Billing & Invoices**: Multi-currency support (INR via Razorpay, USD/International via PayPal). Dynamic pricing, live exchange rates, and automated receipt generation.
- **Career Portal (Client-Facing)**: Secure client dashboard protected by Magic Links and PIN login. Clients can download deliverables, request revisions, and chat directly with the admin team.
- **Admin Workspace**: Centralized hub to manage clients, upload files (resumes, LinkedIn banners), track email deliverability, and handle revision requests.
- **Robust File Storage**: Cloudinary integration for deliverables, hardened to respect Vercel's strict 4.5MB serverless payload limits.
- **Automation Engine**: Consolidated background cron jobs (`/api/cron/daily`) to handle reminder emails, invoice expiration, and account lifecycles—optimized specifically for the Vercel Free Plan.
- **Asynchronous Webhooks**: Both Razorpay and PayPal webhooks utilize `@vercel/functions` `waitUntil()` to process heavy database and email tasks in the background, preventing serverless timeouts.
- **Enterprise Security**: Rate limiting on authentication routes, strict database typings via Prisma, and edge middleware for route protection.

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
Create your first admin user (uses `ADMIN_PASSWORD` from `.env.local`):
```bash
node create-admin.js
```

### 5. Run Development Server
```bash
npm run dev
```
- Admin Dashboard: `http://localhost:3000/login`
- Client Portal: `http://localhost:3000/portal/login`

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

ClientForge uses a highly relational PostgreSQL schema to link Billing and Deliverables.
- `Invoice`: Handles line items, currencies, and payment gateway references (`razorpayLinkId`, `razorpayPaymentId`).
- `CareerClient`: The central identity for portal access.
- `CareerDeliverable`: Tracks files uploaded to Cloudinary, ensuring strict limits and access control.
- `RevisionItem` & `CommentItem`: Powers the communication and revision workflows between the admin and the client.
- `EmailLog` & `EmailQueue`: Tracks every transactional email sent, enabling the cron engine to retry failed deliveries.

---

## 🔐 Security Posture

- **Rate Limiting**: Applied to `/api/auth/login`, `/api/career/auth/magic-link`, and `/api/career/auth/pin-login` to prevent brute-force attacks.
- **Edge Middleware**: Blocks unauthorized access to `/api/career/admin/*` and protected frontend routes before the request even hits the Node.js runtime.
- **Payload Limits**: Hard 4MB upload limit enforced across the UI, API, and Edge to prevent `413 Payload Too Large` crashes on Vercel.
- **Strict Build Enforcement**: `ignoreBuildErrors: false` ensures no code is deployed if there are unhandled TypeScript or React Hook violations.

---

## 📞 Support

Built for Ripple Nexus internal operations.
