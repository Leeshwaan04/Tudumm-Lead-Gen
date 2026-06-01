// Next.js instrumentation — runs once when the server process boots.
// Starts the BullMQ workers (run + sequence) in-process so the platform needs
// no separate worker service. Fire-and-forget so worker/Redis init never blocks
// the Next.js server from becoming ready (otherwise the healthcheck fails).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.DISABLE_WORKERS === 'true') return

  // Do NOT await — let the server become ready immediately. Worker modules
  // create their BullMQ Worker on import; any Redis connection happens in the
  // background and retries on its own.
  Promise.resolve()
    .then(async () => {
      await import('./workers/run-worker')
      await import('./workers/sequence-worker')
      console.log('[instrumentation] BullMQ workers started in-process')
    })
    .catch((err) => {
      console.error('[instrumentation] Failed to start workers:', err)
    })
}
