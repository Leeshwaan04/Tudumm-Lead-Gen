// Entry point for the BullMQ worker process
// Run with: node --require tsx/cjs src/workers/start-worker.ts
import './run-worker'
console.log('Worker process started. Waiting for jobs...')

process.on('SIGINT', () => { console.log('Worker shutting down...'); process.exit(0) })
process.on('SIGTERM', () => { console.log('Worker shutting down...'); process.exit(0) })
