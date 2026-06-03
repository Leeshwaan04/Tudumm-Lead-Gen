# Install Playwright + Chromium on node:20-slim (debian, glibc-based).
FROM node:20-slim

# Chromium system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# Use --no-frozen-lockfile to avoid platform binary conflicts between Alpine (dev) and Debian (prod)
RUN pnpm install --no-frozen-lockfile

# Download Chromium for this exact playwright version into /ms-playwright
RUN PLAYWRIGHT_BROWSERS_PATH=/ms-playwright npx playwright install chromium

COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

CMD ["node", "dist/index.js"]
