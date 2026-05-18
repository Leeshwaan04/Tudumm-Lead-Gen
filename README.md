# Tudumm

> The unified web automation, data extraction, and lead intelligence platform.
> PhantomBuster + BrightData + Apify — in one product.

---

## What is Tudumm?

Tudumm consolidates three market-leading platforms into a single, unified product:

| Platform | What it does | Tudumm absorbs |
|---|---|---|
| **PhantomBuster** | No-code GTM automation, social media scraping | Phantom/Workflow builder, cookie injection, CRM integrations, AI enrichment |
| **BrightData** | Largest proxy network, managed browser infrastructure | 4-type proxy network, Scraping Browser (CDP), Web Unlocker API, Dataset Marketplace |
| **Apify** | Developer Actor platform, open marketplace, Crawlee | Actor runtime, 27K+ store, SDK, revenue share, storage primitives |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TUDUMM PLATFORM                             │
├─────────────────────────────────────────────────────────────────────┤
│  FRONTEND  apps/web           Next.js 15, React 19, Tailwind        │
├─────────────────────────────────────────────────────────────────────┤
│  API GATEWAY  apps/api-gateway                                      │
│  JWT/APIKey auth · Rate limiting · Service routing                  │
├────────────┬────────────┬─────────────┬────────────┬───────────────┤
│  Auth      │ Execution  │  Billing    │ Marketplace│  Storage      │
│  :8001     │ Engine     │  :8003      │ :8005      │  :8004        │
│  (Go)      │ :8002 (Go) │  (Go+Stripe)│ (Go)       │  (Go)         │
├────────────┴────────────┴─────────────┴────────────┴───────────────┤
│  Browser Service :8007 (Node)    Proxy Router :8008 (Node)         │
│  CDP Gateway · Cookie Inj.       4-type pool · Geo · Anti-bot      │
├─────────────────────────────────────────────────────────────────────┤
│  Scheduling :8006 (Go)           Enrichment :8009 (Python/FastAPI)  │
│  Cron · DAG · RabbitMQ           Claude AI · Email finder           │
├─────────────────────────────────────────────────────────────────────┤
│  PostgreSQL · Redis · ClickHouse · MinIO/S3 · Elasticsearch · Kafka │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
tudumm/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   ├── api-gateway/            # Go API gateway (port 4000)
│   ├── auth-service/           # Go — JWT, OAuth, API keys (8001)
│   ├── execution-engine/       # Go — Docker job runner (8002)
│   ├── billing-service/        # Go — Stripe, credit wallet (8003)
│   ├── storage-service/        # Go — Datasets, KV, Request Queues (8004)
│   ├── marketplace-service/    # Go — Actor registry, revenue share (8005)
│   ├── scheduling-service/     # Go — Cron scheduler, job queue (8006)
│   ├── browser-service/        # Node.js — CDP gateway, browser fleet (8007)
│   ├── proxy-router/           # Node.js — Proxy pool, geo-routing (8008)
│   ├── enrichment-service/     # Python — Claude AI, email finder (8009)
│   └── cli/                    # Go — tudumm CLI
├── packages/
│   ├── ui/                     # React component library
│   ├── sdk-js/                 # TypeScript SDK (@tudumm/sdk)
│   ├── sdk-python/             # Python SDK (tudumm-sdk)
│   ├── types/                  # Shared TypeScript types (@tudumm/types)
│   ├── db/                     # Prisma schema + migrations (@tudumm/db)
│   ├── phantoms/               # Pre-built Phantom definitions
│   ├── actor-template/         # Actor developer template
│   └── config/                 # Shared ESLint/TS configs
├── infra/
│   ├── terraform/              # AWS infrastructure (EKS, RDS, Redis, S3)
│   ├── k8s/                    # Kubernetes manifests + Helm charts
│   └── docker/                 # Per-service Dockerfiles
├── scripts/                    # Dev setup, seed, reset scripts
├── .github/workflows/          # CI (lint+test+build), CD (ECR+EKS), Release
├── docker-compose.yml          # Full local dev stack
├── turbo.json                  # Turborepo pipeline config
├── pnpm-workspace.yaml
└── SCOPE.md                    # Full E2E platform scope document
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, TanStack Query v5, React Flow, Recharts |
| **Backend (primary)** | Go 1.23 (Chi router, pgx, zap) |
| **Browser Automation** | Node.js, Playwright, puppeteer-extra-plugin-stealth |
| **AI Enrichment** | Python, FastAPI, Anthropic Claude SDK |
| **Job Queue** | RabbitMQ + KEDA autoscaling |
| **Workflow Orchestration** | Temporal.io |
| **Primary DB** | PostgreSQL 16 (Prisma for TS, pgx for Go) |
| **Cache** | Redis 7 |
| **Analytics DB** | ClickHouse |
| **Object Storage** | MinIO (dev) / Cloudflare R2 / AWS S3 (prod) |
| **Search** | Elasticsearch 8 |
| **Event Streaming** | Apache Kafka |
| **Infrastructure** | Kubernetes (EKS), Helm, ArgoCD, Terraform |
| **CI/CD** | GitHub Actions |
| **Monitoring** | Prometheus + Grafana + Loki + OpenTelemetry |
| **Payments** | Stripe (Subscriptions + Connect) |

---

## Getting Started (Local Development)

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Go ≥ 1.23
- Docker + Docker Compose
- Python ≥ 3.11 (for enrichment service)

### 1. Clone and install

```bash
git clone https://github.com/your-org/tudumm.git
cd tudumm
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set ANTHROPIC_API_KEY and STRIPE_SECRET_KEY
```

### 3. Start infrastructure

```bash
docker-compose up -d postgres redis rabbitmq minio clickhouse mailhog
```

Or run the full setup script:

```bash
bash scripts/setup-dev.sh
```

### 4. Run database migrations

```bash
pnpm db:migrate
pnpm db:generate
```

### 5. Seed sample data

```bash
pnpm --filter @tudumm/db seed
```

### 6. Start all services

```bash
pnpm dev
```

This starts (via Turborepo):
- `web` on http://localhost:3000
- `api-gateway` on http://localhost:4000
- All backend services on :8001–:8009

### Service URLs (dev)

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:4000 |
| Auth Service | http://localhost:8001 |
| Execution Engine | http://localhost:8002 |
| Billing Service | http://localhost:8003 |
| Storage Service | http://localhost:8004 |
| Marketplace | http://localhost:8005 |
| Scheduling | http://localhost:8006 |
| Browser Service | http://localhost:8007 |
| Proxy Router | http://localhost:8008 |
| Enrichment | http://localhost:8009 |
| RabbitMQ UI | http://localhost:15672 |
| MinIO Console | http://localhost:9001 |
| MailHog | http://localhost:8025 |

---

## Platform Features

### Automation Layer (PhantomBuster-equivalent)
- 150+ pre-built Phantoms: LinkedIn, Instagram, Twitter, Google Maps, YouTube, GitHub, Reddit
- Visual Workflow DAG builder — chain Phantoms with data mapping
- Cookie-based session injection via browser extension
- AI enrichment: personalized messaging, profile summarization (Claude)
- Email finder + verification credits
- CAPTCHA solving integration
- CRM integrations: HubSpot, Salesforce, Pipedrive, Clay, lemlist
- Zapier / Make / n8n connectors

### Infrastructure Layer (BrightData-equivalent)
- **4-type proxy network**: Residential, Datacenter, ISP, Mobile
- **Proxy Router**: intelligent IP selection by geo, domain success rate, sticky sessions
- **Web Unlocker API**: submit any URL, receive clean HTML/JSON/Markdown
- **Scraping Browser (CDP)**: connect your Playwright/Puppeteer code to Tudumm's cloud Chromium
- **SERP API**: structured Google/Bing results with geo-targeting
- **Dataset Marketplace**: pre-collected structured data (LinkedIn, Amazon, Zillow, Crunchbase)
- **Data Delivery**: scheduled ETL to S3, Snowflake, BigQuery

### Developer Platform (Apify-equivalent)
- **Actors**: containerized automation programs with JSON Schema input → auto-generated UI
- **Actor Store**: 27,600+ marketplace actors, one-click deploy, ratings
- **Revenue Share**: 80% to actor developers via Stripe Connect
- **SDK**: TypeScript + Python (Crawlee-compatible)
- **CLI**: `tudumm actor push`, `tudumm run list`, `tudumm dataset export`
- **Storage**: Datasets (append-only), KV Stores, Request Queues
- **Actor Standby**: persistent HTTP endpoint mode for real-time APIs
- **Git CI/CD**: push from GitHub → auto-build → publish Actor version

---

## Pricing

| Plan | Monthly | Exec Hours | Slots | Residential Proxy | AI Credits |
|---|---|---|---|---|---|
| **Starter** | $49 | 20h | 5 | $8/GB | 10,000 |
| **Grow** | $149 | 80h | 15 | $7.5/GB | 30,000 |
| **Scale** | $399 | 300h | 50 | $7/GB | 90,000 |
| **Enterprise** | Custom | Unlimited | Unlimited | $5/GB | Custom |

**Consumption pricing** (on top of plan):
- Compute: $0.15/CU
- Web Unlocker: $1.20/1,000 requests
- SERP API: $2.00/1,000 queries
- Email verification: $0.005/credit

**Developer Marketplace**: 80/20 revenue split — developers earn 80% of all actor usage fees.

---

## Development Phases

| Phase | Timeline | Focus |
|---|---|---|
| **1 — Foundation** | Months 1–3 | Auth, billing, execution engine, storage, basic frontend |
| **2 — Automation** | Months 4–6 | 50 Phantoms, workflow builder, CRM integrations, scheduling |
| **3 — Infrastructure** | Months 7–9 | Proxy router, Web Unlocker, Scraping Browser, SERP API |
| **4 — Developer Platform** | Months 10–12 | Actor store, SDK, CLI, revenue share |
| **5 — Scale & Enterprise** | Months 13–18 | Residential network, dataset marketplace, SSO, ClickHouse analytics |

---

## Contributing

See [SCOPE.md](./SCOPE.md) for the full platform scope and technical architecture decisions.

### Running tests

```bash
pnpm test
```

### Linting and type checking

```bash
pnpm lint
pnpm type-check
```

### Building all packages

```bash
pnpm build
```

---

## License

Proprietary — All rights reserved © 2026 Tudumm, Inc.
