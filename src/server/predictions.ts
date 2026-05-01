import { z } from 'zod'
import { prisma } from '#/db'
import {
  runSingleModelPrediction as _runSingleModelPrediction,
} from './predict/engine'
import {
  runEnsemblePrediction as _runEnsemblePrediction,
} from './predict/ensemble'
import {
  listPredictionRuns as _listPredictionRuns,
  getPredictionRun as _getPredictionRun,
  deletePredictionRun as _deletePredictionRun,
  getPredictCatalog as _getPredictCatalog,
} from './predict/runs'
import {
  computeBrierScores as _computeBrierScores,
  computeEnsembleWeights as _computeEnsembleWeights,
} from './predict/backtest'

// ─── Phase 3 predict pillar wrappers (picked up by gen-actions.mjs) ──────

export async function runSingleModelPrediction(_input: unknown) {
  return _runSingleModelPrediction(_input)
}

export async function runEnsemblePrediction(_input: unknown) {
  return _runEnsemblePrediction(_input)
}

export async function listPredictionRuns(_input?: unknown) {
  return _listPredictionRuns(_input)
}

export async function getPredictionRun(_input: unknown) {
  return _getPredictionRun(_input)
}

export async function deletePredictionRun(_input: unknown) {
  return _deletePredictionRun(_input)
}

export async function getPredictCatalog() {
  return _getPredictCatalog()
}

export async function computeBrierScores(_input: unknown) {
  return _computeBrierScores(_input)
}

export async function computeEnsembleWeights(_input: unknown) {
  return _computeEnsembleWeights(_input)
}


// ─── Types ────────────────────────────────────────────────────────────────────

export type PredictionRow = {
  homeTeam: string
  awayTeam: string
  matchDate: string | null
  league: string | null
  homeWinProb: number | null
  drawProb: number | null
  awayWinProb: number | null
  predictedGoalsHome: number | null
  predictedGoalsAway: number | null
  predictedOutcome: string | null
  confidence: number | null
  dc1X: number | null
  dcX2: number | null
  dc12: number | null
  dnbHome: number | null
  dnbAway: number | null
  over15: number | null
  under15: number | null
  over25: number | null
  under25: number | null
  over35: number | null
  under35: number | null
  bttsYes: number | null
  bttsNo: number | null
  ahHome: number | null
  ahAway: number | null
  // 1st Half
  htHomeWinProb: number | null
  htDrawProb: number | null
  htAwayWinProb: number | null
  htGoalsHome: number | null
  htGoalsAway: number | null
  htDc1X: number | null
  htDcX2: number | null
  htDc12: number | null
  htDnbHome: number | null
  htDnbAway: number | null
  htOver15: number | null
  htUnder15: number | null
  htOver25: number | null
  htUnder25: number | null
  htOver35: number | null
  htUnder35: number | null
  htBttsYes: number | null
  htBttsNo: number | null
  htAhHome: number | null
  htAhAway: number | null
  // 2nd Half
  shHomeWinProb: number | null
  shDrawProb: number | null
  shAwayWinProb: number | null
  shGoalsHome: number | null
  shGoalsAway: number | null
  shDc1X: number | null
  shDcX2: number | null
  shDc12: number | null
  shDnbHome: number | null
  shDnbAway: number | null
  shOver15: number | null
  shUnder15: number | null
  shOver25: number | null
  shUnder25: number | null
  shOver35: number | null
  shUnder35: number | null
  shBttsYes: number | null
  shBttsNo: number | null
  shAhHome: number | null
  shAhAway: number | null
  isValueBet: boolean
  valueBetMarket: string | null
  bookmakerOdds: number | null
  expectedValue: number | null
}

export type SessionWithStats = {
  id: number
  league: string
  source: string
  model: string
  config: string | null
  matchCount: number
  createdAt: string
  predictions: Array<{
    id: number
    homeTeam: string
    awayTeam: string
    matchDate: string | null
    league: string | null
    homeWinProb: number | null
    drawProb: number | null
    awayWinProb: number | null
    predictedGoalsHome: number | null
    predictedGoalsAway: number | null
    predictedOutcome: string | null
    confidence: number | null
    dc1X: number | null
    dcX2: number | null
    dc12: number | null
    dnbHome: number | null
    dnbAway: number | null
    over15: number | null
    under15: number | null
    over25: number | null
    under25: number | null
    over35: number | null
    under35: number | null
    bttsYes: number | null
    bttsNo: number | null
    ahHome: number | null
    ahAway: number | null
    htHomeWinProb: number | null
    htDrawProb: number | null
    htAwayWinProb: number | null
    htGoalsHome: number | null
    htGoalsAway: number | null
    htDc1X: number | null
    htDcX2: number | null
    htDc12: number | null
    htDnbHome: number | null
    htDnbAway: number | null
    htOver15: number | null
    htUnder15: number | null
    htOver25: number | null
    htUnder25: number | null
    htOver35: number | null
    htUnder35: number | null
    htBttsYes: number | null
    htBttsNo: number | null
    htAhHome: number | null
    htAhAway: number | null
    shHomeWinProb: number | null
    shDrawProb: number | null
    shAwayWinProb: number | null
    shGoalsHome: number | null
    shGoalsAway: number | null
    shDc1X: number | null
    shDcX2: number | null
    shDc12: number | null
    shDnbHome: number | null
    shDnbAway: number | null
    shOver15: number | null
    shUnder15: number | null
    shOver25: number | null
    shUnder25: number | null
    shOver35: number | null
    shUnder35: number | null
    shBttsYes: number | null
    shBttsNo: number | null
    shAhHome: number | null
    shAhAway: number | null
    isValueBet: boolean
    valueBetMarket: string | null
    bookmakerOdds: number | null
    expectedValue: number | null
    actualOutcome: string | null
    isCorrect: boolean | null
    createdAt: string
  }>
}

// ─── Save a prediction session ────────────────────────────────────────────────

const savePredictionSessionSchema = z.object({
  league: z.string(),
  source: z.string(),
  model: z.string(),
  config: z.string().optional(),
  predictions: z.array(
    z.object({
      homeTeam: z.string(),
      awayTeam: z.string(),
      matchDate: z.string().nullable().optional(),
      league: z.string().nullable().optional(),
      homeWinProb: z.number().nullable().optional(),
      drawProb: z.number().nullable().optional(),
      awayWinProb: z.number().nullable().optional(),
      predictedGoalsHome: z.number().nullable().optional(),
      predictedGoalsAway: z.number().nullable().optional(),
      predictedOutcome: z.string().nullable().optional(),
      confidence: z.number().nullable().optional(),
      dc1X: z.number().nullable().optional(),
      dcX2: z.number().nullable().optional(),
      dc12: z.number().nullable().optional(),
      dnbHome: z.number().nullable().optional(),
      dnbAway: z.number().nullable().optional(),
      over15: z.number().nullable().optional(),
      under15: z.number().nullable().optional(),
      over25: z.number().nullable().optional(),
      under25: z.number().nullable().optional(),
      over35: z.number().nullable().optional(),
      under35: z.number().nullable().optional(),
      bttsYes: z.number().nullable().optional(),
      bttsNo: z.number().nullable().optional(),
      ahHome: z.number().nullable().optional(),
      ahAway: z.number().nullable().optional(),
      htHomeWinProb: z.number().nullable().optional(),
      htDrawProb: z.number().nullable().optional(),
      htAwayWinProb: z.number().nullable().optional(),
      htGoalsHome: z.number().nullable().optional(),
      htGoalsAway: z.number().nullable().optional(),
      htDc1X: z.number().nullable().optional(),
      htDcX2: z.number().nullable().optional(),
      htDc12: z.number().nullable().optional(),
      htDnbHome: z.number().nullable().optional(),
      htDnbAway: z.number().nullable().optional(),
      htOver15: z.number().nullable().optional(),
      htUnder15: z.number().nullable().optional(),
      htOver25: z.number().nullable().optional(),
      htUnder25: z.number().nullable().optional(),
      htOver35: z.number().nullable().optional(),
      htUnder35: z.number().nullable().optional(),
      htBttsYes: z.number().nullable().optional(),
      htBttsNo: z.number().nullable().optional(),
      htAhHome: z.number().nullable().optional(),
      htAhAway: z.number().nullable().optional(),
      shHomeWinProb: z.number().nullable().optional(),
      shDrawProb: z.number().nullable().optional(),
      shAwayWinProb: z.number().nullable().optional(),
      shGoalsHome: z.number().nullable().optional(),
      shGoalsAway: z.number().nullable().optional(),
      shDc1X: z.number().nullable().optional(),
      shDcX2: z.number().nullable().optional(),
      shDc12: z.number().nullable().optional(),
      shDnbHome: z.number().nullable().optional(),
      shDnbAway: z.number().nullable().optional(),
      shOver15: z.number().nullable().optional(),
      shUnder15: z.number().nullable().optional(),
      shOver25: z.number().nullable().optional(),
      shUnder25: z.number().nullable().optional(),
      shOver35: z.number().nullable().optional(),
      shUnder35: z.number().nullable().optional(),
      shBttsYes: z.number().nullable().optional(),
      shBttsNo: z.number().nullable().optional(),
      shAhHome: z.number().nullable().optional(),
      shAhAway: z.number().nullable().optional(),
      isValueBet: z.boolean().optional(),
      valueBetMarket: z.string().nullable().optional(),
      bookmakerOdds: z.number().nullable().optional(),
      expectedValue: z.number().nullable().optional(),
    }),
  ),
})

export async function savePredictionSession(_input: unknown) {
  const data = ((data: unknown) => savePredictionSessionSchema.parse(data))(_input as any);

    const session = await prisma.predictionSession.create({
      data: {
        league: data.league,
        source: data.source,
        model: data.model,
        config: data.config ?? null,
        matchCount: data.predictions.length,
        predictions: {
          create: data.predictions.map((p) => ({
            homeTeam: p.homeTeam,
            awayTeam: p.awayTeam,
            matchDate: p.matchDate ?? null,
            league: p.league ?? null,
            homeWinProb: p.homeWinProb ?? null,
            drawProb: p.drawProb ?? null,
            awayWinProb: p.awayWinProb ?? null,
            predictedGoalsHome: p.predictedGoalsHome ?? null,
            predictedGoalsAway: p.predictedGoalsAway ?? null,
            predictedOutcome: p.predictedOutcome ?? null,
            confidence: p.confidence ?? null,
            dc1X: p.dc1X ?? null,
            dcX2: p.dcX2 ?? null,
            dc12: p.dc12 ?? null,
            dnbHome: p.dnbHome ?? null,
            dnbAway: p.dnbAway ?? null,
            over15: p.over15 ?? null,
            under15: p.under15 ?? null,
            over25: p.over25 ?? null,
            under25: p.under25 ?? null,
            over35: p.over35 ?? null,
            under35: p.under35 ?? null,
            bttsYes: p.bttsYes ?? null,
            bttsNo: p.bttsNo ?? null,
            ahHome: p.ahHome ?? null,
            ahAway: p.ahAway ?? null,
            htHomeWinProb: p.htHomeWinProb ?? null,
            htDrawProb: p.htDrawProb ?? null,
            htAwayWinProb: p.htAwayWinProb ?? null,
            htGoalsHome: p.htGoalsHome ?? null,
            htGoalsAway: p.htGoalsAway ?? null,
            htDc1X: p.htDc1X ?? null,
            htDcX2: p.htDcX2 ?? null,
            htDc12: p.htDc12 ?? null,
            htDnbHome: p.htDnbHome ?? null,
            htDnbAway: p.htDnbAway ?? null,
            htOver15: p.htOver15 ?? null,
            htUnder15: p.htUnder15 ?? null,
            htOver25: p.htOver25 ?? null,
            htUnder25: p.htUnder25 ?? null,
            htOver35: p.htOver35 ?? null,
            htUnder35: p.htUnder35 ?? null,
            htBttsYes: p.htBttsYes ?? null,
            htBttsNo: p.htBttsNo ?? null,
            htAhHome: p.htAhHome ?? null,
            htAhAway: p.htAhAway ?? null,
            shHomeWinProb: p.shHomeWinProb ?? null,
            shDrawProb: p.shDrawProb ?? null,
            shAwayWinProb: p.shAwayWinProb ?? null,
            shGoalsHome: p.shGoalsHome ?? null,
            shGoalsAway: p.shGoalsAway ?? null,
            shDc1X: p.shDc1X ?? null,
            shDcX2: p.shDcX2 ?? null,
            shDc12: p.shDc12 ?? null,
            shDnbHome: p.shDnbHome ?? null,
            shDnbAway: p.shDnbAway ?? null,
            shOver15: p.shOver15 ?? null,
            shUnder15: p.shUnder15 ?? null,
            shOver25: p.shOver25 ?? null,
            shUnder25: p.shUnder25 ?? null,
            shOver35: p.shOver35 ?? null,
            shUnder35: p.shUnder35 ?? null,
            shBttsYes: p.shBttsYes ?? null,
            shBttsNo: p.shBttsNo ?? null,
            shAhHome: p.shAhHome ?? null,
            shAhAway: p.shAhAway ?? null,
            isValueBet: p.isValueBet ?? false,
            valueBetMarket: p.valueBetMarket ?? null,
            bookmakerOdds: p.bookmakerOdds ?? null,
            expectedValue: p.expectedValue ?? null,
          })),
        },
      },
    })
    return { sessionId: session.id }
  
}
// ─── List prediction sessions ─────────────────────────────────────────────────

export async function getPredictionSessions() {
    const sessions = await prisma.predictionSession.findMany({
      orderBy: { createdAt: 'desc' },
      include: { predictions: true },
    })
    return sessions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      predictions: s.predictions.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
    })) as SessionWithStats[]
  
}
// ─── Delete a prediction session ──────────────────────────────────────────────

export async function deletePredictionSession(_input: unknown) {
  const data = ((data: unknown) => z.object({ sessionId: z.number() }).parse(data))(_input as any);

    await prisma.predictionSession.delete({ where: { id: data.sessionId } })
    return { ok: true }
  
}
// ─── Update prediction result ─────────────────────────────────────────────────

const updatePredictionResultSchema = z.object({
  predictionId: z.number(),
  actualOutcome: z.string(),
  isCorrect: z.boolean(),
})

export async function updatePredictionResult(_input: unknown) {
  const data = ((data: unknown) => updatePredictionResultSchema.parse(data))(_input as any);

    await prisma.prediction.update({
      where: { id: data.predictionId },
      data: {
        actualOutcome: data.actualOutcome,
        isCorrect: data.isCorrect,
      },
    })
    return { ok: true }
  
}
