# 🛡️ Razorpay Retain — AI-Powered Revenue Recovery Orchestrator

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/Frontend-React%2019-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Bundler-Vite-646CFF.svg?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Razorpay](https://img.shields.io/badge/Gateway-Razorpay%20API-0C2340.svg?style=flat-square&logo=razorpay&logoColor=white)](https://razorpay.com)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB.svg?style=flat-square&logo=python&logoColor=white)](https://www.python.org)
[![SQLite / Postgres](https://img.shields.io/badge/Database-SQLAlchemy%20Async-4479A1.svg?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlalchemy.org)
[![Docker](https://img.shields.io/badge/Container-Docker%20Compose-2496ED.svg?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)

---

## 📌 Executive Summary

**Razorpay Retain** is an enterprise-grade, autonomous revenue recovery orchestrator designed to intercept, diagnose, and recover at-risk revenue across modern payment lifecycles. It tackles revenue leakages arising from:
- **Payment Failures**: Insufficient funds, 3D Secure / OTP timeouts, network glitches, card issuer declines, and UPI collect rejections.
- **Checkout Cart Drop-offs**: Incomplete checkout sessions, abandoned carts, and client-side modal dismissals.
- **B2B Overdue Invoices**: Expired payment links, delayed commercial invoices, and unpaid receivable notices.
- **Recurring Subscription Mandates**: Halted auto-debits, recurring charge failures, and mandate lapses.

By fusing a **Polymorphic Diagnostic Engine**, **Thompson Sampling Multi-Armed Bandit (Reinforcement Learning)**, **Risk-Gated Human-in-the-Loop (HITL) Review Queue**, and a **Dual-Ingestion Pipeline (Webhooks + Polling Safety Net)**, Razorpay Retain provides an automated, adaptive, and explainable recovery workflow with zero data loss.

---

## 🏛️ End-to-End System Architecture

```
                                  ┌────────────────────────┐
                                  │ Razorpay Test Gateway  │
                                  │ (Orders, Payments,     │
                                  │  Invoices, Webhooks)   │
                                  └──────────┬─────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │                                           │
         1a. Real-Time Webhook (HMAC-SHA256)         1b. Polling Safety Net Worker
         (POST /api/webhooks/razorpay)               (Background Sync every 20-60s)
                       │                                           │
                       └─────────────────────┬─────────────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │ 2. EVENT INGESTER         │
                               │  - Deduplication          │
                               │  - Idempotency Guarantee │
                               │  - Ingest RevenueEvent    │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │ 3. DIAGNOSTIC ENGINE      │
                               │  - Root Cause Analysis    │
                               │  - Confidence & Severity  │
                               │  - Systemic Outage Check  │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │ 4. RECOVERY POLICY        │
                               │  - Thompson Sampling MAB  │
                               │  - Beta(α, β) Posteriors  │
                               │  - Action Selection       │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │ 5. VERIFIER & RISK GATE   │
                               │  - High-Value (> ₹10k)    │
                               │  - Concession / Discount  │
                               │  - Systemic Gateway Outage│
                               └───────┬───────────┬───────┘
                                       │           │
                     Requires Review   │           │ Auto-Approved
                     (review: pending) │           │ (review: not_required)
                                       │           │
                                       ▼           │
                        ┌──────────────────────┐   │
                        │ 6. HUMAN REVIEW      │   │
                        │    QUEUE             │   │
                        │ - Operator Approves  │───┘
                        │ - Operator Rejects   │──────► [Execution Halted & Audited]
                        └──────────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │ 7. POLYMORPHIC ACTION ACTOR  │
                        │ - Real Razorpay Payment Link │
                        │ - Alternate Payment Rails    │
                        │ - Cart Revival / Reminders   │
                        │ - Invoice Grace Notices      │
                        │ - Automatic Retry Triggers   │
                        └──────────────┬───────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │ 8. VERIFICATION & LEARNING   │
                        │ - Webhook / Polling Confirm  │
                        │ - Status: verified_success   │
                        │ - Reward Update: α ◄- α + 1  │
                        │ - Full Audit Trail Recorded  │
                        └──────────────────────────────┘
```

---

## 💡 Key Architectural Pillars

### 1. Dual-Ingestion Resilience (Zero Dropouts)
- **Primary Channel**: Real-time Razorpay Webhook receiver with strict HMAC-SHA256 signature verification.
- **Fallback Channel**: Polling Safety Net background worker querying Razorpay REST APIs for pending orders, failed transactions, and expired invoices using `razorpay_object_id` for strict idempotency.
- **Resilience Guarantee**: If an ngrok tunnel drops during a live demo or network partitioned environment, the Polling Safety Net automatically synchronizes and processes all missed events.

### 2. Polymorphic Diagnostic Engine
Analyzes raw Razorpay error parameters (`error_code`, `error_description`, `error_source`, `error_step`, `error_reason`) to determine:
- **Root Cause Category**: `insufficient_funds`, `auth_failure` (OTP/3DS), `gateway_down`, `customer_cancelled`, `cart_abandonment`, `invoice_overdue`, or `subscription_halted`.
- **Severity Score (1–5)** & **Confidence Metric (0.0–1.0)**.
- **Systemic Outage Detection**: Identifies bank/network gateway downtime affecting broad traffic.

### 3. Bayesian Multi-Armed Bandit (Thompson Sampling)
- Maintains continuous probability distributions $\theta_k \sim \text{Beta}(\alpha_k, \beta_k)$ for each recovery strategy per event type.
- Balances **exploitation** (deploying historically high-converting recovery actions) and **exploration** (testing underutilized actions).
- Dynamically updates posterior distributions ($\alpha \leftarrow \alpha + 1$ upon verified settlement, $\beta \leftarrow \beta + 1$ upon verified expiry/failure) providing mathematical explainability for every recommendation.

### 4. Risk-Gated Human-in-the-Loop (HITL) Guardrails
Automated execution is safely intercepted and routed to the **Review Queue** (`review_status = 'pending'`) if:
1. **High Transaction Value**: Amount exceeds threshold ($> \text{₹10,000.00}$ / $1,000,000\text{ paise}$).
2. **Financial Concessions**: Strategy involves commercial margin reduction (discounts, fee waivers).
3. **Systemic Gateway Alerts**: Gateway downtime or widespread outages requiring manual intervention.

---

## 🗂️ Codebase & Directory Structure

```
Razorpay project/
├── backend/
│   ├── app/
│   │   ├── middleware/              # Security headers, rate limiting, and CORS
│   │   ├── routers/                 # FastAPI REST Endpoints
│   │   │   ├── audit.py             # Audit trail & explainability routes
│   │   │   ├── checkout.py          # Interactive checkout, payment links, invoices
│   │   │   ├── dashboard.py         # Recovery KPI aggregations & analytics
│   │   │   ├── events.py            # Revenue event inspection & filtering
│   │   │   ├── health.py            # Healthcheck & dependency probes
│   │   │   ├── polling.py           # Polling fallback controls & intervals
│   │   │   ├── recovery.py          # Policy stats, bandit posteriors, action triggering
│   │   │   ├── review.py            # HITL review queue approval / rejection
│   │   │   └── webhooks.py          # Razorpay HMAC-verified webhook ingestion
│   │   ├── services/                # Core Business Logic Engines
│   │   │   ├── actor.py             # Polymorphic action dispatch & execution
│   │   │   ├── audit_logger.py      # Immutable audit trail ledger writer
│   │   │   ├── diagnosis_engine.py  # Root cause & severity polymorphic classifier
│   │   │   ├── event_ingester.py    # Idempotent event ingestion & orchestration
│   │   │   ├── recovery_policy.py   # Thompson Sampling bandit policy engine
│   │   │   └── verifier.py          # Verification & bandit reward updater
│   │   ├── workers/                 # Background Asynchronous Workers
│   │   │   ├── abandonment_detector.py # Inactive cart dropoff detector
│   │   │   └── polling_fallback.py  # Background safety net sync worker
│   │   ├── config.py                # Pydantic Settings & environment validation
│   │   ├── database.py              # SQLAlchemy Async Engine, SessionFactory & Base
│   │   ├── models.py                # Relational ORM models (RevenueEvent, Diagnosis, etc.)
│   │   ├── razorpay_client.py       # Official Razorpay SDK integration wrapper
│   │   ├── schemas.py               # Pydantic schemas & response models
│   │   └── main.py                  # FastAPI application entry point & lifespan
│   ├── tests/                       # Pytest Test Suite
│   ├── Dockerfile                   # Production multi-stage Python container
│   ├── requirements.txt             # Python dependencies
│   └── .env.example                 # Backend environment variable template
│
├── frontend/
│   ├── src/
│   │   ├── api/                     # Axios API clients & endpoint bindings
│   │   ├── components/              # Reusable UI components (Layout, Badges, Metrics)
│   │   ├── context/                 # React Context (ThemeContext, NotificationContext)
│   │   ├── pages/                   # Main Page Views
│   │   │   ├── Dashboard.jsx        # KPI metrics, recovery graphs & live feeds
│   │   │   ├── Events.jsx           # Filterable incident list & diagnostic details
│   │   │   ├── ReviewQueue.jsx      # HITL approval / rejection interface
│   │   │   ├── Recovery.jsx         # Bandit posteriors & strategy performance
│   │   │   ├── Audit.jsx            # Chronological audit ledger & explainability
│   │   │   └── LiveTerminal.jsx     # Live Razorpay checkout, links & scenario driver
│   │   ├── App.jsx                  # React Router definitions
│   │   ├── main.jsx                 # React root DOM mount
│   │   └── index.css                # Tailwind CSS / custom design tokens
│   ├── nginx.conf                   # Nginx reverse proxy configuration for production
│   ├── Dockerfile                   # Multi-stage Vite build + Nginx production container
│   └── package.json                 # Frontend dependencies & scripts
│
├── docker-compose.yml               # Multi-container orchestration specification
├── .env.production.example          # Full-stack production environment template
└── README.md                        # Complete project documentation
```

---

## ⚡ Quick Start & Installation

### Prerequisites
- **Python**: 3.11 or higher
- **Node.js**: 18 or higher (with `npm`)
- **Razorpay Account**: Free Razorpay Test Mode API Key & Secret ([dashboard.razorpay.com](https://dashboard.razorpay.com/app/keys))
- **ngrok** (optional for live webhooks): [ngrok.com](https://ngrok.com)

---

### Option A: Local Development Setup

#### 1. Configure Backend Environment
```bash
cd backend
cp .env.example .env
```
Edit `backend/.env`:
```env
ENVIRONMENT=development
DATABASE_URL=sqlite+aiosqlite:///./revenue_recovery.db
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_HERE
RAZORPAY_KEY_SECRET=YOUR_SECRET_HERE
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
PUBLIC_WEBHOOK_URL=http://localhost:8000
POLLING_INTERVAL_SECONDS=20
```

#### 2. Install Dependencies & Start Backend
```bash
# In backend directory:
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)

#### 3. Install Dependencies & Start Frontend
```bash
cd ../frontend
npm install
npm run dev
```
- Web Application: [http://localhost:5173](http://localhost:5173)

---

### Option B: Docker Compose (One-Click Launch)

```bash
# In root directory:
cp .env.production.example .env

# Start all containers in background
docker-compose up --build -d
```
- Frontend UI: [http://localhost](http://localhost)
- Backend API: [http://localhost:8000](http://localhost:8000)

---

## 🌐 Public Webhook Tunnel Setup (ngrok)

To receive real-time webhooks from the Razorpay Sandbox:

### 1. Launch ngrok Tunnel
```bash
ngrok http 8000
```

### 2. Update Backend `.env`
```env
PUBLIC_WEBHOOK_URL=https://abcdef123.ngrok-free.app
RAZORPAY_WEBHOOK_SECRET=my_secure_secret_123
```

### 3. Configure Razorpay Dashboard Webhook
In [Razorpay Test Dashboard](https://dashboard.razorpay.com/) $\rightarrow$ **Settings** $\rightarrow$ **Webhooks**:
- **Webhook URL**: `https://<your-ngrok-subdomain>.ngrok-free.app/api/webhooks/razorpay`
- **Secret**: `my_secure_secret_123`
- **Subscribed Events**:
  - `payment.failed`
  - `payment.captured`
  - `order.paid`
  - `invoice.expired`
  - `subscription.charged.failed`
  - `subscription.halted`

---

## 🃏 Documented Razorpay Test Cards Reference

Use these documented test credentials in the **Live Checkout Terminal** (`/terminal`) to trigger authentic gateway failure modes:

| Test Scenario | Card Number / Details | Expiry / CVV | Expected Gateway Response |
| :--- | :--- | :--- | :--- |
| **Insufficient Funds** | `4384 7968 2770 3274` (Visa) | Any Future / `111` | `BAD_REQUEST_ERROR` / `insufficient_funds` |
| **Issuer Decline** | `5312 6865 5677 9641` (Mastercard) | Any Future / `111` | `GATEWAY_ERROR` / `issuer_decline` |
| **3DS / OTP Auth Failure** | Standard Test Card | Enter Invalid OTP | `BAD_REQUEST_ERROR` / `invalid_otp` |
| **Gateway Timeout / Outage** | NetBanking Test Modal | Close / Timeout | `GATEWAY_ERROR` / `gateway_down` |
| **UPI Collect Decline** | UPI ID: `failure@razorpay` | N/A | `BAD_REQUEST_ERROR` / `customer_cancelled` |

---

## 🔌 API Reference

### 🛒 Checkout & Ingestion
- `GET /api/checkout/config`: Returns public Razorpay key ID, gateway connection status, and active webhook configuration.
- `POST /api/checkout/create-order`: Creates a real Order on the Razorpay Test API for Standard Checkout.
- `POST /api/checkout/create-payment-link`: Generates a payable Razorpay Payment Link (`short_url`).
- `POST /api/checkout/create-invoice`: Generates a formal B2B invoice on Razorpay.
- `POST /api/checkout/notify-failure`: Client-side interceptor for immediate payment modal failures.
- `POST /api/checkout/sync-now`: Triggers immediate synchronization via the Polling Safety Net.

### 📥 Webhooks
- `POST /api/webhooks/razorpay`: HMAC SHA256 verified ingestion endpoint for Razorpay webhook events.

### 🛡️ Human-in-the-Loop (HITL) Review Queue
- `GET /api/review-queue`: Fetches pending review items with full diagnostic context and bandit recommendations.
- `GET /api/review-queue/count`: Returns count of pending reviews for live sidebar badges.
- `POST /api/review/{id}/approve`: Approves a pending recovery action, logging operator identity and triggering execution.
- `POST /api/review/{id}/reject`: Rejects a pending recovery action with a mandatory audit reason.

### 📊 Dashboard, Policy & Audit
- `GET /api/dashboard/summary`: High-level recovery metrics (total at risk, recovered amount, recovery rate, active incidents).
- `GET /api/events`: Paginated, filterable incident history with root causes and severity scores.
- `GET /api/recovery/policy-stats`: Beta distribution posteriors ($\alpha, \beta$, win rates, attempt counts) for all recovery strategies.
- `GET /api/audit/trail`: Immutable chronological audit logs with plain-language explainability dossiers.

---

## 🧪 Testing & Verification

Run the automated test suite with `pytest`:

```bash
cd backend
# Run all unit and integration tests
pytest

# Run with verbose output
pytest -v

# Run specific test suites
pytest tests/test_health_and_security.py
pytest tests/test_recovery_and_bandit.py
pytest tests/test_review_queue.py
pytest tests/test_webhooks_and_ingestion.py
```

---

## 🔒 Security & Reliability Features

- **HMAC SHA256 Signature Verification**: Eliminates spoofed webhook submissions.
- **Idempotency Guarantees**: Enforces unique database constraints on `razorpay_object_id` to prevent duplicate billing or actions.
- **Security Headers & Rate Limiting**: Built-in security middleware configured for production hardening.
- **Non-Destructive Database Fallbacks**: Safe fallback mechanisms for test sandbox environments.

---

## 📜 License

This project is licensed under the **MIT License**.
