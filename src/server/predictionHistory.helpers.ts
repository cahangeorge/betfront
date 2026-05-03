type MatchRef = {
  id: number
  homeTeam: string
  awayTeam: string
  matchDate: string | null
  league: string | null
  homeScore: number | null
  awayScore: number | null
}

type SinglePredictionRow = {
  id: number
  matchId: number
  market: string
  outcome: string
  probability: number
  createdAt: Date | string
  match: MatchRef
}

type EnsemblePredictionRow = {
  id: number
  matchId: number
  market: string
  outcome: string
  probability: number
  createdAt: Date | string
  match: MatchRef
}

export type HistoryPredictionRow = {
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
}

export type HistorySessionWithStats = {
  id: number
  league: string
  source: string
  model: string
  config: string | null
  matchCount: number
  createdAt: string
  predictions: HistoryPredictionRow[]
}

export type HistoryRun = {
  id: number
  league: string | null
  source: 'single' | 'ensemble'
  modelKey: string | null
  createdAt: Date | string
  error: string | null
  modelPredictions: SinglePredictionRow[]
  ensemblePredictions: EnsemblePredictionRow[]
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value
}

function createEmptyPrediction(rowId: number, match: MatchRef, createdAt: Date | string): HistoryPredictionRow {
  return {
    id: rowId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    matchDate: match.matchDate,
    league: match.league,
    homeWinProb: null,
    drawProb: null,
    awayWinProb: null,
    predictedGoalsHome: null,
    predictedGoalsAway: null,
    predictedOutcome: null,
    confidence: null,
    dc1X: null,
    dcX2: null,
    dc12: null,
    dnbHome: null,
    dnbAway: null,
    over15: null,
    under15: null,
    over25: null,
    under25: null,
    over35: null,
    under35: null,
    bttsYes: null,
    bttsNo: null,
    ahHome: null,
    ahAway: null,
    htHomeWinProb: null,
    htDrawProb: null,
    htAwayWinProb: null,
    htGoalsHome: null,
    htGoalsAway: null,
    htDc1X: null,
    htDcX2: null,
    htDc12: null,
    htDnbHome: null,
    htDnbAway: null,
    htOver15: null,
    htUnder15: null,
    htOver25: null,
    htUnder25: null,
    htOver35: null,
    htUnder35: null,
    htBttsYes: null,
    htBttsNo: null,
    htAhHome: null,
    htAhAway: null,
    shHomeWinProb: null,
    shDrawProb: null,
    shAwayWinProb: null,
    shGoalsHome: null,
    shGoalsAway: null,
    shDc1X: null,
    shDcX2: null,
    shDc12: null,
    shDnbHome: null,
    shDnbAway: null,
    shOver15: null,
    shUnder15: null,
    shOver25: null,
    shUnder25: null,
    shOver35: null,
    shUnder35: null,
    shBttsYes: null,
    shBttsNo: null,
    shAhHome: null,
    shAhAway: null,
    isValueBet: false,
    valueBetMarket: null,
    bookmakerOdds: null,
    expectedValue: null,
    actualOutcome: null,
    isCorrect: null,
    createdAt: toIsoString(createdAt),
  }
}

function applyMarketProbability(target: HistoryPredictionRow, market: string, outcome: string, probability: number) {
  if (market === '1x2') {
    if (outcome === 'home') target.homeWinProb = probability
    if (outcome === 'draw') target.drawProb = probability
    if (outcome === 'away') target.awayWinProb = probability
    return
  }
  if (market === 'btts') {
    if (outcome === 'yes') target.bttsYes = probability
    if (outcome === 'no') target.bttsNo = probability
    return
  }
  if (market === 'ou_2_5') {
    if (outcome === 'over') target.over25 = probability
    if (outcome === 'under') target.under25 = probability
  }
}

function computePredictedOutcome(target: HistoryPredictionRow) {
  if (target.homeWinProb != null || target.drawProb != null || target.awayWinProb != null) {
    const threeWay = [
      { label: '1', probability: target.homeWinProb },
      { label: 'X', probability: target.drawProb },
      { label: '2', probability: target.awayWinProb },
    ].filter((entry): entry is { label: string; probability: number } => entry.probability != null)
    if (threeWay.length) {
      threeWay.sort((left, right) => right.probability - left.probability)
      return { predictedOutcome: threeWay[0].label, confidence: threeWay[0].probability }
    }
  }

  if (target.bttsYes != null || target.bttsNo != null) {
    const twoWay = [
      { label: 'BTTS Yes', probability: target.bttsYes },
      { label: 'BTTS No', probability: target.bttsNo },
    ].filter((entry): entry is { label: string; probability: number } => entry.probability != null)
    if (twoWay.length) {
      twoWay.sort((left, right) => right.probability - left.probability)
      return { predictedOutcome: twoWay[0].label, confidence: twoWay[0].probability }
    }
  }

  if (target.over25 != null || target.under25 != null) {
    const totals = [
      { label: 'Over 2.5', probability: target.over25 },
      { label: 'Under 2.5', probability: target.under25 },
    ].filter((entry): entry is { label: string; probability: number } => entry.probability != null)
    if (totals.length) {
      totals.sort((left, right) => right.probability - left.probability)
      return { predictedOutcome: totals[0].label, confidence: totals[0].probability }
    }
  }

  return { predictedOutcome: null, confidence: null }
}

function computeActualOutcomeForMarket(match: MatchRef, predictedOutcomeLabel: string | null): string | null {
  if (match.homeScore == null || match.awayScore == null) return null

  if (predictedOutcomeLabel === 'BTTS Yes' || predictedOutcomeLabel === 'BTTS No') {
    const bothScored = match.homeScore > 0 && match.awayScore > 0
    return bothScored ? 'BTTS Yes' : 'BTTS No'
  }

  if (predictedOutcomeLabel === 'Over 2.5' || predictedOutcomeLabel === 'Under 2.5') {
    const total = match.homeScore + match.awayScore
    return total > 2.5 ? 'Over 2.5' : 'Under 2.5'
  }

  if (match.homeScore > match.awayScore) return '1'
  if (match.homeScore < match.awayScore) return '2'
  return 'X'
}

function finalizePrediction(target: HistoryPredictionRow, match: MatchRef) {
  if (target.homeWinProb != null && target.drawProb != null && target.awayWinProb != null) {
    target.dc1X = target.homeWinProb + target.drawProb
    target.dcX2 = target.drawProb + target.awayWinProb
    target.dc12 = target.homeWinProb + target.awayWinProb
    target.dnbHome = target.drawProb < 1 ? target.homeWinProb / (1 - target.drawProb) : null
    target.dnbAway = target.drawProb < 1 ? target.awayWinProb / (1 - target.drawProb) : null
    target.ahHome = target.homeWinProb
    target.ahAway = target.drawProb + target.awayWinProb
  }

  const outcome = computePredictedOutcome(target)
  target.predictedOutcome = outcome.predictedOutcome
  target.confidence = outcome.confidence

  const actualOutcome = computeActualOutcomeForMarket(match, outcome.predictedOutcome)
  target.actualOutcome = actualOutcome
  target.isCorrect = actualOutcome && target.predictedOutcome ? actualOutcome === target.predictedOutcome : null
  return target
}

function mapRowsToPredictions(rows: Array<SinglePredictionRow | EnsemblePredictionRow>) {
  const byMatch = new Map<number, { prediction: HistoryPredictionRow; match: MatchRef }>()

  for (const row of rows) {
    const existing = byMatch.get(row.matchId) ?? {
      prediction: createEmptyPrediction(row.id, row.match, row.createdAt),
      match: row.match,
    }
    applyMarketProbability(existing.prediction, row.market, row.outcome, row.probability)
    byMatch.set(row.matchId, existing)
  }

  return [...byMatch.values()]
    .map(({ prediction, match }) => finalizePrediction(prediction, match))
    .sort((left, right) => {
      const leftKey = left.matchDate ?? left.createdAt
      const rightKey = right.matchDate ?? right.createdAt
      return leftKey.localeCompare(rightKey)
    })
}

export function mapPredictionRunToHistorySession(run: HistoryRun): HistorySessionWithStats | null {
  const rows = run.source === 'single' ? run.modelPredictions : run.ensemblePredictions
  if (!rows.length) return null

  const predictions = mapRowsToPredictions(rows)
  if (!predictions.length) return null

  return {
    id: -run.id,
    league: run.league ?? predictions[0].league ?? 'Unknown league',
    source: run.source === 'single' ? 'pillar-single' : 'pillar-ensemble',
    model: run.modelKey ?? 'Ensemble',
    config: run.error,
    matchCount: predictions.length,
    createdAt: toIsoString(run.createdAt),
    predictions,
  }
}