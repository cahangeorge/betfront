import { z } from 'zod'
import path from 'node:path'
import { prisma } from '#/db'
import {
  mapFrontbetHistoricalMatches,
  resolveSoccerdataHistoricalMatches,
} from '#/server/penaltyblog.helpers'
import { buildLeagueFilter } from '#/server/leagues'
import { getMatchHistoryGames, getSofascoreSchedule, getWhoScoredSchedule } from '#/server/soccerdata'
import { runBridge as runBridgeRaw, resolveBridgePath } from '#/server/bridge'

const PENALTYBLOG_PYTHON = resolveBridgePath(
  'PENALTYBLOG_PYTHON',
  path.resolve(`${import.meta.dirname}/../../../penaltyblog/.venv/bin/python`),
)
const PENALTYBLOG_BRIDGE = resolveBridgePath(
  'PENALTYBLOG_BRIDGE',
  path.resolve(`${import.meta.dirname}/../../scripts/penaltyblog_bridge.py`),
)
const bridgeOpts = { pythonBin: PENALTYBLOG_PYTHON, bridgeScript: PENALTYBLOG_BRIDGE, label: 'penaltyblog' } as const

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
  return runBridgeRaw<T>(payload, bridgeOpts)
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
      } catch (error) {
        console.error(`[penaltyblog] Soccerdata history failed for season ${season}:`, error instanceof Error ? error.message : error)
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
