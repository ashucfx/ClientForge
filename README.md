# ClientForge OS

ClientForge is a modern, full-stack Enterprise Operational OS designed to power both **Catalyst** (Career Services) and **Ripple Nexus** (B2B Agency Operations) from a unified backend while strictly isolating multi-tenant frontends. 

It is designed to handle high-touch, long-lifecycle client services—merging onboarding, invoicing, collaborative deliverables, and asynchronous communication into a single pane of glass.

---

## 🏗 System Architecture

ClientForge uses Next.js 14 (App Router) on the frontend and backend, with a PostgreSQL database (Prisma ORM) and Tailwind CSS for styling. The core design principle is **strict tenant isolation** at the middleware layer.

```mermaid
graph TD
    subgraph Clients
      C[Catalyst Client]
      RN[Ripple Nexus Client]
    end
    
    subgraph Vercel Edge
      M{Middleware.ts}
    end
    
    subgraph ClientForge Application
      subgraph Catalyst Sector
        CP[Career Portal]
        CA[Career Admin]
      end
      
      subgraph Ripple Nexus Sector
        RNP[B2B Portal]
        RNA[B2B Admin]
      end
      
      subgraph Shared Core
        GCP[Global Command Palette]
        Search[Unified /api/search]
        Kanban[Workload Kanban]
      end
    end
    
    subgraph Data Layer
      DB[(PostgreSQL NeonDB)]
      R[Razorpay Webhooks]
      E[Resend Emails]
    end

    C --> M
    RN --> M
    
    M -- "tenant: catalyst" --> CP
    M -- "tenant: ripple_nexus" --> RNP
    
    CP --> DB
    CA --> DB
    RNP --> DB
    RNA --> DB
    
    Shared Core --> DB
    R --> Shared Core
    Shared Core --> E
```

---

## 💳 Payment & Onboarding Workflow

The invoice and payment pipeline operates completely idempotently, triggering distinct onboarding flows based on the attached product/service.

```mermaid
sequenceDiagram
    participant Admin
    participant Client
    participant App as ClientForge API
    participant Razorpay
    participant Resend

    Admin->>App: Create Invoice (Catalyst/RN)
    App->>Razorpay: Generate Payment Link
    App->>Resend: Dispatch Invoice Email
    Resend->>Client: "You have a new invoice"
    
    Client->>Razorpay: Completes Payment
    Razorpay-->>App: Webhook (payment_link.paid)
    App->>App: Verify Signature & Idempotency
    
    alt is Catalyst Invoice
        App->>App: provision CareerClient
        App->>Resend: Dispatch Catalyst Welcome Email
    else is Ripple Nexus Invoice
        App->>App: provision RnOrganization
        App->>Resend: Dispatch Nexus Welcome Email
    end
    
    App->>Client: Send "Payment Confirmed" Receipt
```

---

## 💬 Client Portal & Deliverable Annotation Flow

ClientForge enables precise, asynchronous feedback loops on design deliverables and documents.

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED: Client completes forms
    
    state "Agency Operations" as Agency {
        SUBMITTED --> UNDER_PROCESS: Admin reviews
        UNDER_PROCESS --> DRAFT_SENT: Admin uploads file
    }
    
    state "Client Portal" as Portal {
        DRAFT_SENT --> REVISION_REQUESTED: Client reviews in DeliverableViewer
        note right of REVISION_REQUESTED
            Client drops precise (X,Y) 
            pin annotations on the image.
        end note
    }
    
    REVISION_REQUESTED --> UNDER_PROCESS: Admin receives feedback
    DRAFT_SENT --> COMPLETED: Client Approves
    COMPLETED --> [*]
```

---

## 🛡 Admin Workload Management

Managing hundreds of high-touch clients is streamlined via the **Global Command Palette** and the **Workload Kanban**.

```mermaid
flowchart LR
    A[Admin] --> K(Workload Kanban)
    A --> C(Command Palette CMD+K)
    
    K --> W[Waiting on Agency]
    K --> Y[Waiting on Client]
    
    C --> Search[Fuzzy Search]
    Search --> |Finds| C1(Catalyst Clients)
    Search --> |Finds| R1(Ripple Nexus Projects)
    Search --> |Finds| I1(Global Invoices)
```

---

## 🚀 Deployment & Environment

**Tech Stack:**
* **Framework:** Next.js 14 (App Router)
* **Database:** PostgreSQL (Neon Serverless)
* **ORM:** Prisma
* **Styling:** Tailwind CSS + Framer Motion
* **Payments:** Razorpay
* **Emails:** Resend + React Email

**Required Environment Variables:**
```env
# Database
DATABASE_URL=
DIRECT_URL=

# App Configuration
NEXT_PUBLIC_APP_URL=
ADMIN_SESSION_SECRET=

# Third-Party Integrations
RESEND_API_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```
