// Next.js instrumentation — runs once when the server process boots.
// We use it to start the BullMQ workers (run + sequence) in-process so the
// platform needs no separate worker service. Guarded to the Node.js runtime
// (workers use ioredis/bullmq which are not Edge-compatible).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.DISABLE_WORKERS === 'true') return

  try {
    await import('./workers/run-worker')
    await import('./workers/sequence-worker')
    console.log('[instrumentation] BullMQ workers started in-process')
  } catch (err) {
    console.error('[instrumentation] Failed to start workers:', err)
  }
}
