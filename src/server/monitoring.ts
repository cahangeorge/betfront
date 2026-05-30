import { prisma } from '#/db'

/**
 * Compute Brier score for each market in a prediction run.
 * Brier = average of (predicted_prob - actual_outcome)^2
 * where actual_outcome is 1 if the prediction matched the result, else 0.
 */
export async function computeBrierScores(runId: number) {
  const ensembles = await prisma.ensemblePrediction.findMany({
    where: { runId },
    include: { Match: { select: { homeScore: true, awayScore: true } } },
  })

  const byMarket: Record<string, number[]> = {}

  for (const ep of ensembles) {
    if (ep.Match.homeScore == null || ep.Match.awayScore == null) continue

    const actualOutcome =
      ep.outcome === 'home' ? (ep.Match.homeScore > ep.Match.awayScore ? 1 : 0) :
      ep.outcome === 'away' ? (ep.Match.awayScore > ep.Match.homeScore ? 1 : 0) :
      ep.outcome === 'draw' ? (ep.Match.homeScore === ep.Match.awayScore ? 1 : 0) :
      ep.outcome === 'over' ? ((ep.Match.homeScore + ep.Match.awayScore) > 2.5 ? 1 : 0) :
      ep.outcome === 'under' ? ((ep.Match.homeScore + ep.Match.awayScore) <= 2.5 ? 1 : 0) :
      ep.outcome === 'yes' ? (ep.Match.homeScore > 0 && ep.Match.awayScore > 0 ? 1 : 0) :
      ep.outcome === 'no' ? (ep.Match.homeScore === 0 || ep.Match.awayScore === 0 ? 1 : 0) :
      null

    if (actualOutcome == null) continue

    if (!byMarket[ep.market]) byMarket[ep.market] = []
    byMarket[ep.market].push((ep.probability - actualOutcome) ** 2)
  }

  const result: Record<string, number & { count: number }> = {}
  for (const [market, scores] of Object.entries(byMarket)) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    result[market] = Object.assign(avg, { count: scores.length })
  }
  return result
}

/**
 * Log Brier scores for a run to the console.
 */
export async function logPredictionAccuracy(runId: number) {
  const brier = await computeBrierScores(runId)
  console.log(`[monitoring] Brier scores for runId=${runId}:`)
  for (const [market, score] of Object.entries(brier)) {
    console.log(`  ${market}: ${(score as number).toFixed(4)} (n=${(score as any).count})`)
  }
}

/**
 * Compute scrape success rate over the last N days.
 */
export async function getScrapeSuccessRate(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const rows = await prisma.scrapeJob.groupBy({
    by: ['status'],
    where: { startedAt: { gte: since } },
    _count: { status: true },
  })

  const total = rows.reduce((acc, r) => acc + r._count.status, 0)
  const success = rows.find((r) => r.status === 'success')?._count.status ?? 0
  const failed = rows.find((r) => r.status === 'failed')?._count.status ?? 0
  const running = rows.find((r) => r.status === 'running')?._count.status ?? 0

  return {
    total,
    success,
    failed,
    running,
    rate: total > 0 ? success / total : 0,
  }
}

/**
 * Compute model hit rate for a specific model over settled Match.
 */
export async function getModelAccuracy(modelKey: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const Prediction = await prisma.modelPrediction.findMany({
    where: {
      modelKey,
      createdAt: { gte: since },
      Match: { homeScore: { not: null }, awayScore: { not: null } },
    },
    include: { Match: { select: { homeScore: true, awayScore: true } } },
  })

  if (Prediction.length === 0) return { total: 0, hits: 0, rate: 0 }

  let hits = 0
  for (const p of Prediction) {
    const actual =
      p.outcome === 'home' ? (p.Match.homeScore > p.Match.awayScore) :
      p.outcome === 'away' ? (p.Match.awayScore > p.Match.homeScore) :
      p.outcome === 'draw' ? (p.Match.homeScore === p.Match.awayScore) :
      false
    if (actual) hits++
  }

  return { total: Prediction.length, hits, rate: hits / Prediction.length }
}

/**
 * One-shot health report for the dashboard.
 */
export async function getSystemHealth() {
  const [scrapeRate, modelAcc, pendingRuns] = await Promise.all([
    getScrapeSuccessRate(7),
    getModelAccuracy('ensemble', 30),
    prisma.predictionRun.count({ where: { status: 'running' } }),
  ])

  return {
    scrapeSuccessRate: scrapeRate,
    modelAccuracy: modelAcc,
    pendingPredictionRuns: pendingRuns,
    timestamp: new Date().toISOString(),
  }
}
