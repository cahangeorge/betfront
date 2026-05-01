// Wraps soccerdata bridge operations into the unified ScrapeJob/Match pipeline
// so the History tab can share the same JobsList + matches table as OddsHarvester.

import { z } from 'zod'

import { prisma } from '#/db'
import {
  getEspnSchedule,
  getFBrefSchedule,
  getMatchHistoryGames,
  getSofascoreSchedule,
  getUnderstatSchedule,
} from '#/server/soccerdata'

export const HISTORY_SOURCES = ['FBref', 'ESPN', 'Sofascore', 'MatchHistory', 'Understat'] as const
export type HistorySource = (typeof HISTORY_SOURCES)[number]

export const historyScrapeSchema = z.object({
  source: z.enum(HISTORY_SOURCES),
  league: z.string().min(1),
  season: z.string().min(2),
  sport: z.string().default('football'),
})

export type HistoryScrapeParams = z.infer<typeof historyScrapeSchema>

type ScheduleRow = {
  game?: string
  date?: string
  homeTeam?: string
  awayTeam?: string
  homeGoals?: number | null
  awayGoals?: number | null
  homeXg?: number | null
  awayXg?: number | null
}

async function fetchSchedule(params: HistoryScrapeParams): Promise<{ rows: ScheduleRow[]; raw: unknown }> {
  const { source, league, season } = params
  const args = { league, season } as any

  if (source === 'FBref') {
    const r = await getFBrefSchedule(args)
    return { rows: r.rows as ScheduleRow[], raw: r }
  }
  if (source === 'ESPN') {
    const r = await getEspnSchedule(args)
    return { rows: r.rows as ScheduleRow[], raw: r }
  }
  if (source === 'Sofascore') {
    const r = await getSofascoreSchedule(args)
    return { rows: (r as any).rows as ScheduleRow[], raw: r }
  }
  if (source === 'MatchHistory') {
    const r = await getMatchHistoryGames(args)
    return { rows: r.rows as ScheduleRow[], raw: r }
  }
  if (source === 'Understat') {
    const r = await getUnderstatSchedule(args)
    return { rows: (r as any).rows as ScheduleRow[], raw: r }
  }
  throw new Error(`Unsupported history source: ${source}`)
}

async function persistHistoryRows(
  jobId: number,
  source: HistorySource,
  sport: string,
  rows: ScheduleRow[],
) {
  let inserted = 0
  for (const r of rows) {
    const homeTeam = (r.homeTeam ?? '').toString().trim()
    const awayTeam = (r.awayTeam ?? '').toString().trim()
    if (!homeTeam || !awayTeam) continue

    const matchDate = r.date ?? null
    const homeScore = r.homeGoals != null ? Number(r.homeGoals) : null
    const awayScore = r.awayGoals != null ? Number(r.awayGoals) : null

    const existing = matchDate
      ? await prisma.match.findFirst({
          where: { homeTeam, awayTeam, matchDate, sport },
          orderBy: { id: 'desc' },
        })
      : null

    let match: { id: number }
    if (existing) {
      match = await prisma.match.update({
        where: { id: existing.id },
        data: {
          ...(homeScore != null ? { homeScore } : {}),
          ...(awayScore != null ? { awayScore } : {}),
        },
      })
    } else {
      match = await prisma.match.create({
        data: {
          jobId,
          sport,
          homeTeam,
          awayTeam,
          matchDate,
          homeScore,
          awayScore,
        },
      })
    }

    // MatchSource provenance tag
    await prisma.matchSource
      .upsert({
        where: { matchId_source: { matchId: match.id, source } },
        create: { matchId: match.id, source, externalId: null, url: null, lastSeen: new Date() },
        update: { lastSeen: new Date() },
      })
      .catch(() => {})

    // FBref carries xG — write a MatchStat row when present.
    if (source === 'FBref' && (r.homeXg != null || r.awayXg != null)) {
      await prisma.matchStat
        .upsert({
          where: { matchId_source: { matchId: match.id, source } },
          create: {
            matchId: match.id,
            source,
            xgHome: r.homeXg != null ? Number(r.homeXg) : null,
            xgAway: r.awayXg != null ? Number(r.awayXg) : null,
            data: JSON.stringify(r),
          },
          update: {
            xgHome: r.homeXg != null ? Number(r.homeXg) : null,
            xgAway: r.awayXg != null ? Number(r.awayXg) : null,
            data: JSON.stringify(r),
          },
        })
        .catch(() => {})
    }
    inserted++
  }
  return inserted
}

// Public: fire-and-forget history scrape that mirrors runUpcoming/runHistoric.
export async function runHistoryScrape(input: unknown) {
  const data = historyScrapeSchema.parse(input)

  const job = await prisma.scrapeJob.create({
    data: {
      source: data.source,
      command: 'history_schedule',
      sport: data.sport,
      markets: '',
      league: data.league,
      season: data.season,
      headless: true,
      status: 'running',
    },
  })

  // Fire-and-forget so the UI can poll immediately
  ;(async () => {
    try {
      const { rows, raw } = await fetchSchedule(data)
      const inserted = await persistHistoryRows(job.id, data.source, data.sport, rows)

      const summary = {
        source: data.source,
        league: data.league,
        season: data.season,
        rowCount: rows.length,
        inserted,
      }

      await prisma.scrapedDataset
        .create({
          data: {
            source: data.source,
            operation: 'history_schedule',
            sport: data.sport,
            league: data.league,
            season: data.season,
            date: null,
            rowCount: rows.length,
            data: JSON.stringify(rows),
            summary: JSON.stringify({ ...summary, jobId: job.id }),
          },
        })
        .catch(() => {})

      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: 'success',
          output: JSON.stringify(summary, null, 2),
          finishedAt: new Date(),
        },
      })
      void raw
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: 'failed', output: message, finishedAt: new Date() },
      })
    }
  })().catch(() => {})

  return { jobId: job.id }
}

export async function getHistorySources() {
  return HISTORY_SOURCES.map((s) => ({ value: s, label: s }))
}
