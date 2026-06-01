# ── Stage 1: Install dependencies ─────────────────────────────────────────────
# Build context must be the MONOREPO ROOT
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat openssl openssl-dev
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=deps /app ./

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Dummy DATABASE_URL so prisma generate doesn't fail at build time
ENV DATABASE_URL=postgresql://localhost:5432/dummy

RUN cd apps/web && npx prisma generate
RUN pnpm --filter tudumm-web build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Prisma client for workers
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder /app/apps/web/node_modules/.prisma ./apps/web/node_modules/.prisma
COPY --from=builder /app/apps/web/node_modules/@prisma ./apps/web/node_modules/@prisma

# Worker runtime deps
COPY --from=builder /app/apps/web/node_modules/tsx ./apps/web/node_modules/tsx
COPY --from=builder /app/apps/web/node_modules/bullmq ./apps/web/node_modules/bullmq
COPY --from=builder /app/apps/web/node_modules/ioredis ./apps/web/node_modules/ioredis
COPY --from=builder /app/apps/web/node_modules/nodemailer ./apps/web/node_modules/nodemailer
COPY --from=builder /app/apps/web/node_modules/bcryptjs ./apps/web/node_modules/bcryptjs

# Worker source files
COPY --from=builder /app/apps/web/src/workers ./apps/web/src/workers
COPY --from=builder /app/apps/web/src/lib ./apps/web/src/lib
COPY --from=builder /app/apps/web/tsconfig.json ./apps/web/tsconfig.json

COPY apps/web/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --spider -q http://localhost:3000/api/health || exit 1

CMD ["./entrypoint.sh"]
