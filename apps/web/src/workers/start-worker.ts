// Entry point for the BullMQ worker process
// Run with: node --require tsx/cjs src/workers/start-worker.ts
import './run-worker'
import './sequence-worker'
import { startScheduler } from '../lib/scheduler'

console.log('Worker process started. Waiting for jobs...')

// In-process scheduler: fires due actor schedules, ready sequences, and daily
// LinkedIn limit resets every 60s. This is what makes the Schedules page actually fire.
startScheduler()

process.on('SIGINT', () => { console.log('Worker shutting down...'); process.exit(0) })
process.on('SIGTERM', () => { console.log('Worker shutting down...'); process.exit(0) })
