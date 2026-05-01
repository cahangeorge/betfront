import { z } from 'zod'
import cron, { type ScheduledTask } from 'node-cron'
import { prisma } from '#/db'

export const SCHEDULE_KINDS = [
  'scrape_upcoming',
  'scrape_history',
  'predict_ensemble',
  'arbitrage_scan',
] as const
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number]

export const SCHEDULE_KIND_LABELS: Record<ScheduleKind, string> = {
  scrape_upcoming: 'Scrape upcoming fixtures',
  scrape_history: 'Scrape historical results',
  predict_ensemble: 'Run prediction ensemble',
  arbitrage_scan: 'Scan for arbitrage',
}

export const createScheduledJobSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(SCHEDULE_KINDS),
  cron: z.string().min(5),
  payload: z.record(z.string(), z.unknown()).optional(),
  isEnabled: z.boolean().default(true),
})

export const updateScheduledJobSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(120).optional(),
  cron: z.string().min(5).optional(),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  isEnabled: z.boolean().optional(),
})

export const idSchema = z.object({ id: z.number().int().positive() })

const tasks = new Map<number, ScheduledTask>()
let started = false

export function ensureSchedulerStarted() {
  if (started) return
  started = true
  void reloadAllJobs()
}

async function reloadAllJobs() {
  for (const [id, task] of tasks.entries()) {
    try {
      task.stop()
    } catch {}
    tasks.delete(id)
  }
  const jobs = await prisma.scheduledJob.findMany({ where: { isEnabled: true } })
  for (const job of jobs) registerTask(job)
}

function registerTask(job: { id: number; cron: string; name: string }) {
  if (!cron.validate(job.cron)) return
  const task = cron.schedule(job.cron, () => {
    void executeJob(job.id).catch((err) => {
      console.error(`[scheduler] job ${job.id} (${job.name}) failed:`, err)
    })
  })
  tasks.set(job.id, task)
}

export async function executeJob(jobId: number) {
  const job = await prisma.scheduledJob.findUnique({ where: { id: jobId } })
  if (!job) return
  await prisma.scheduledJob.update({
    where: { id: jobId },
    data: { lastStatus: 'running', lastRunAt: new Date() },
  })
  try {
    await dispatchKind(job.kind as ScheduleKind, job.payload ? JSON.parse(job.payload) : {})
    await prisma.scheduledJob.update({
      where: { id: jobId },
      data: { lastStatus: 'success', lastError: null, runCount: { increment: 1 } },
    })
  } catch (err: any) {
    await prisma.scheduledJob.update({
      where: { id: jobId },
      data: { lastStatus: 'failed', lastError: String(err?.message ?? err), runCount: { increment: 1 } },
    })
    throw err
  }
}

async function dispatchKind(kind: ScheduleKind, payload: any) {
  switch (kind) {
    case 'scrape_upcoming': {
      const { runUpcoming } = await import('../scraper')
      return runUpcoming({ data: payload })
    }
    case 'scrape_history': {
      const { runHistoric } = await import('../scraper')
      return runHistoric({ data: payload })
    }
    case 'predict_ensemble': {
      const { runEnsemblePrediction } = await import('../predict/ensemble')
      return runEnsemblePrediction({ data: payload })
    }
    case 'arbitrage_scan': {
      const { scanArbitrage } = await import('../tickets/arbitrage')
      return scanArbitrage({ data: payload })
    }
    default:
      throw new Error(`Unknown schedule kind: ${kind}`)
  }
}

// ─── Public CRUD ───────────────────────────────────────────────────────────

export async function listScheduledJobs() {
  ensureSchedulerStarted()
  const jobs = await prisma.scheduledJob.findMany({ orderBy: { createdAt: 'desc' } })
  return jobs.map((j) => ({
    ...j,
    payload: j.payload ? JSON.parse(j.payload) : null,
  }))
}

export async function createScheduledJob(_input: unknown) {
  const data = createScheduledJobSchema.parse(_input)
  if (!cron.validate(data.cron)) throw new Error(`Invalid cron expression: ${data.cron}`)
  const job = await prisma.scheduledJob.create({
    data: {
      name: data.name,
      kind: data.kind,
      cron: data.cron,
      payload: data.payload ? JSON.stringify(data.payload) : null,
      isEnabled: data.isEnabled,
    },
  })
  if (job.isEnabled) registerTask(job)
  return job
}

export async function updateScheduledJob(_input: unknown) {
  const data = updateScheduledJobSchema.parse(_input)
  const existing = await prisma.scheduledJob.findUnique({ where: { id: data.id } })
  if (!existing) throw new Error('Scheduled job not found')
  if (data.cron && !cron.validate(data.cron)) throw new Error(`Invalid cron: ${data.cron}`)
  const job = await prisma.scheduledJob.update({
    where: { id: data.id },
    data: {
      name: data.name ?? undefined,
      cron: data.cron ?? undefined,
      payload:
        data.payload === undefined
          ? undefined
          : data.payload === null
            ? null
            : JSON.stringify(data.payload),
      isEnabled: data.isEnabled ?? undefined,
    },
  })
  // restart task
  const t = tasks.get(job.id)
  if (t) {
    t.stop()
    tasks.delete(job.id)
  }
  if (job.isEnabled) registerTask(job)
  return job
}

export async function deleteScheduledJob(_input: unknown) {
  const { id } = idSchema.parse(_input)
  const t = tasks.get(id)
  if (t) {
    t.stop()
    tasks.delete(id)
  }
  await prisma.scheduledJob.delete({ where: { id } })
  return { ok: true }
}

export async function runScheduledJobNow(_input: unknown) {
  const { id } = idSchema.parse(_input)
  await executeJob(id)
  return { ok: true }
}

export async function getSchedulerStatus() {
  ensureSchedulerStarted()
  const jobs = await prisma.scheduledJob.count()
  const enabled = await prisma.scheduledJob.count({ where: { isEnabled: true } })
  return {
    started,
    activeTasks: tasks.size,
    totalJobs: jobs,
    enabledJobs: enabled,
    kinds: SCHEDULE_KINDS.map((k) => ({ value: k, label: SCHEDULE_KIND_LABELS[k] })),
  }
}
