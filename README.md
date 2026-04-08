# ClientForge by Ripple Nexus

Internal client operations workspace by Ripple Nexus. Today it powers Career Booster billing (payment links, multi-currency, branded emails) and is designed to expand into broader invoicing + client onboarding workflows.

---

## 🗂️ Folder Structure

```
ripple-nexus/
├── .env.local                         # Environment variables (real keys inside)
├── .env.example                       # Template for reference
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── prisma/
│   └── schema.prisma                  # PostgreSQL schema (Invoice + ExchangeRateCache)
└── src/
    ├── app/
    │   ├── layout.tsx                 # Root layout (Plus Jakarta Sans font)
    │   ├── globals.css                # Design tokens, animations
    │   ├── page.tsx                   # 📊 Dashboard — invoice list + stats
    │   ├── invoices/
    │   │   ├── page.tsx               # Redirects → /
    │   │   ├── new/
    │   │   │   └── page.tsx           # ➕ Create Invoice form (live pricing preview)
    │   │   └── [id]/
    │   │       └── page.tsx           # 📄 Invoice detail view (full premium UI)
    │   └── api/
    │       ├── invoices/
    │       │   ├── route.ts           # GET list / POST create
    │       │   ├── stats/route.ts     # GET dashboard stats
    │       │   └── [id]/
    │       │       ├── route.ts       # GET single / PATCH update
    │       │       └── resend-email/
    │       │           └── route.ts   # POST resend invoice email
    │       ├── currency/
    │       │   └── route.ts           # GET exchange rates + live pricing preview
    │       └── razorpay/
    │           ├── create-link/
    │           │   └── route.ts       # POST regenerate payment link
    │           └── webhook/
    │               └── route.ts       # POST Razorpay webhook (mark PAID)
    ├── lib/
    │   ├── db.ts                      # Prisma singleton
    │   ├── pricing.ts                 # Base prices, fee logic, calculator, formatter
    │   ├── currency.ts                # Country→currency map, exchange rate fetcher
    │   ├── razorpay.ts                # Payment link creation + webhook verification
    │   └── email.ts                   # Resend integration + HTML email templates
    └── types/
        └── index.ts                   # Shared TypeScript types
```

---

## ⚡ Quick Start

### 1. Prerequisites

- Node.js 18+
- PostgreSQL (local or hosted — Supabase/Neon free tier works perfectly)
- npm or pnpm

### 2. Install dependencies

```bash
cd ripple-nexus
npm install
```

### 3. Configure environment

`.env.local` is already populated with your **live Razorpay keys**:

```
RAZORPAY_KEY_ID=rzp_live_SajWG4jNWIcHmU
RAZORPAY_KEY_SECRET=f8yvo1nUfNfNdi3V7dsLc1TF
```

You still need to fill in:

```bash
# Your PostgreSQL connection string
DATABASE_URL=postgresql://user:password@host:5432/ripple_nexus

# Resend email API key — get free at https://resend.com
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Update this after setting webhook in Razorpay dashboard
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# For production, set your actual domain
NEXT_PUBLIC_APP_URL=https://invoices.ripplenexus.com
```

### 4. Set up database

```bash
npx prisma generate      # Generate Prisma client
npx prisma db push       # Push schema to your PostgreSQL
# OR for migrations:
npx prisma migrate dev --name init
```

### 5. Run development server

```bash
npm run dev
# → http://localhost:3000
```

---

## 🔑 Keys Already Configured

| Service | Key | Status |
|---------|-----|--------|
| Razorpay Key ID | `rzp_live_SajWG4jNWIcHmU` | ✅ Live |
| Razorpay Secret | `f8yvo1nUfNfNdi3V7dsLc1TF` | ✅ Live |
| Resend | — | ⚠️ Add yours |
| Exchange Rate API | — | ✅ Uses free fallback (open.er-api.com) |

> ⚠️ **Security**: Never commit `.env.local` to Git. It's in `.gitignore` by default.

---

## 💳 Razorpay Webhook Setup

1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Go to **Settings → Webhooks → Add New Webhook**
3. Set URL: `https://your-domain.com/api/razorpay/webhook`
4. Select events: `payment_link.paid`, `payment_link.expired`
5. Copy the **Webhook Secret** → paste into `.env.local` as `RAZORPAY_WEBHOOK_SECRET`

For local testing, use [ngrok](https://ngrok.com):
```bash
ngrok http 3000
# Use the https URL as your webhook URL
```

---

## 📧 Email Setup (Resend)

1. Sign up at [resend.com](https://resend.com) (free: 3,000 emails/month)
2. Add and verify your domain (`ripplenexus.com`)
3. Create an API key → paste as `RESEND_API_KEY`
4. Set `FROM_EMAIL=invoices@ripplenexus.com`

---

## 🌍 Currency System

- **Auto-detection**: Country selected → currency auto-mapped (40+ countries)
- **Manual override**: Admin can type any ISO 4217 code (e.g. `AED`, `SGD`)
- **Exchange rates**: Fetched live from `open.er-api.com` (no key needed) or `exchangerate-api.com` (optional key for higher limits)
- **Cache**: Rates cached in memory for 6 hours to avoid excessive API calls
- **INR payments**: 2% processing fee
- **International**: 3.5% processing fee
- **Locked on creation**: Currency cannot change after invoice is generated

---

## 💰 Pricing Reference

| Client Type | Resume (INR) | LinkedIn (INR) | Cover Letter |
|-------------|-------------|---------------|-------------|
| Fresher | ₹1,499 | ₹999 | FREE |
| Mid-Career | ₹1,999 | ₹1,299 | FREE |
| Executive | ₹3,499 | ₹1,999 | FREE |
| Executive Plus | ₹4,999 | ₹2,499 | FREE |

All prices converted to client's local currency at live exchange rates.

---

## 🏗️ Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List all invoices (filters: status, clientType) |
| POST | `/api/invoices` | Create new invoice |
| GET | `/api/invoices/:id` | Get single invoice |
| PATCH | `/api/invoices/:id` | Update invoice |
| POST | `/api/invoices/:id/resend-email` | Resend invoice email |
| GET | `/api/invoices/stats` | Dashboard statistics |
| GET | `/api/currency` | Get exchange rates + live pricing preview |
| POST | `/api/razorpay/create-link` | (Re)create Razorpay payment link |
| POST | `/api/razorpay/webhook` | Razorpay webhook (mark paid) |

---

## 🗄️ Database Schema

```prisma
model Invoice {
  id                String        # cuid
  invoiceNumber     String        # e.g. RN-2404-8371
  clientName/Email/Phone/Type/Country
  currency          String        # ISO 4217, LOCKED on create
  currencySymbol    String
  exchangeRate      Float         # INR→currency rate at creation
  resumeBaseInr / linkedinBaseInr / coverLetterBaseInr
  resumeConverted / linkedinConverted / coverLetterConverted
  subtotalConverted / processingFeeRate / processingFeeConverted
  totalPayable      Float         # Final amount in client currency
  status            PENDING|PAID|CANCELLED|EXPIRED
  razorpayLinkId / razorpayLinkUrl / razorpayPaymentId
  paidAt            DateTime?
  emailSentAt / emailResendCount
  invoiceDate / dueDate (7 days)
}
```

---

## 🚀 Production Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel --prod
```

Add all `.env.local` variables in Vercel dashboard under **Settings → Environment Variables**.

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Database — Recommended Hosts
- **Supabase** (free PostgreSQL, great DX): supabase.com
- **Neon** (serverless PostgreSQL, generous free tier): neon.tech
- **PlanetScale** (MySQL-compatible): planetscale.com

---

## 🔐 Security Checklist

- [x] Razorpay webhook signature verified via HMAC-SHA256
- [x] Currency locked on invoice creation — cannot be changed
- [x] Razorpay amount matches invoice exactly (smallest unit)
- [x] Input validation via Zod on all POST routes
- [x] Admin-only access via middleware + login
- [ ] Rate limit invoice creation endpoint
- [ ] Add CORS headers for production

### Admin Authentication

This app is private by default: all routes (including `/api/*`) are protected by `middleware.ts`, and access is granted only after signing in at `/login`.

Set these in production:

```bash
ADMIN_PASSWORD=your_admin_password
ADMIN_SESSION_SECRET=your_long_random_secret
```

---

## 🐛 Troubleshooting

**Prisma client not found**
```bash
npx prisma generate
```

**Exchange rate API failing**
The system automatically falls back to hardcoded approximate rates. For production, get a free key at [exchangerate-api.com](https://www.exchangerate-api.com).

**Razorpay "Currency not supported"**
Some currencies are not supported by Razorpay international payments. The system will create the payment link — if Razorpay rejects it, fall back to INR or USD.

**Emails not sending**
- Verify Resend API key is correct
- Confirm your sending domain is verified in Resend dashboard
- Check `FROM_EMAIL` domain matches your verified domain

---

## 📞 Support

Built for Ripple Nexus internal use.  
Razorpay Live Key: `rzp_live_SajWG4jNWIcHmU`
