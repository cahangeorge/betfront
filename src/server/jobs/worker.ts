/**
 * Standalone scheduler worker. Run via `pnpm worker` for production.
 * In dev, the scheduler boots lazily on first call to listScheduledJobs().
 */
import { ensureSchedulerStarted } from './scheduler'

console.log('[worker] starting scheduler…')
ensureSchedulerStarted()

// Keep alive
setInterval(() => {}, 1 << 30)
