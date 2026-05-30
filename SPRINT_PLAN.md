# Tudumm — Remaining Work from CPO Audit

This document tracks the 9 audit findings deferred from the 2026-05-30 fix session.
Commits in scope: `b0b0ad5` (audit batch 1).

---

## Sprint 1 (Week 1-2): Make the product honest

### S1.1 — Real LinkedIn send via browser-service
**Why first:** product currently returns 503 "not yet enabled" for LinkedIn sequences (post-fix). Until this ships, the LinkedIn value prop is non-functional.

**Scope:**
1. `apps/browser-service/src/routes/linkedin.ts` — new file
   - `POST /linkedin/connect` `{ workspaceId, sessionAlias, profileUrl, note? }`
   - `POST /linkedin/message` `{ workspaceId, sessionAlias, profileUrl, body }`
   - Both: load encrypted cookie via cookie-vault, inject into Playwright context, navigate, simulate human typing, submit, verify success state, classify failures (`captcha`, `session_expired`, `rate_limited`, `profile_blocked`)
2. `apps/web/src/lib/browser-client.ts` — typed fetch wrapper with `X-Internal-Secret`
3. Update `executeStep` in `apps/web/src/app/api/sequences/[id]/execute/route.ts` to call browser-client
4. On `session_expired`: mark `LinkedInSession.status = 'EXPIRED'`, surface in UI
5. Set `LINKEDIN_SEND_ENABLED=true` on Railway tudumm-web after E2E test with a real burner account

**Effort:** 4-5 days (1 senior). Requires a burner LinkedIn account for testing.
**Risk:** LinkedIn DOM changes weekly. Build selector indirection layer.

### S1.2 — BullMQ-backed sequence execution
**Why:** current execute endpoint is sync, has no retry/DLQ, no per-account daily caps. Concurrent calls double-send (the `claimedAt/claimedBy` columns added in `b0b0ad5` are unused).

**Scope:**
1. `apps/web/src/lib/queues/sequence-queue.ts` — BullMQ queue + worker
2. Worker loop: claim batch with `UPDATE sequence_leads SET claimedAt=NOW(), claimedBy=$1 WHERE id IN (...) AND claimedAt IS NULL` (atomic claim)
3. Per-LinkedInSession daily cap check against `dailyUsed` vs `dailyLimit`; reset at UTC midnight (cron)
4. Retry policy: exponential backoff, 3 attempts, DLQ after that
5. Deploy worker as a separate Railway service (or background process in tudumm-web with PM2)
6. Cron service to advance `nextStepAt` and enqueue ready leads

**Effort:** 3-4 days. BullMQ already in package.json; Redis already provisioned.

### S1.3 — Invite-with-token + email verification
**Why:** current invite (`apps/web/src/app/api/members/route.ts`) creates ghost accounts. No email verification on register.

**Scope:**
1. New table `EmailToken` `{ id, userId, type (VERIFY|INVITE), token, expiresAt }` — 24h expiry verify, 7d invite
2. `POST /api/auth/register` → generate VERIFY token, send via SMTP, set `emailVerified=false` until clicked
3. `GET /api/auth/verify?token=...` → flip `emailVerified=true`, delete token
4. Middleware: block dashboard if `!emailVerified` (except `/settings/profile` and `/verify-pending`)
5. `POST /api/members` (invite): generate INVITE token, send email with `/accept-invite?token=...` link
6. `POST /api/members/accept` → create or attach user to workspace, mark token used
7. SMTP: use existing nodemailer dep + Railway env (`SMTP_HOST/USER/PASS/FROM`)

**Effort:** 2-3 days.

---

## Sprint 2 (Week 3): Plan enforcement & multi-tenancy polish

### S2.1 — Plan enforcement helper
**Scope:**
1. `apps/web/src/lib/plan-gate.ts` — `requireCredits(workspaceId, amount, type)` throws `InsufficientCreditsError`
2. Call sites: every `/api/leads/enrich`, `/api/runs/enqueue`, `/api/sequences/[id]/execute`
3. Reserve credits BEFORE running, refund on failure (transactional)
4. UI: show credit balance in topbar; redirect to `/billing/upgrade` on 402

**Effort:** 2 days.

### S2.2 — Workspace switching
**Scope:**
1. `auth.ts` jwt callback: store `workspaceIds[]` instead of single `workspaceId`
2. Session `workspaceId` reads from cookie `tudumm_active_ws` (defaults to first)
3. `POST /api/workspace/switch` → validates membership, sets cookie
4. UI: workspace dropdown in topbar

**Effort:** 1 day.

### S2.3 — AuditLog call sites
**Scope:** table already exists. Wire writes at:
- `lead.created`, `lead.deleted`, `lead.exported`
- `member.invited`, `member.removed`, `member.role_changed`
- `session.cookie_uploaded`, `session.cookie_deleted`
- `api_key.created`, `api_key.revoked`
- `billing.plan_changed`, `billing.payment_method_updated`

**Effort:** 1 day (mechanical).

---

## Sprint 3 (Week 4): Compliance & hardening

### S3.1 — GDPR data export + account deletion
**Scope:**
1. `POST /api/settings/export` → enqueues background job → emails ZIP of all user data within 24h
2. `POST /api/settings/delete-account` → 7-day grace period (`User.deletionScheduledAt`), then cascade delete
3. Workspace deletion if user is sole OWNER (or transfer ownership flow)

**Effort:** 2-3 days. Needs lawyer review for export contents.

### S3.2 — K8s actor sandboxing
**Scope:** `apps/orchestrator/internal/executor/k8s.go`:
1. `SecurityContext`: `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, drop ALL capabilities
2. Resource limits per plan (STARTER: 512Mi/500m, GROW: 1Gi/1000m, SCALE: 2Gi/2000m)
3. NetworkPolicy: egress only to `proxy-router` service
4. Restrict actor image registry to `tudumm/actor-*` allowlist (image pull policy `Always`)

**Effort:** 2 days. Requires K8s policy admin.

### S3.3 — Move LinkedIn cookies to MinIO with per-workspace KMS keys
**Why:** single Postgres dump currently exposes every customer's LinkedIn account.

**Scope:**
1. Generate per-workspace KEK on workspace creation, store in Vault/SOPS (NOT in Postgres)
2. Cookie bytes go to MinIO `s3://cookies/{workspaceId}/{sessionId}` encrypted with KEK
3. Postgres stores only `s3Key` + KEK reference
4. Migration script: read existing encrypted `sessionCookie`, decrypt, re-encrypt with new KEK, write to MinIO, null out DB column

**Effort:** 3-4 days. Multi-day rollout with feature flag.

---

## Already shipped in `b0b0ad5`

| # | Item | Status |
|---|------|--------|
| 4 | error.tsx / loading.tsx / not-found.tsx | ✅ |
| 6 | Robust CSV parser + dedup | ✅ |
| 10 | Sequence step Zod-style validation | ✅ |
| 13 | Stripe webhook idempotency | ✅ |
| 18 | Sequence step schema validation | ✅ |
| 19 | Case-insensitive lead search | ✅ |
| #5 | Fail-closed credit enforcement | ✅ |
| #1 (mitigated) | LINKEDIN_SEND_ENABLED feature flag — product no longer lies | ✅ |
| Schema | Lead unique, soft-delete, indexes, AuditLog/ProcessedStripeEvent tables | ✅ |
| Polish | Playbook isPublic=false default, CSP tightening | ✅ |

---

## Cumulative effort estimate

| Sprint | Calendar | Effort (senior eng) |
|--------|----------|---------------------|
| Sprint 1 | Weeks 1-2 | 9-12 days |
| Sprint 2 | Week 3 | 4 days |
| Sprint 3 | Week 4 | 7-9 days |
| **Total** | **~4 weeks** | **20-25 days** |

Suggested order if resourced sequentially: **S1.3 (invite/verify) → S1.1 (LinkedIn) → S1.2 (BullMQ) → S2.1 (plan gates) → S2.2 (workspace switch) → S2.3 (audit logs) → S3.x in parallel.**

The first item to ship (S1.3) is also the lowest risk — it unblocks team plans and is a prerequisite for compliance conversations.
