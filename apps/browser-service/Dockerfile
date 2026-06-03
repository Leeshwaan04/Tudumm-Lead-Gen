# Two-stage build.
# Stage 1: build the TypeScript on a standard Node image (avoids lockfile conflicts).
# Stage 2: runtime on the official Playwright image (Chromium pre-installed).
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

# ─── Runtime ──────────────────────────────────────────────────────────────────
# mcr.microsoft.com/playwright:v1.60.0-jammy has Chromium + all system deps
# pre-installed at /ms-playwright, owned by root. The service launches the
# browser at scrape-time (not startup), so startup is fast.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3001

HEALTHCHECK --interval=20s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -sf http://localhost:${PORT:-3001}/health > /dev/null || exit 1

CMD ["node", "dist/index.js"]
