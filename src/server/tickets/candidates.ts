import { prisma } from '#/db'
import type { GenerateBatchInput, LegCandidate } from './types'

const MARKET_OUTCOME_LABELS: Record<string, Record<string, string>> = {
  '1x2': { home: '1', draw: 'X', away: '2' },
  btts: { yes: 'BTTS Yes', no: 'BTTS No' },
  ou_2_5: { over: 'Over 2.5', under: 'Under 2.5' },
}

function labelFor(market: string, outcome: string) {
  return MARKET_OUTCOME_LABELS[market]?.[outcome] ?? `${market}:${outcome}`
}

/** Pull odds for a match+market+outcome from OddsEntry, optionally pinned to a bookmaker. */
function pickOdds(
  oddsRows: Array<{
    market: string
    submarket: string | null
    bookmaker: string
    oddsHome: number | null
    oddsDraw: number | null
    oddsAway: number | null
    oddsOver: number | null
    oddsUnder: number | null
    oddsYes: number | null
    oddsNo: number | null
  }>,
  market: string,
  outcome: string,
  bookmakerHint?: string,
): { odds: number; bookmaker: string } | null {
  const candidates = oddsRows.filter((r) => {
    if (market === '1x2') return r.market === '1x2' || r.market === 'match_winner'
    if (market === 'btts') return r.market === 'btts' || r.submarket === 'btts'
    if (market === 'ou_2_5')
      return (
        r.market === 'over_under_2_5' ||
        r.submarket === 'over_under_2_5' ||
        (r.market === 'over_under' && r.submarket === '2.5')
      )
    return false
  })
  if (!candidates.length) return null

  const ordered = bookmakerHint
    ? [...candidates.filter((c) => c.bookmaker === bookmakerHint), ...candidates]
    : candidates

  for (const row of ordered) {
    let odds: number | null = null
    if (market === '1x2') {
      if (outcome === 'home') odds = row.oddsHome
      else if (outcome === 'draw') odds = row.oddsDraw
      else if (outcome === 'away') odds = row.oddsAway
    } else if (market === 'btts') {
      if (outcome === 'yes') odds = row.oddsYes
      else if (outcome === 'no') odds = row.oddsNo
    } else if (market === 'ou_2_5') {
      if (outcome === 'over') odds = row.oddsOver
      else if (outcome === 'under') odds = row.oddsUnder
    }
    if (odds && odds > 1) return { odds, bookmaker: row.bookmaker }
  }
  return null
}

/**
 * Build LegCandidate[] for a generation run.
 * Strategy: prefer ensemble predictions; fall back to most recent single-model prediction per (match,market,outcome).
 */
export async function buildLegCandidates(input: GenerateBatchInput): Promise<LegCandidate[]> {
  const matchWhere: any = {}
  if (input.league) matchWhere.league = { contains: input.league }
  if (input.windowStart || input.windowEnd) {
    matchWhere.matchDate = {
      ...(input.windowStart ? { gte: input.windowStart } : {}),
      ...(input.windowEnd ? { lte: input.windowEnd } : {}),
    }
  } else {
    // future-only by default
    matchWhere.homeScore = null
    matchWhere.matchDate = { gte: new Date().toISOString().slice(0, 10) }
  }

  const runFilter = input.predictionRunId
    ? { runId: input.predictionRunId }
    : { run: { status: 'success' } }

  // 1. Ensemble predictions for matching matches.
  const ensemble = await prisma.ensemblePrediction.findMany({
    where: {
      ...runFilter,
      market: { in: input.markets },
      match: matchWhere,
    },
    include: {
      match: {
        select: {
          id: true,
          homeTeam: true,
          awayTeam: true,
          matchDate: true,
          league: true,
          sport: true,
          odds: true,
        },
      },
    },
    orderBy: { id: 'desc' },
    take: 5000,
  })

  // 2. Single-model predictions as backup for matches without ensemble.
  const ensembleMatchIds = new Set(ensemble.map((e) => e.matchId))
  const single = await prisma.modelPrediction.findMany({
    where: {
      ...runFilter,
      market: { in: input.markets },
      match: { ...matchWhere, id: { notIn: [...ensembleMatchIds] } },
    },
    include: {
      match: {
        select: {
          id: true,
          homeTeam: true,
          awayTeam: true,
          matchDate: true,
          league: true,
          sport: true,
          odds: true,
        },
      },
    },
    orderBy: { id: 'desc' },
    take: 5000,
  })

  const candidates: LegCandidate[] = []
  const seen = new Set<string>() // dedup by match|market|outcome (newest wins)

  const ingest = (rows: typeof ensemble | typeof single, source: 'ensemble' | 'single', modelKeyExtract?: (r: any) => string) => {
    for (const r of rows) {
      const key = `${r.matchId}|${r.market}|${r.outcome}`
      if (seen.has(key)) continue
      const odds = pickOdds(r.match.odds as any, r.market, r.outcome, input.bookmaker)
      if (!odds) continue
      seen.add(key)
      const implied = 1 / odds.odds
      candidates.push({
        matchId: r.matchId,
        homeTeam: r.match.homeTeam,
        awayTeam: r.match.awayTeam,
        matchDate: r.match.matchDate,
        league: r.match.league,
        sport: r.match.sport,
        market: r.market,
        outcome: r.outcome,
        label: labelFor(r.market, r.outcome),
        modelProb: r.probability,
        odds: odds.odds,
        bookmaker: odds.bookmaker,
        impliedProb: implied,
        edge: r.probability - implied,
        ev: odds.odds * r.probability - 1,
        source,
        ...(modelKeyExtract ? { modelKey: modelKeyExtract(r) } : {}),
      })
    }
  }

  ingest(ensemble, 'ensemble')
  ingest(single, 'single', (r) => r.modelKey)

  return candidates
}
