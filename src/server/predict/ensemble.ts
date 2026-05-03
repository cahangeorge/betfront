import { prisma } from '#/db'
import { executeSingleModelRun } from './engine'
import { runEnsembleSchema } from './types'

/**
 * Compute Brier-based weights for each model from PAST PredictionRun rows.
 * For each ensemble member modelKey, find recent successful single runs whose
 * matches have settled scores; compute mean Brier on 1x2 outcomes; convert to
 * weight = 1 / (brier + ε) and normalise.
 * Falls back to uniform weighting when historical data is insufficient.
 */
async function computeBrierWeights(modelKeys: readonly string[], league: string) {
  const weights: Record<string, number> = {}
  let allUniform = true

  const allRows = await prisma.modelPrediction.findMany({
    where: {
      modelKey: { in: [...modelKeys] },
      market: '1x2',
      run: { source: 'single', league: { contains: league }, status: 'success' },
      match: { homeScore: { not: null }, awayScore: { not: null } },
    },
    take: 600 * modelKeys.length,
    orderBy: { id: 'desc' },
    include: { match: { select: { homeScore: true, awayScore: true } } },
  })

  const byModel = new Map<string, typeof allRows>()
  for (const r of allRows) {
    const existing = byModel.get(r.modelKey) ?? []
    existing.push(r)
    byModel.set(r.modelKey, existing)
  }

  for (const modelKey of modelKeys) {
    const rows = byModel.get(modelKey) ?? []

    // Group by matchId so we have all 3 outcomes per match.
    const byMatch = new Map<number, { home?: number; draw?: number; away?: number; hs: number; as: number }>()
    for (const r of rows) {
      const existing = byMatch.get(r.matchId) ?? {
        hs: r.match.homeScore!,
        as: r.match.awayScore!,
      }
      if (r.outcome === 'home') existing.home = r.probability
      if (r.outcome === 'draw') existing.draw = r.probability
      if (r.outcome === 'away') existing.away = r.probability
      byMatch.set(r.matchId, existing)
    }

    let sumBrier = 0
    let count = 0
    for (const v of byMatch.values()) {
      if (v.home == null || v.draw == null || v.away == null) continue
      const actual =
        v.hs > v.as ? [1, 0, 0] : v.hs === v.as ? [0, 1, 0] : [0, 0, 1]
      const brier =
        Math.pow(v.home - actual[0], 2) +
        Math.pow(v.draw - actual[1], 2) +
        Math.pow(v.away - actual[2], 2)
      sumBrier += brier
      count += 1
    }

    if (count >= 10) {
      const meanBrier = sumBrier / count
      weights[modelKey] = 1 / (meanBrier + 1e-3)
      allUniform = false
    } else {
      weights[modelKey] = 1
    }
  }

  if (allUniform) {
    for (const k of modelKeys) weights[k] = 1
  }
  // Normalise
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  if (total > 0) {
    for (const k of Object.keys(weights)) weights[k] /= total
  }
  return weights
}

export async function runEnsemblePrediction(_input: unknown) {
  const data = runEnsembleSchema.parse(_input)

  const run = await prisma.predictionRun.create({
    data: {
      league: data.league,
      source: 'ensemble',
      modelKey: null,
      status: 'running',
    },
  })

  void (async () => {
    try {
      // 1. Resolve weights per model.
      const weights =
        data.weighting === 'brier'
          ? await computeBrierWeights(data.modelKeys, data.league)
          : Object.fromEntries(data.modelKeys.map((k) => [k, 1 / data.modelKeys.length]))

      // 2. Run each member model — write ModelPrediction rows under THIS run.
      const memberSummaries: Record<string, unknown> = {}
      for (const modelKey of data.modelKeys) {
        const summary = await executeSingleModelRun(run.id, modelKey, { ...data, modelKey } as any)
        memberSummaries[modelKey] = summary
      }

      // 3. Aggregate ModelPrediction rows for this run into EnsemblePrediction.
      const memberRows = await prisma.modelPrediction.findMany({
        where: { runId: run.id },
        select: { matchId: true, market: true, outcome: true, probability: true, modelKey: true },
      })

      type Key = string // `${matchId}|${market}|${outcome}`
      const acc = new Map<Key, { sumW: number; weighted: number; matchId: number; market: string; outcome: string; contributors: Set<string> }>()
      for (const r of memberRows) {
        const w = weights[r.modelKey] ?? 0
        if (w <= 0) continue
        const key = `${r.matchId}|${r.market}|${r.outcome}`
        const existing = acc.get(key) ?? {
          sumW: 0,
          weighted: 0,
          matchId: r.matchId,
          market: r.market,
          outcome: r.outcome,
          contributors: new Set<string>(),
        }
        existing.sumW += w
        existing.weighted += w * r.probability
        existing.contributors.add(r.modelKey)
        acc.set(key, existing)
      }

      const ensembleRows: Array<{
        runId: number
        matchId: number
        market: string
        outcome: string
        probability: number
        weights: string
        contributingModels: string
      }> = []
      const weightsJson = JSON.stringify(weights)
      for (const v of acc.values()) {
        const probability = v.sumW > 0 ? v.weighted / v.sumW : 0
        ensembleRows.push({
          runId: run.id,
          matchId: v.matchId,
          market: v.market,
          outcome: v.outcome,
          probability,
          weights: weightsJson,
          contributingModels: JSON.stringify([...v.contributors]),
        })
      }

      if (ensembleRows.length) {
        await prisma.ensemblePrediction.createMany({ data: ensembleRows })
      }

      const summary = {
        weighting: data.weighting,
        weights,
        members: memberSummaries,
        ensembleRows: ensembleRows.length,
      }
      await prisma.predictionRun.update({
        where: { id: run.id },
        data: { status: 'success', finishedAt: new Date(), error: JSON.stringify(summary) },
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
  })().catch((error) => {
    console.error('[predict] unhandled error in background ensemble run:', error)
    prisma.predictionRun.update({
      where: { id: run.id },
      data: { status: 'failed', finishedAt: new Date(), error: error instanceof Error ? error.message : String(error) },
    }).catch(() => {})
  })

  return { runId: run.id, status: run.status }
}
