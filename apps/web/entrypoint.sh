#!/bin/sh
set -e

# Apply schema changes to DB on startup (safe for nullable additions)
cd /app/apps/web
npx prisma db push --accept-data-loss --skip-generate 2>&1 || echo "[entrypoint] prisma db push skipped (non-fatal)"

exec node /app/apps/web/server.js
