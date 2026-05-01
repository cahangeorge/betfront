import { spawnLogged as spawn } from '#/server/dev-log'
import { readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { prisma } from '#/db'
import {
  mapFrontbetHistoricalMatches,
  resolveSoccerdataHistoricalMatches,
} from '#/server/penaltyblog.helpers'
import { getMatchHistoryGames, getSofascoreSchedule, getWhoScoredSchedule } from '#/server/soccerdata'

const PENALTYBLOG_PYTHON = path.resolve(`${import.meta.dirname}/../../../penaltyblog/.venv/bin/python`)
const PENALTYBLOG_BRIDGE = path.resolve(`${import.meta.dirname}/../../scripts/penaltyblog_bridge.py`)

export type PenaltyblogCatalog = {
  groups: Array<{
    id: string
    label: string
    operations: Array<{
      id: string
      label: string
      description: string
    }>
  }>
}

export type PenaltyblogBridgeResponse = {
  operation: string
  result: unknown
}

export type PenaltyblogHistoricalMatch = {
  source: 'frontbet' | 'soccerdata'
  league: string | null
  date: string
  team_home: string
  team_away: string
  goals_home: number
  goals_away: number
  home_odds: number | null
  draw_odds: number | null
  away_odds: number | null
}

const penaltyblogRequestSchema = z.object({
  operation: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
})

const penaltyblogHistorySchema = z
  .object({
    source: z.enum(['frontbet', 'soccerdata']),
    sport: z.string().min(1).default('football'),
    league: z.string().optional(),
    season: z.string().optional(),
    seasons: z.array(z.string()).optional(),
    jobId: z.number().int().positive().optional(),
    limit: z.number().int().min(5).max(500).default(50),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    refresh: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.source === 'soccerdata') {
      if (!data.league) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['league'],
          message: 'League is required for soccerdata history.',
        })
      }

      if (!data.season) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['season'],
          message: 'Season is required for soccerdata history.',
        })
      }
    }
  })

export async function runBridge<T>(payload: Record<string, unknown>): Promise<T> {
  const outputPath = `/tmp/frontbet_penaltyblog_${Date.now()}_${Math.random().toString(36).slice(2)}.json`

  return new Promise((resolve, reject) => {
    const proc = spawn(
      PENALTYBLOG_PYTHON,
      [PENALTYBLOG_BRIDGE, '--payload', JSON.stringify(payload), '--output', outputPath],
      {
        detached: true,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
      },
    )

    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    const timeout = setTimeout(() => {
      try {
        process.kill(-proc.pid!, 'SIGTERM')
      } catch {
        // already exited
      }
      reject(new Error('penaltyblog request timed out'))
    }, 180_000)

    proc.on('close', async (code) => {
      clearTimeout(timeout)

      try {
        const text = await readFile(outputPath, 'utf-8')
        const parsed = JSON.parse(text) as { ok: boolean; result?: T; error?: string }
        await unlink(outputPath).catch(() => undefined)

        if (!parsed.ok || code !== 0) {
          reject(new Error(parsed.error ?? (stderr.trim() || 'penaltyblog bridge failed')))
          return
        }

        resolve(parsed.result as T)
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to read penaltyblog response'))
      }
    })

    proc.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

function buildLeagueFilter(league: string) {
  const trimmed = league.trim()
  if (!trimmed) return []

  const terms = new Set<string>([trimmed])
  const withoutPrefix = trimmed.replace(/^[A-Z]{2,4}-/, '').trim()
  if (withoutPrefix) terms.add(withoutPrefix)

  // Match exact name AND season-suffixed variants (e.g. "Serie A 2024/2025")
  // Use startsWith to catch "Serie A" → "Serie A", "Serie A 2024/2025", etc.
  // Also match via the Job's OddsHarvester league slug (e.g. "italy-serie-a")
  const filters: Array<Record<string, any>> = []
  for (const term of terms) {
    filters.push({ league: { equals: term } })
    filters.push({ league: { startsWith: `${term} ` } })
  }
  // Also match by the job's league slug (OddsHarvester format like "italy-serie-a")
  // Use endsWith to catch "italy-serie-a" when searching for "serie-a"
  const slug = trimmed.toLowerCase().replace(/\s+/g, '-')
  filters.push({ job: { league: { equals: slug } } })
  filters.push({ job: { league: { endsWith: `-${slug}` } } })
  if (withoutPrefix !== trimmed) {
    const withoutPrefixSlug = withoutPrefix.toLowerCase().replace(/\s+/g, '-')
    filters.push({ job: { league: { equals: withoutPrefixSlug } } })
    filters.push({ job: { league: { endsWith: `-${withoutPrefixSlug}` } } })
  }
  return filters
}

export async function getPenaltyblogCatalog() {
  const response = await runBridge<PenaltyblogBridgeResponse>({ operation: 'catalog' })
  return response.result as PenaltyblogCatalog

}
export async function runPenaltyblogOperation(_input: unknown) {
  const data = ((data: z.infer<typeof penaltyblogRequestSchema>) => penaltyblogRequestSchema.parse(data))(_input as any);

    return await runBridge<PenaltyblogBridgeResponse>(data)
  
}
export async function getPenaltyblogHistoricalMatches(_input: unknown) {
  const data = ((data: z.infer<typeof penaltyblogHistorySchema>) => penaltyblogHistorySchema.parse(data))(_input as any);

    if (data.source === 'frontbet') {
      const leagueFilters = data.league ? buildLeagueFilter(data.league) : []

      const matches = await prisma.match.findMany({
        where: {
          ...(data.sport ? { sport: data.sport } : {}),
          ...(leagueFilters.length > 0
            ? { OR: leagueFilters }
            : {}),
          ...(data.jobId ? { jobId: data.jobId } : {}),
          ...(data.dateFrom || data.dateTo
            ? {
                matchDate: {
                  ...(data.dateFrom ? { gte: data.dateFrom } : {}),
                  ...(data.dateTo ? { lte: data.dateTo } : {}),
                },
              }
            : {}),
          homeScore: { not: null },
          awayScore: { not: null },
        },
        orderBy: [{ matchDate: 'asc' }, { createdAt: 'asc' }],
        take: data.limit,
        include: {
          odds: {
            select: {
              oddsHome: true,
              oddsDraw: true,
              oddsAway: true,
            },
          },
        },
      })

      return mapFrontbetHistoricalMatches(matches)
    }

    // Support multiple seasons: merge results from each season
    const seasons = data.seasons?.length ? data.seasons : [data.season!]
    const allSdMatches: PenaltyblogHistoricalMatch[] = []

    for (const season of seasons) {
      try {
        const result = await resolveSoccerdataHistoricalMatches(
          {
            league: data.league!,
            season,
            limit: data.limit,
            refresh: data.refresh,
          },
          {
            loadMatchHistoryGames: (request) =>
              getMatchHistoryGames({ data: request }),
            loadWhoScoredSchedule: (request) =>
              getWhoScoredSchedule({ data: request }),
            loadSofascoreSchedule: (request) =>
              getSofascoreSchedule({ data: request }),
          },
        )
        allSdMatches.push(...result)
      } catch {
        // Skip seasons that fail, continue with others
      }
    }

    if (allSdMatches.length === 0) {
      throw new Error(`No historical data found for ${data.league} in seasons: ${seasons.join(', ')}`)
    }

    return allSdMatches
  
}
const countHistorySchema = z.object({
  sport: z.string().default('football'),
  league: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export async function countHistoricalMatches(_input: unknown) {
  const data = ((data: z.infer<typeof countHistorySchema>) => countHistorySchema.parse(data))(_input as any);

    const leagueFilters = data.league ? buildLeagueFilter(data.league) : []
    const count = await prisma.match.count({
      where: {
        ...(data.sport ? { sport: data.sport } : {}),
        ...(leagueFilters.length > 0
          ? { OR: leagueFilters }
          : {}),
        ...(data.dateFrom || data.dateTo
          ? {
              matchDate: {
                ...(data.dateFrom ? { gte: data.dateFrom } : {}),
                ...(data.dateTo ? { lte: data.dateTo } : {}),
              },
            }
          : {}),
        homeScore: { not: null },
        awayScore: { not: null },
      },
    })
    return { count }
  
}
