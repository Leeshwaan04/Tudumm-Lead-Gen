#!/bin/sh
set -e

cd /app/apps/web

# Apply schema changes to DB on startup (safe for nullable column additions)
npx prisma db push --accept-data-loss --skip-generate 2>&1 || echo "[entrypoint] prisma db push skipped (non-fatal)"

# Start BullMQ workers in background
if [ -f "node_modules/tsx/dist/cli.mjs" ]; then
  node node_modules/tsx/dist/cli.mjs src/workers/start-worker.ts &
  echo "[entrypoint] BullMQ workers started (PID: $!)"
else
  echo "[entrypoint] tsx not found, workers not started"
fi

exec node /app/apps/web/server.js
