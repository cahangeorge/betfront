import { prisma } from '#/db'
import { runBridge, type PenaltyblogBridgeResponse } from '#/server/penaltyblog'
import {
  MARKET_OUTCOMES,
  type PredictMarket,
  type PredictModelKey,
  type RunSingleInput,
  runSingleSchema,
} from './types'

type ProbabilityGrid = {
  homeWin?: number
  draw?: number
  awayWin?: number
  bttsYes?: number
  bttsNo?: number
  totals?: Record<string, number>
}

type FitPredictResult = {
  prediction?: ProbabilityGrid
  warnings?: string[]
  dataQuality?: { level: string; totalMatches: number; homeTeamCount: number; awayTeamCount: number }
}

// ─── Match selection ────────────────────────────────────────────────────────

async function fetchTrainingMatches(input: RunSingleInput) {
  const where: any = {
    sport: input.sport,
    homeScore: { not: null },
    awayScore: { not: null },
    league: { contains: input.league },
  }
  if (input.trainingDateFrom || input.trainingDateTo) {
    where.matchDate = {
      ...(input.trainingDateFrom ? { gte: input.trainingDateFrom } : {}),
      ...(input.trainingDateTo ? { lte: input.trainingDateTo } : {}),
    }
  }
  const rows = await prisma.match.findMany({
    where,
    orderBy: [{ matchDate: 'desc' }, { createdAt: 'desc' }],
    take: input.trainingLimit,
    select: { homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, matchDate: true },
  })
  return rows.reverse() // chronological for time-decay weighting
}

async function fetchTargetMatches(input: RunSingleInput) {
  if (input.targetMode === 'matches') {
    if (!input.targetMatchIds?.length) return []
    return prisma.match.findMany({
      where: { id: { in: input.targetMatchIds } },
      select: { id: true, homeTeam: true, awayTeam: true, matchDate: true, league: true },
    })
  }
  const today = new Date().toISOString().slice(0, 10)
  const where: any = {
    sport: input.sport,
    league: { contains: input.league },
  }
  if (input.targetMode === 'future') {
    where.homeScore = null
    where.matchDate = {
      gte: input.targetDateFrom ?? today,
      ...(input.targetDateTo ? { lte: input.targetDateTo } : {}),
    }
  } else {
    // history backtest target
    where.homeScore = { not: null }
    where.matchDate = {
      ...(input.targetDateFrom ? { gte: input.targetDateFrom } : { lt: today }),
      ...(input.targetDateTo ? { lte: input.targetDateTo } : {}),
    }
  }
  return prisma.match.findMany({
    where,
    orderBy: { matchDate: 'asc' },
    take: input.targetLimit,
    select: { id: true, homeTeam: true, awayTeam: true, matchDate: true, league: true },
  })
}

// ─── Grid → market outcomes ────────────────────────────────────────────────

function extractMarketProbabilities(
  grid: ProbabilityGrid,
  market: PredictMarket,
): Array<{ outcome: string; probability: number }> {
  switch (market) {
    case '1x2':
      return [
        { outcome: 'home', probability: Number(grid.homeWin ?? 0) },
        { outcome: 'draw', probability: Number(grid.draw ?? 0) },
        { outcome: 'away', probability: Number(grid.awayWin ?? 0) },
      ]
    case 'btts':
      return [
        { outcome: 'yes', probability: Number(grid.bttsYes ?? 0) },
        { outcome: 'no', probability: Number(grid.bttsNo ?? 0) },
      ]
    case 'ou_2_5':
      return [
        { outcome: 'over', probability: Number(grid.totals?.over_2_5 ?? 0) },
        { outcome: 'under', probability: Number(grid.totals?.under_2_5 ?? 0) },
      ]
    default:
      return []
  }
}

// ─── Single model orchestration ────────────────────────────────────────────

export async function executeSingleModelRun(
  runId: number,
  modelKey: PredictModelKey,
  input: RunSingleInput,
) {
  const training = await fetchTrainingMatches(input)
  if (training.length < 20) {
    throw new Error(`Insufficient training data: ${training.length} matches (need ≥20).`)
  }
  const targets = await fetchTargetMatches(input)
  if (targets.length === 0) {
    throw new Error('No target matches found for this selection.')
  }

  const goalsHome = training.map((m) => Number(m.homeScore))
  const goalsAway = training.map((m) => Number(m.awayScore))
  const teamsHome = training.map((m) => m.homeTeam)
  const teamsAway = training.map((m) => m.awayTeam)

  let written = 0
  let failed = 0

  for (const target of targets) {
    try {
      const response = await runBridge<PenaltyblogBridgeResponse>({
        operation: 'model_fit_predict',
        payload: {
          model: modelKey,
          goals_home: goalsHome,
          goals_away: goalsAway,
          teams_home: teamsHome,
          teams_away: teamsAway,
          prediction: { home_team: target.homeTeam, away_team: target.awayTeam, max_goals: input.maxGoals },
        },
      })
      const result = response.result as FitPredictResult
      const grid = result.prediction
      if (!grid) {
        failed += 1
        continue
      }
      const rows: Array<{
        runId: number
        matchId: number
        modelKey: string
        market: string
        outcome: string
        probability: number
        raw: string | null
      }> = []
      for (const market of input.markets) {
        for (const { outcome, probability } of extractMarketProbabilities(grid, market)) {
          rows.push({
            runId,
            matchId: target.id,
            modelKey,
            market,
            outcome,
            probability,
            raw: market === '1x2' ? JSON.stringify({ dataQuality: result.dataQuality ?? null }) : null,
          })
        }
      }
      if (rows.length) {
        await prisma.modelPrediction.createMany({ data: rows })
        written += rows.length
      }
    } catch (error) {
      failed += 1
      console.error(`[predict] ${modelKey} failed for match ${target.id}:`, error instanceof Error ? error.message : error)
    }
  }

  return {
    trainingMatches: training.length,
    targetMatches: targets.length,
    written,
    failed,
    markets: input.markets,
  }
}

// ─── Public action ──────────────────────────────────────────────────────────

export async function runSingleModelPrediction(_input: unknown) {
  const data = runSingleSchema.parse(_input)

  const run = await prisma.predictionRun.create({
    data: {
      league: data.league,
      source: 'single',
      modelKey: data.modelKey,
      status: 'running',
    },
  })

  // Fire and forget — return jobId immediately so UI can poll.
  void (async () => {
    try {
      const summary = await executeSingleModelRun(run.id, data.modelKey, data)
      await prisma.predictionRun.update({
        where: { id: run.id },
        data: {
          status: 'success',
          finishedAt: new Date(),
          error: JSON.stringify(summary),
        },
      })
    } catch (error) {
      await prisma.predictionRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
        },
      })
    }
  })()

  return { runId: run.id, status: run.status }
}

export function listMarketOutcomes(market: PredictMarket) {
  return MARKET_OUTCOMES[market]
}
