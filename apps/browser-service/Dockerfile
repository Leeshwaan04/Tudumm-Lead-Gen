# Base on the official Playwright image so Chromium + all system deps are
# preinstalled at /ms-playwright (matched to the playwright npm version, 1.60.0).
# The previous node:20-alpine image never installed browsers, so every scrape
# failed with "Executable doesn't exist at .../ms-playwright".
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3001)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.js"]
# rebuilt Wed Jun  3 13:56:23 IST 2026
