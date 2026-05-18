# Tudumm — End-to-End Platform Scope

> Version: 1.0 | Date: 2026-05-05 | Status: Active R&D

---

## Executive Summary

Tudumm is a unified web automation, data extraction, and lead intelligence platform that consolidates the capabilities of three market leaders into a single product:

| Competitor | Core Strength | Tudumm Absorbs |
|---|---|---|
| **PhantomBuster** | No-code GTM workflow automation, social media scraping | Phantom/Workflow builder, cookie-based session injection, CRM integrations, AI enrichment |
| **BrightData** | World's largest proxy network, managed browser infrastructure, anti-bot | Proxy network (4 types), Scraping Browser (CDP), Web Unlocker API, SERP API, Dataset Marketplace |
| **Apify** | Developer-first Actor platform, open marketplace, Crawlee framework | Actor/Docker-based runtime, marketplace with revenue share, storage primitives, Crawlee-compatible SDK |
| **Clay** | Data enrichment and orchestration for sales teams | Sales-specific workflow DAGs, waterfall enrichment (finding emails across multiple providers) |

---

## Internal Sales Lead Generation Workflow

The platform's primary internal use case is generating high-quality leads "from scratch" using a multi-step enrichment pipeline:

1. **Sourcing**: Use the **LinkedIn Phantom** or **Google Maps Actor** to extract initial profile/business data.
2. **Filtering**: Apply AI-based scoring to identify "Ideal Customer Profile" (ICP) matches.
3. **Waterfall Enrichment**:
    - **Step 1**: Find work email via **Enrichment Service**.
    - **Step 2**: If work email not found, search for personal email.
    - **Step 3**: Verify deliverability via **SMTP verification**.
4. **Contextualization**: Use **Claude 3.5 Sonnet** to summarize the lead's recent posts/activity.
5. **Personalization**: Generate a unique outreach intro based on the summary.
6. **Delivery**: Push the fully enriched lead into **HubSpot/Salesforce** via the **Integration Service**.

---

## Platform Pillars

### 1. Automation Layer (PhantomBuster-equivalent)
- 150+ pre-built Phantoms covering LinkedIn, Instagram, Facebook, X, YouTube, GitHub, Reddit, Google Maps
- Visual Workflow composer (multi-step DAG chains)
- Cookie-based session injection via browser extension
- AI enrichment credits (LLM personalized messaging, profile summarization)
- Email finder + verification credits
- CAPTCHA solving credits
- Native CRM integrations: HubSpot, Salesforce, Pipedrive, Clay, lemlist
- Zapier/Make/n8n connectors
- Execution time slot model (per workspace)

### 2. Infrastructure Layer (BrightData-equivalent)
- **Residential Proxy Network** — 400M+ IP pool (peer SDK model or wholesale)
- **Datacenter Proxy Pool** — shared + dedicated, rotating + sticky
- **ISP Proxy Pool** — static residential-registered IPs
- **Mobile Proxy Pool** — 3G/4G/5G real device IPs
- **Proxy Router** — intelligent IP selection by target domain, geo, success rate
- **Anti-Detection Engine** — TLS fingerprint rotation, User-Agent cycling, CAPTCHA solving, human behavior simulation
- **Web Unlocker API** — single endpoint: submit URL → receive clean HTML/JSON/Markdown, all unblocking handled
- **Scraping Browser (CDP)** — managed Chromium fleet exposed via Chrome DevTools Protocol; drop-in for Playwright/Puppeteer
- **SERP API** — structured Google/Bing results with geo-targeting
- **Dataset Marketplace** — 100+ pre-collected domain datasets (LinkedIn, Amazon, Zillow, Crunchbase, etc.)
- **Dataset Delivery** — scheduled ETL to S3/GCS/Azure Blob/Snowflake/BigQuery

### 3. Developer Platform (Apify-equivalent)
- **Actors** — containerized, Dockerized automation programs; input schema → auto-generated UI
- **Actor Store** — 27,600+ actor marketplace; one-click deploy; developer publishing pipeline
- **Revenue Share** — 80% revenue to actor developers; pay-per-event billing SDK
- **Crawlee-compatible SDK** — JS/TS + Python SDK; local dev → cloud deploy
- **Storage Primitives** — Datasets (append-only), Key-Value Stores (blobs), Request Queues (URL frontier)
- **Actor Standby** — persistent HTTP endpoint mode for real-time Actor APIs
- **Git-based CI/CD** — push from GitHub/GitLab → auto-build → publish Actor version
- **CLI** — `tudumm` CLI for local dev, run, push, deploy

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TUDUMM PLATFORM                             │
├─────────────────────────────────────────────────────────────────────┤
│  FRONTEND (Next.js 15 + App Router)                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Dashboard │ │Marketplace│ │Workflow  │ │Proxy Mgr │ │Datasets  │ │
│  │+ Billing │ │+ Store   │ │Builder   │ │+ Console │ │+ Viewer  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  API GATEWAY (Kong / custom Go gateway)                             │
│  Auth middleware · Rate limiting · Request routing · API keys       │
├────────────┬────────────┬─────────────┬────────────┬───────────────┤
│  Auth      │ Execution  │  Proxy      │ Marketplace│  Billing      │
│  Service   │ Engine     │  Router     │ Service    │  Service      │
│  (Go)      │ (Go)       │  (Rust)     │ (Go)       │  (Go+Stripe)  │
├────────────┴────────────┴─────────────┴────────────┴───────────────┤
│  Browser Automation Layer                                           │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ CDP Gateway     │  │ Cookie Inj.  │  │ Anti-Bot Engine        │ │
│  │ (Chromium Fleet)│  │ Service      │  │ (fingerprint, CAPTCHA) │ │
│  └─────────────────┘  └──────────────┘  └────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  Scheduling & Orchestration                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ Cron Sched. │  │ Job Queue    │  │ DAG Executor (Workflow)  │   │
│  │ (distributed)│  │ (RabbitMQ)   │  │ (temporal.io)            │   │
│  └─────────────┘  └──────────────┘  └──────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  Data Infrastructure                                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │ PostgreSQL │  │ Redis      │  │ ClickHouse │  │ S3-compat   │  │
│  │ (primary)  │  │ (cache+Q)  │  │ (analytics)│  │ (MinIO/R2)  │  │
│  └────────────┘  └────────────┘  └────────────┘  └─────────────┘  │
│  ┌────────────┐  ┌────────────┐                                     │
│  │Elasticsearch│ │ Kafka      │                                     │
│  │ (search)   │  │ (events)   │                                     │
│  └────────────┘  └────────────┘                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Proxy / Networking Layer                                           │
│  Residential (400M+) · Datacenter · ISP · Mobile                   │
│  Geo-targeting · Success-rate routing · Usage metering             │
├─────────────────────────────────────────────────────────────────────┤
│  Infrastructure (Kubernetes + Terraform)                            │
│  AWS EKS / GCP GKE · CloudFront CDN · VPC · Secrets Manager        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
tudumm/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   ├── api-gateway/            # Go API gateway
│   ├── auth-service/           # Go auth + JWT + OAuth
│   ├── execution-engine/       # Go job execution orchestrator
│   ├── proxy-router/           # Rust proxy selection + routing
│   ├── browser-service/        # Node.js CDP gateway + browser fleet
│   ├── scheduling-service/     # Go cron + job queue manager
│   ├── marketplace-service/    # Go actor registry + revenue share
│   ├── billing-service/        # Go Stripe integration + credits
│   ├── storage-service/        # Go datasets + KV + request queues
│   ├── enrichment-service/     # Python AI enrichment (LLM, email finder)
│   ├── unlocker-service/       # Node.js Web Unlocker API
│   └── cli/                    # Go tudumm CLI
├── packages/
│   ├── ui/                     # React component library (shadcn-based)
│   ├── sdk-js/                 # JavaScript/TypeScript SDK (Crawlee-compatible)
│   ├── sdk-python/             # Python SDK
│   ├── types/                  # Shared TypeScript types
│   ├── config/                 # ESLint, TypeScript, Tailwind configs
│   └── db/                     # Prisma schemas + migrations
├── infra/
│   ├── terraform/              # AWS/GCP infrastructure
│   ├── k8s/                    # Kubernetes manifests
│   ├── helm/                   # Helm charts per service
│   └── docker/                 # Dockerfiles per service
├── scripts/                    # Dev setup, seed, migration scripts
├── docs/                       # Architecture docs, API reference
├── turbo.json                  # Turborepo config
├── pnpm-workspace.yaml         # pnpm workspace
└── package.json                # Root package.json
```

---

## Feature Breakdown by Domain

### Frontend Pages & Features

| Page | Description |
|---|---|
| `/` | Landing page with pricing, features, use cases |
| `/dashboard` | Workspace overview: runs, credits, usage charts |
| `/phantoms` | Browse/search pre-built Phantoms; one-click run |
| `/workflows` | Visual workflow DAG builder; Phantom chaining |
| `/actors` | Actor management: my actors, running, history |
| `/store` | Marketplace: search/filter 27K+ actors, ratings |
| `/store/publish` | Actor publishing: Git URL, Docker image, schema editor |
| `/proxy` | Proxy management: type selection, geo-config, usage |
| `/unlocker` | Web Unlocker API: test, configure, view logs |
| `/browser` | Scraping Browser: Playwright endpoint, session mgmt |
| `/datasets` | Dataset viewer: browse, filter, export outputs |
| `/dataset-market` | Pre-collected dataset catalog: search, purchase |
| `/schedules` | Cron scheduler: create/edit/pause scheduled runs |
| `/integrations` | CRM, Zapier, Make, n8n, webhook configuration |
| `/team` | Workspace members: invite, roles, permissions |
| `/billing` | Plan, credits, usage, invoices, payment methods |
| `/api-keys` | Create/revoke API keys with scoped permissions |
| `/docs` | In-app API reference and SDK documentation |
| `/settings` | Workspace + account settings |

### Backend Services Detail

#### Auth Service
- Email/password with bcrypt
- OAuth2: Google, GitHub
- SAML/OIDC SSO (Enterprise)
- JWT access tokens (15min) + refresh tokens (30d)
- API key hashing and validation
- MFA (TOTP)
- IP allowlisting (Enterprise)

#### Execution Engine
- Job lifecycle: QUEUED → RUNNING → SUCCESS/FAILED/CANCELLED
- Container orchestration: pull Docker image, inject env, run, collect output
- Execution time metering (ms precision)
- Memory + CPU accounting
- Slot concurrency enforcement per workspace tier
- Real-time log streaming (WebSocket)
- Output collection → Storage Service

#### Proxy Router (Rust for performance)
- IP pool management: residential, datacenter, ISP, mobile segments
- Request-level proxy selection algorithm:
  - Domain success-rate history
  - Geo-target matching
  - IP reputation scoring
  - Sticky session support (same IP across requests)
- Usage metering (GB) → Billing Service
- Health checking + automatic IP rotation on failure

#### Browser Service
- Managed Chromium fleet (headless-chromium or chrome-launcher)
- CDP proxy: accept external ws:// connections, proxy to fleet instance
- Session pool management (warm instances)
- Cookie injection endpoint: POST `{platform, cookie}` → returns CDP endpoint
- Screenshot API: GET `{url}` → PNG/JPEG response
- Anti-bot middleware: stealth plugin, fingerprint randomization, human timing

#### Scheduling Service
- Distributed cron (etcd-backed leader election)
- Job queue: RabbitMQ with dead-letter queues
- Retry logic: exponential backoff with configurable max retries
- Webhook triggers: inbound HTTP → enqueue job
- Actor-completion triggers: job A done → enqueue job B
- Execution history retention: 90 days default

#### Marketplace Service
- Actor registry: metadata, versioning, Docker image refs
- Publishing pipeline: Git webhook → build → push to registry → publish
- Auto-generated input UI from JSON Schema
- Revenue accounting: per-Actor compute attribution
- Developer payout: monthly settlement (80/20 split)
- Pay-per-event SDK: in-Actor billing event recording
- Ratings + reviews with moderation

#### Billing Service
- Stripe Subscriptions for plan management
- Credit wallet: prepaid credits loaded on plan purchase
- Real-time deduction: execution minutes, proxy GB, AI tokens, email credits, CAPTCHA credits
- Auto-top-up trigger at configurable low-balance threshold
- Overage throttle vs. overage billing (per-plan config)
- Invoice generation and storage
- Usage export API for enterprise customers

#### Storage Service
- Datasets: append-only rows, paginated read API, CSV/JSON/NDJSON export
- Key-Value Stores: arbitrary blob up to 9MB per key, 100MB total per store
- Request Queues: URL deduplication, HEAD/TAIL operations, distributed access
- Backed by PostgreSQL (metadata) + S3-compatible object store (blobs)
- Workspace-level storage quotas per plan tier

#### Enrichment Service (Python)
- LLM integration (Claude 3.5 Sonnet default) for:
  - Personalized outreach message generation
  - LinkedIn profile summarization
  - Company research summaries
- Email finder: domain + name → email candidates (via public data + MX verification)
- Email verification: SMTP handshake + format validation
- URL finder: LinkedIn profile → company domain resolution
- Credit-gated: each operation deducts from enrichment credit balance

### Database Schema Summary

#### PostgreSQL (primary relational store)
- `workspaces` — billing unit, plan, credit balances
- `users` — auth, profile, workspace memberships
- `workspace_members` — user ↔ workspace with role
- `api_keys` — hashed keys, scopes, last-used
- `actors` — marketplace entries: metadata, versioning, author
- `actor_versions` — Docker image, input schema, changelog per version
- `runs` — job execution records: status, duration, metrics, output ref
- `schedules` — cron expressions, trigger type, actor ref, last/next run
- `workflows` — DAG definitions (JSON): nodes, edges, param mappings
- `datasets` — dataset metadata, row count, storage ref
- `dataset_rows` — individual output rows (partitioned by dataset_id)
- `kv_stores` — key-value store metadata
- `kv_entries` — blob entries with S3 key refs
- `request_queues` — queue metadata
- `request_queue_items` — URL + status (PENDING/HANDLED) + dedup hash
- `integrations` — CRM/webhook configs per workspace
- `proxy_sessions` — sticky session: workspace → IP → target domain → expiry
- `credit_transactions` — immutable audit log of all credit deductions/additions
- `invoices` — Stripe invoice records + line items
- `ratings` — Actor ratings + review text
- `developer_payouts` — monthly settlement records per actor author

#### Redis
- Session cache (refresh token → user mapping)
- Job queue backing (RabbitMQ primary, Redis for lightweight queuing)
- Proxy success-rate counters (per domain per proxy)
- Rate limiting counters (sliding window per API key)
- Real-time run metrics (live CPU/memory/log buffer)

#### ClickHouse (analytics)
- `run_metrics` — per-run: duration, records, bytes, credits consumed
- `proxy_requests` — per-request: proxy_id, domain, success, latency, bytes
- `credit_usage` — per-event credit deductions (time-series)
- `actor_usage` — per-actor: runs, revenue, users (for developer analytics)
- `api_requests` — gateway request log (endpoint, status, latency)

---

## Infrastructure

### Cloud (AWS Primary, GCP Secondary)
- **EKS** — Kubernetes cluster for all services
- **RDS PostgreSQL** — Multi-AZ, automated backups
- **ElastiCache Redis** — cluster mode, multi-AZ
- **MSK (Kafka)** — managed Kafka for event streaming
- **S3** — actor Docker layer caching, dataset blob storage
- **CloudFront** — CDN for frontend, static assets
- **ECR** — Docker image registry for user-published actors
- **Secrets Manager** — service credentials, API keys
- **VPC** — private subnets for all services; public subnets only for load balancers
- **WAF** — DDoS protection on API gateway

### Proxy Infrastructure
- Datacenter: leased /24 blocks across 20+ regions
- Residential: peer SDK (browser extension installs) + wholesale upstream (IPRoyal, Oxylabs wholesale)
- ISP: static IPs registered to major ISPs in target markets
- Mobile: SIM farms in key regions + upstream aggregators

### Kubernetes
- Namespace per service
- HPA (horizontal pod autoscaler) on execution-engine, browser-service, proxy-router
- PodDisruptionBudgets for zero-downtime deploys
- NetworkPolicies (zero-trust inter-service)
- KEDA for queue-depth-based autoscaling (execution-engine scales with RabbitMQ depth)

---

## Monetization Model

### Plans

| Plan | Monthly | Credits | Exec Hours | Slots | Residential Proxy | AI Credits | Email Credits |
|---|---|---|---|---|---|---|---|
| **Starter** | $49 | $49 | 20h | 5 | $8/GB | 10,000 | 500 |
| **Grow** | $149 | $149 | 80h | 15 | $7.5/GB | 30,000 | 2,500 |
| **Scale** | $399 | $399 | 300h | 50 | $7/GB | 90,000 | 10,000 |
| **Enterprise** | Custom | Custom | Unlimited | Unlimited | $5/GB | Custom | Custom |

### Consumption Pricing (on top of plan)
- Compute: $0.15/CU (1 CU = 1 CPU-sec × 1 GB-memory-sec)
- Residential proxy: $7–8/GB
- Datacenter proxy: $0.90/GB
- ISP proxy: $5/GB
- Web Unlocker: $1.20/1,000 requests
- SERP API: $2/1,000 queries
- AI enrichment: $0.002/credit
- Email verification: $0.005/credit

### Developer Marketplace
- 80% revenue to actor author
- 20% platform fee
- Developers set per-run, per-page, or per-record pricing
- Monthly settlement via Stripe Connect

---

## Development Phases

### Phase 1 — Foundation (Months 1–3)
- Monorepo, CI/CD, dev environment
- Auth service (email, OAuth, JWT, API keys)
- Billing service (Stripe subscriptions, credit wallet)
- Basic execution engine (run Docker containers, collect output)
- Storage service (datasets, KV, request queues)
- Frontend: auth, dashboard, basic run UI

### Phase 2 — Automation Layer (Months 4–6)
- Browser service (CDP gateway, cookie injection, anti-bot)
- 50 pre-built Phantoms (LinkedIn focus first)
- Workflow builder (DAG composer)
- CRM integrations (HubSpot, Salesforce)
- Scheduling service (cron, triggers)
- Frontend: Phantom store, workflow builder, schedule manager

### Phase 3 — Infrastructure Layer (Months 7–9)
- Proxy router (datacenter + ISP initially; residential via wholesale)
- Web Unlocker API
- Scraping Browser (CDP proxy gateway)
- SERP API
- Frontend: proxy console, unlocker tester, browser session manager

### Phase 4 — Developer Platform (Months 10–12)
- Actor publishing pipeline (Git + Docker)
- Marketplace with ratings, search, discovery
- Developer revenue share (Stripe Connect payouts)
- JS + Python SDK (Crawlee-compatible)
- CLI (`tudumm` CLI)
- Frontend: full store, developer dashboard, actor analytics

### Phase 5 — Scale & Enterprise (Months 13–18)
- Residential proxy network (peer SDK or large-scale wholesale)
- Dataset marketplace (pre-collected structured data)
- Dataset delivery pipelines (S3, Snowflake, BigQuery)
- Enterprise features: SSO, IP allowlisting, dedicated infra
- ClickHouse analytics layer
- Advanced AI enrichment

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui, Zustand, TanStack Query, React Flow (workflow builder) |
| API Gateway | Go (Chi router) or Kong |
| Backend Services | Go (primary), Python (enrichment), Rust (proxy router), Node.js (browser service) |
| Browser Automation | Playwright, Puppeteer, puppeteer-extra-plugin-stealth, Chromium |
| Job Queue | RabbitMQ + KEDA |
| Workflow Orchestration | Temporal.io |
| Primary Database | PostgreSQL 16 (Prisma ORM for TS services, pgx for Go) |
| Cache | Redis 7 (Valkey) |
| Analytics DB | ClickHouse |
| Object Storage | MinIO (self-hosted) / Cloudflare R2 / AWS S3 |
| Search | Elasticsearch 8 / OpenSearch |
| Event Streaming | Apache Kafka (MSK) |
| Container Registry | AWS ECR |
| Orchestration | Kubernetes (EKS), Helm, ArgoCD |
| Infrastructure | Terraform (AWS + GCP), Pulumi (optional) |
| CI/CD | GitHub Actions |
| Monitoring | Prometheus + Grafana + Loki |
| APM | OpenTelemetry → Jaeger |
| Secrets | HashiCorp Vault / AWS Secrets Manager |
| CDN | Cloudflare |
| Payments | Stripe (Subscriptions + Connect for payouts) |
| Auth (social) | OAuth2 via Google, GitHub |
| LLM | Anthropic Claude API (enrichment service) |

---

## Key Differentiators vs. Competitors

1. **Unified Platform** — no switching between PhantomBuster for GTM automation, BrightData for proxy infrastructure, and Apify for custom scraping. One account, one billing, one SDK.
2. **AI-Native** — Claude-powered enrichment built into every workflow. Personalized outreach, profile summarization, and research happen in-pipeline.
3. **Developer + No-Code** — single platform serves both non-technical GTM users (Phantom/Workflow UI) and developers (Actor SDK, CLI, Git deploy).
4. **Transparent Pricing** — one credit unit across all platform capabilities (compute, proxy, AI, email). No separate invoices per product.
5. **Open Ecosystem** — Crawlee-compatible SDK, open-source Actor framework, 80% developer revenue share.

---

*This document is the authoritative scope definition for Tudumm v1.0.*
