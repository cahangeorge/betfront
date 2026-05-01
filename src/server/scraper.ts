// Public surface for the scrape pillar.
// Internals live under #/server/scrape/ — this file only exposes the
// `export async function` entries that gen-actions.mjs picks up.

import { z } from 'zod'

import { prisma } from '#/db'

import { loadLeagueCatalog } from './scrape/league-catalog'
import {
  buildHistoricArgs,
  buildUpcomingArgs,
  parseProgress,
  runCli,
  runCliSimple,
  runningProcesses,
} from './scrape/oddsharvester-cli'
import { persistMatches, persistPeriodOdds } from './scrape/persistence'
import {
  historicParamsSchema,
  upcomingParamsSchema,
  type HistoricInput,
  type UpcomingInput,
} from './scrape/types'

// Re-export public types so existing imports keep working.
export type { LeagueCatalogItem, UpcomingParams, HistoricParams } from './scrape/types'
export { upcomingParamsSchema, historicParamsSchema } from './scrape/types'

// Soccerdata-driven history scraping (FBref/ESPN/Sofascore/MatchHistory/Understat).
import {
  getHistorySources as _getHistorySources,
  runHistoryScrape as _runHistoryScrape,
} from './scrape/soccerdata-jobs'

export async function runHistoryScrape(_input: unknown) {
  return _runHistoryScrape(_input)
}
export async function getHistorySources() {
  return _getHistorySources()
}

// ─── Run scraper subprocess ───────────────────────────────────────────────────

export async function runUpcoming(_input: unknown) {
  const data = ((d: UpcomingInput) => upcomingParamsSchema.parse(d))(_input as any)

  const job = await prisma.scrapeJob.create({
    data: {
      command: 'upcoming',
      sport: data.sport,
      markets: data.markets ?? '',
      league: data.league ?? null,
      date: data.date ?? null,
      headless: data.headless,
      status: 'running',
    },
  })

  const outputPath = `/tmp/oddsharvester_out_${job.id}`
  const args = buildUpcomingArgs(data, outputPath)

  // Fire-and-forget: respond immediately so the UI can poll for status
  runCli(args, job.id)
    .then(async ({ success }) => {
      if (success) {
        const ext = data.outputFormat === 'csv' ? 'csv' : 'json'
        const matchMap = await persistMatches(`${outputPath}.${ext}`, data.sport, job.id)
        // For football: also scrape 1st half and 2nd half odds (best-effort, no status impact)
        if (data.sport === 'football' && !data.period) {
          for (const extraPeriod of ['1st_half', '2nd_half']) {
            const periodOut = `${outputPath}_${extraPeriod}`
            const periodArgs = buildUpcomingArgs({ ...data, period: extraPeriod }, periodOut)
            const { success: ps } = await runCliSimple(periodArgs)
            if (ps) await persistPeriodOdds(`${periodOut}.${ext}`, data.sport, matchMap)
          }
        }
      }
    })
    .catch(() => {
      /* errors already written to DB by runCli */
    })

  return { jobId: job.id }
}

export async function runHistoric(_input: unknown) {
  const data = ((d: HistoricInput) => historicParamsSchema.parse(d))(_input as any)

  const job = await prisma.scrapeJob.create({
    data: {
      command: 'historic',
      sport: data.sport,
      markets: data.markets ?? '',
      league: data.league ?? null,
      season: data.season,
      headless: data.headless,
      status: 'running',
    },
  })

  const outputPath = `/tmp/oddsharvester_out_${job.id}`
  const args = buildHistoricArgs(data, outputPath)

  // Fire-and-forget: respond immediately so the UI can poll for status
  runCli(args, job.id)
    .then(async ({ success }) => {
      if (success) {
        const ext = data.outputFormat === 'csv' ? 'csv' : 'json'
        const matchMap = await persistMatches(`${outputPath}.${ext}`, data.sport, job.id)
        if (data.sport === 'football' && !data.period) {
          for (const extraPeriod of ['1st_half', '2nd_half']) {
            const periodOut = `${outputPath}_${extraPeriod}`
            const periodArgs = buildHistoricArgs({ ...data, period: extraPeriod }, periodOut)
            const { success: ps } = await runCliSimple(periodArgs)
            if (ps) await persistPeriodOdds(`${periodOut}.${ext}`, data.sport, matchMap)
          }
        }
      }
    })
    .catch(() => {
      /* errors already written to DB by runCli */
    })

  return { jobId: job.id }
}

// ─── Job + match queries ─────────────────────────────────────────────────────

export async function getJobs(_input?: unknown) {
  const filter = (_input ?? {}) as { source?: string }
  const where = filter.source ? { source: filter.source } : {}
  const rows = await prisma.scrapeJob.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      source: true,
      command: true,
      sport: true,
      markets: true,
      league: true,
      date: true,
      season: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      _count: { select: { matches: true } },
      output: true,
    },
  })
  return rows.map((j) => ({
    id: j.id,
    source: j.source,
    command: j.command,
    sport: j.sport,
    markets: j.markets,
    league: j.league,
    date: j.date,
    season: j.season,
    status: j.status,
    startedAt: j.startedAt,
    finishedAt: j.finishedAt,
    _count: j._count,
    progress: parseProgress(j.output),
  }))
}

export async function getLeagueCatalog() {
  return loadLeagueCatalog()
}

export async function getJobById(_input: unknown) {
  const data = ((d: number) => z.number().parse(d))(_input as any)

  return prisma.scrapeJob.findUnique({
    where: { id: data },
    include: { matches: { include: { odds: true } } },
  })
}

// Lightweight poll: returns only status + output (avoids transferring match data on every tick)
export async function getJobOutput(_input: unknown) {
  const data = ((d: number) => z.number().parse(d))(_input as any)

  return prisma.scrapeJob.findUnique({
    where: { id: data },
    select: { status: true, output: true },
  })
}

// Return all currently running scrape jobs (for resuming after page refresh)
export async function getRunningJobs() {
  return prisma.scrapeJob.findMany({
    where: { status: 'running' },
    select: { id: true, command: true, league: true, startedAt: true },
    orderBy: { startedAt: 'desc' },
  })
}

// Mark a stuck/timed-out job as failed so it doesn't remain in 'running' state
export async function cancelJob(_input: unknown) {
  const data = ((d: number) => z.number().parse(d))(_input as any)

  // Kill the OS process if still running
  const proc = runningProcesses.get(data)
  if (proc) {
    proc.kill('SIGTERM')
    runningProcesses.delete(data)
  }
  await prisma.scrapeJob.updateMany({
    where: { id: data, status: 'running' },
    data: { status: 'failed', output: 'Cancelled', finishedAt: new Date() },
  })
}

export async function getMatches(_input: unknown) {
  const data = (
    (d: { sport?: string; league?: string; jobId?: number; dateFrom?: string; dateTo?: string }) =>
      d
  )(_input as any)

  const dateWhere =
    !data.jobId && (data.dateFrom || data.dateTo)
      ? {
          matchDate: {
            ...(data.dateFrom ? { gte: data.dateFrom } : {}),
            ...(data.dateTo ? { lte: `${data.dateTo}T23:59:59.999Z` } : {}),
          },
        }
      : {}

  return prisma.match.findMany({
    where: {
      ...(data.sport ? { sport: data.sport } : {}),
      ...(data.league ? { league: { contains: data.league } } : {}),
      ...(data.jobId ? { jobId: data.jobId } : {}),
      ...dateWhere,
    },
    orderBy: { matchDate: 'desc' },
    take: 1000,
    include: { odds: true, job: { select: { command: true, sport: true, league: true, markets: true } } },
  })
}

export async function restartJob(_input: unknown) {
  const jobId = ((d: number) => z.number().parse(d))(_input as any)

  const original = await prisma.scrapeJob.findUniqueOrThrow({ where: { id: jobId } })

  const newJob = await prisma.scrapeJob.create({
    data: {
      command: original.command,
      sport: original.sport,
      markets: original.markets,
      league: original.league ?? null,
      date: original.date ?? null,
      season: original.season ?? null,
      headless: original.headless,
      status: 'running',
    },
  })

  const outputPath = `/tmp/oddsharvester_out_${newJob.id}`

  if (original.command === 'upcoming') {
    const params = upcomingParamsSchema.parse({
      sport: original.sport,
      markets: original.markets || undefined,
      league: original.league ?? undefined,
      date: original.date ?? undefined,
      headless: original.headless,
    })
    const args = buildUpcomingArgs(params, outputPath)
    runCli(args, newJob.id)
      .then(async ({ success }) => {
        if (success) {
          const matchMap = await persistMatches(`${outputPath}.json`, original.sport, newJob.id)
          if (original.sport === 'football') {
            for (const extraPeriod of ['1st_half', '2nd_half']) {
              const periodOut = `${outputPath}_${extraPeriod}`
              const periodArgs = buildUpcomingArgs({ ...params, period: extraPeriod }, periodOut)
              const { success: ps } = await runCliSimple(periodArgs)
              if (ps) await persistPeriodOdds(`${periodOut}.json`, original.sport, matchMap)
            }
          }
        }
      })
      .catch(() => {})
  } else {
    const params = historicParamsSchema.parse({
      sport: original.sport,
      season: original.season ?? '',
      markets: original.markets || undefined,
      league: original.league ?? undefined,
      headless: original.headless,
    })
    const args = buildHistoricArgs(params, outputPath)
    runCli(args, newJob.id)
      .then(async ({ success }) => {
        if (success) {
          const matchMap = await persistMatches(`${outputPath}.json`, original.sport, newJob.id)
          if (original.sport === 'football') {
            for (const extraPeriod of ['1st_half', '2nd_half']) {
              const periodOut = `${outputPath}_${extraPeriod}`
              const periodArgs = buildHistoricArgs({ ...params, period: extraPeriod }, periodOut)
              const { success: ps } = await runCliSimple(periodArgs)
              if (ps) await persistPeriodOdds(`${periodOut}.json`, original.sport, matchMap)
            }
          }
        }
      })
      .catch(() => {})
  }

  return { jobId: newJob.id }
}

export async function deleteJob(_input: unknown) {
  const data = ((d: number) => z.number().parse(d))(_input as any)
  await prisma.scrapeJob.delete({ where: { id: data } })
  return { ok: true }
}

export async function deleteJobs(_input: unknown) {
  const data = ((d: number[]) => z.array(z.number()).parse(d))(_input as any)
  await prisma.scrapeJob.deleteMany({ where: { id: { in: data } } })
  return { ok: true, deleted: data.length }
}

export async function deleteMatches(_input: unknown) {
  const data = ((d: number[]) => z.array(z.number()).parse(d))(_input as any)
  await prisma.match.deleteMany({ where: { id: { in: data } } })
  return { ok: true, deleted: data.length }
}
