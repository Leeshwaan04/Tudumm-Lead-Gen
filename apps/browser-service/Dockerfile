# Use Playwright's official CI image which has Chromium pre-installed and
# all environment variables set correctly for headless operation.
# This is the same approach as playwright's own Docker recommendations.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy AS base

ENV NODE_ENV=production
# Browsers are pre-installed in /ms-playwright by the base image
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install pnpm
RUN npm install -g pnpm@9.15.4

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile --prod=false

COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

CMD ["node", "dist/index.js"]
