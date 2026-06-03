# Two-stage build.
# Stage 1: build TypeScript on node:20-slim (matches the pnpm lockfile's platform).
# Stage 2: runtime on the official Playwright image (Chromium pre-installed at /ms-playwright).
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

ENV NODE_ENV=production
# Tell Playwright where the pre-installed browsers live in this image.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# playwright:jammy ships with Node 20 and curl.
# Railway overrides PORT at runtime; the app reads process.env.PORT.
EXPOSE 3001

HEALTHCHECK --interval=20s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "const p=process.env.PORT||3001;require('http').get('http://localhost:'+p+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.js"]
