import { z } from 'zod'
import { prisma } from '#/db'
import {
  generateTicketBatch as _generateTicketBatch,
  listTicketBatches as _listTicketBatches,
  getTicketBatch as _getTicketBatch,
  deleteTicketBatch as _deleteTicketBatch,
  listGenerationStrategies as _listGenerationStrategies,
} from './tickets/builder'
import {
  placeTicket as _placeTicket,
  settleTicket as _settleTicket,
} from './tickets/placement'
import {
  scanArbitrage as _scanArbitrage,
  placeArbitrage as _placeArbitrage,
} from './tickets/arbitrage'
import { buildLeagueSearchTerms } from '#/server/leagues'
import { getBestOddsForMatches as _getBestOddsForMatches } from './scrape/best-odds'

// ─── Phase 4 tickets pillar wrappers (picked up by gen-actions.mjs) ─────

export async function generateTicketBatch(_input: unknown) {
  return _generateTicketBatch(_input)
}
export async function listTicketBatches(_input?: unknown) {
  return _listTicketBatches(_input)
}
export async function getTicketBatch(_input: unknown) {
  return _getTicketBatch(_input)
}
export async function deleteTicketBatch(_input: unknown) {
  return _deleteTicketBatch(_input)
}
export async function listGenerationStrategies() {
  return _listGenerationStrategies()
}
export async function placeTicket(_input: unknown) {
  return _placeTicket(_input)
}
export async function settleTicket(_input: unknown) {
  return _settleTicket(_input)
}
export async function scanArbitrage(_input?: unknown) {
  return _scanArbitrage(_input)
}
export async function placeArbitrage(_input: unknown) {
  return _placeArbitrage(_input)
}
export async function getBestOdds(_input: unknown) {
  const z = (await import('zod')).z
  const schema = z.object({
    matchIds: z.array(z.number().int()),
    markets: z.array(z.string()).default(['1x2', 'btts', 'ou_2_5']),
  })
  const data = schema.parse(_input)
  return _getBestOddsForMatches(data.matchIds, data.markets)
}


// ─── Types ─────────────────────────────────────────────────────────────────────

export type TicketSelection = {
  matchId: number
  homeTeam: string
  awayTeam: string
  matchDate: string | null
  sport: string
  league: string | null
  market: string
  submarket: string | null
  outcome: string   // 'home' | 'draw' | 'away' | 'yes' | 'no' | 'over' | 'under'
  label: string     // "Man Utd Win", "Draw", "Over 2.5", etc.
  odds: number
  bookmaker: string
  modelProb?: number // model probability 0-1 (when available from predictions)
}

export type MatchMarket = {
  market: string
  submarket: string | null
  displayName: string
  selections: {
    outcome: string
    label: string
    odds: number
    bookmaker: string
  }[]
}

export type MatchForTicket = {
  id: number
  sport: string
  league: string | null
  homeTeam: string
  awayTeam: string
  matchDate: string | null
  matchUrl: string | null
  markets: MatchMarket[]
}

export type SavedTicket = {
  id: number
  name: string | null
  currency: string
  stake: number
  bankroll: number
  selections: TicketSelection[]
  combinedOdds: number
  combinedProbability: number
  expectedValue: number
  potentialReturn: number
  createdAt: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function marketDisplayName(market: string, submarket: string | null): string {
  const key = submarket ?? market
  if (key === '1x2') return '1X2'
  if (key === 'btts') return 'BTTS'
  if (key === 'double_chance') return 'Double Chance'
  if (key === 'draw_no_bet') return 'Draw No Bet'
  if (key === 'asian_handicap') return 'Asian Handicap'
  if (key === 'european_handicap') return 'Euro Handicap'
  if (key === 'moneyline') return 'Moneyline'
  if (key.startsWith('over_under')) {
    const num = key.replace('over_under_', '').replace(/_/g, '.')
    const parsed = parseFloat(num)
    return isNaN(parsed) ? 'Over/Under' : `Over/Under ${parsed}`
  }
  return key
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function outcomeLabel(
  market: string,
  submarket: string | null,
  outcome: string,
  homeTeam: string,
  awayTeam: string,
): string {
  const key = submarket ?? market
  if (key === '1x2') {
    if (outcome === 'home') return `${homeTeam} Win`
    if (outcome === 'draw') return 'Draw'
    if (outcome === 'away') return `${awayTeam} Win`
  }
  if (key === 'btts') {
    if (outcome === 'yes') return 'BTTS Yes'
    if (outcome === 'no') return 'BTTS No'
  }
  if (key === 'double_chance') {
    if (outcome === 'home') return `${homeTeam} or Draw`
    if (outcome === 'away') return `${awayTeam} or Draw`
    if (outcome === 'draw') return `${homeTeam} or ${awayTeam}`
  }
  if (key === 'draw_no_bet') {
    if (outcome === 'home') return `${homeTeam} (DNB)`
    if (outcome === 'away') return `${awayTeam} (DNB)`
  }
  if (key === 'moneyline') {
    if (outcome === 'home') return `${homeTeam}`
    if (outcome === 'away') return `${awayTeam}`
  }
  if (key.startsWith('over_under')) {
    const num = key.replace('over_under_', '').replace(/_/g, '.')
    const parsed = parseFloat(num)
    const line = isNaN(parsed) ? '' : ` ${parsed}`
    if (outcome === 'over') return `Over${line}`
    if (outcome === 'under') return `Under${line}`
  }
  return outcome.charAt(0).toUpperCase() + outcome.slice(1)
}

function normalizeMarketGroup(market: string, submarket: string | null) {
  const keepSubmarket = market === 'over_under'
    || market === 'asian_handicap'
    || market === 'european_handicap'

  return {
    key: keepSubmarket ? (submarket ?? market) : market,
    submarket: keepSubmarket ? submarket : null,
  }
}

function calcTicketStats(selections: TicketSelection[], stake: number) {
  if (selections.length === 0) {
    return { combinedOdds: 1, combinedProbability: 1, expectedValue: 0, potentialReturn: 0 }
  }
  const combinedOdds = selections.reduce((acc, s) => acc * s.odds, 1)
  const combinedProbability = selections.reduce((acc, s) => acc * (s.modelProb ?? (1 / s.odds)), 1)
  const expectedValue = combinedProbability * combinedOdds - 1
  const potentialReturn = stake * combinedOdds
  return {
    combinedOdds: parseFloat(combinedOdds.toFixed(2)),
    combinedProbability: parseFloat(combinedProbability.toFixed(4)),
    expectedValue: parseFloat(expectedValue.toFixed(4)),
    potentialReturn: parseFloat(potentialReturn.toFixed(2)),
  }
}

// ─── Server Functions ──────────────────────────────────────────────────────────

/** Available sports that have at least one match with odds in the DB */
export async function getTicketSports() {
  const rows = await prisma.match.findMany({
    where: { odds: { some: {} } },
    select: { sport: true },
    distinct: ['sport'],
    orderBy: { sport: 'asc' },
  })
  return rows.map((r) => r.sport)

}
/** Football leagues available in the local DB for prediction history/upcoming flows */
export async function getPredictionLeagues() {
  const rows = await prisma.match.findMany({
    where: {
      sport: 'football',
      league: { not: null },
      OR: [
        { odds: { some: {} } },
        { homeScore: { not: null }, awayScore: { not: null } },
      ],
    },
    select: { league: true },
    distinct: ['league'],
    orderBy: { league: 'asc' },
  })

  return rows
    .map((row) => row.league)
    .filter((league): league is string => Boolean(league))

}
/** Matches with best available odds per market — the data source for the ticket builder */
export async function getMatchesForTickets(_input: unknown) {
  const data = ((data: unknown) =>
    z
      .object({
        sport: z.string().optional(),
        league: z.string().optional(),
        search: z.string().optional(),
        upcomingOnly: z.boolean().optional(),
      })
      .parse(data))(_input as any);

    const today = new Date().toISOString().slice(0, 10)
    const leagueTerms = data.league ? buildLeagueSearchTerms(data.league) : []
    const andClauses: Array<Record<string, unknown>> = []

    if (leagueTerms.length > 0) {
      const leagueOr: Array<Record<string, unknown>> = leagueTerms.map((term) => ({
        league: { contains: term },
      }))
      // Also match via the Job's league slug (e.g. "saudi-professional-league")
      const slug = (data.league ?? '').trim().toLowerCase().replace(/\s+/g, '-')
      if (slug) {
        leagueOr.push({ job: { league: { equals: slug } } })
        leagueOr.push({ job: { league: { endsWith: `-${slug}` } } })
      }
      andClauses.push({ OR: leagueOr })
    }

    if (data.search) {
      andClauses.push({
        OR: [
          { homeTeam: { contains: data.search } },
          { awayTeam: { contains: data.search } },
          { league: { contains: data.search } },
        ],
      })
    }

    const matches = await prisma.match.findMany({
      where: {
        ...(data.sport ? { sport: data.sport } : {}),
        ...(andClauses.length > 0 ? { AND: andClauses } : {}),
        ...(data.upcomingOnly ? { matchDate: { gte: today } } : {}),
        odds: { some: {} },
      },
      include: { odds: true },
      orderBy: [{ matchDate: 'asc' }, { id: 'asc' }],
      take: 300,
    })

    const OUTCOME_ORDER = ['home', 'draw', 'away', 'yes', 'no', 'over', 'under']

    const result: MatchForTicket[] = matches
      .map((match) => {
        // Aggregate best (highest) odds per outcome across bookmakers, grouped by submarket/market
        type OddsGroup = {
          market: string
          submarket: string | null
          bestOdds: Record<string, { odds: number; bookmaker: string }>
        }
        const marketMap = new Map<string, OddsGroup>()

        for (const entry of match.odds) {
          const normalized = normalizeMarketGroup(entry.market, entry.submarket)
          const key = normalized.key
          if (!marketMap.has(key)) {
            marketMap.set(key, { market: entry.market, submarket: normalized.submarket, bestOdds: {} })
          }
          const group = marketMap.get(key)!

          const candidates: Array<[string, number | null]> = [
            ['home', entry.oddsHome],
            ['draw', entry.oddsDraw],
            ['away', entry.oddsAway],
            ['over', entry.oddsOver],
            ['under', entry.oddsUnder],
            ['yes', entry.oddsYes],
            ['no', entry.oddsNo],
          ]

          for (const [outcome, odds] of candidates) {
            if (odds !== null && odds > 1) {
              if (!group.bestOdds[outcome] || odds > group.bestOdds[outcome].odds) {
                group.bestOdds[outcome] = { odds, bookmaker: entry.bookmaker }
              }
            }
          }
        }

        const markets: MatchMarket[] = Array.from(marketMap.values())
          .map((group) => ({
            market: group.market,
            submarket: group.submarket,
            displayName: marketDisplayName(group.market, group.submarket),
            selections: Object.entries(group.bestOdds)
              .filter(([, { odds }]) => odds > 1)
              .map(([outcome, { odds, bookmaker }]) => ({
                outcome,
                label: outcomeLabel(group.market, group.submarket, outcome, match.homeTeam, match.awayTeam),
                odds,
                bookmaker,
              }))
              .sort((a, b) => OUTCOME_ORDER.indexOf(a.outcome) - OUTCOME_ORDER.indexOf(b.outcome)),
          }))
          .filter((m) => m.selections.length > 0)

        return {
          id: match.id,
          sport: match.sport,
          league: match.league,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          matchDate: match.matchDate,
          matchUrl: match.matchUrl,
          markets,
        }
      })
      .filter((m) => m.markets.length > 0)

    return result
  
}
const selectionSchema = z.object({
  matchId: z.number(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  matchDate: z.string().nullable(),
  sport: z.string(),
  league: z.string().nullable(),
  market: z.string(),
  submarket: z.string().nullable(),
  outcome: z.string(),
  label: z.string(),
  odds: z.number(),
  bookmaker: z.string(),
  modelProb: z.number().optional(),
})

/** Save the current slip as a ticket to the database */
export async function saveTicket(_input: unknown) {
  const data = ((data: unknown) =>
    z
      .object({
        name: z.string().optional(),
        currency: z.string().default('€'),
        stake: z.number().min(0).default(10),
        bankroll: z.number().min(0).default(1000),
        selections: z.array(selectionSchema).min(1),
      })
      .parse(data))(_input as any);

    const stats = calcTicketStats(data.selections as TicketSelection[], data.stake)

    const ticket = await prisma.ticket.create({
      data: {
        name: data.name ?? null,
        currency: data.currency,
        stake: data.stake,
        bankroll: data.bankroll,
        selections: JSON.stringify(data.selections),
        combinedOdds: stats.combinedOdds,
        combinedProbability: stats.combinedProbability,
        expectedValue: stats.expectedValue,
        potentialReturn: stats.potentialReturn,
      },
    })

    return { id: ticket.id }
  
}
/** All saved tickets, newest first */
export async function getTickets() {
  const { getCurrentUserId } = await import('#/server/auth/context')
  const userId = getCurrentUserId()
  const rows = await prisma.ticket.findMany({
    where: userId
      ? { OR: [{ bankrollId: null }, { bankrollRef: { userId } }] }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return rows.map((r) => ({
    ...r,
    ...(() => {
      const selections = JSON.parse(r.selections) as TicketSelection[]
      const stats = calcTicketStats(selections, r.stake)
      return {
        selections,
        combinedOdds: stats.combinedOdds,
        combinedProbability: stats.combinedProbability,
        expectedValue: stats.expectedValue,
        potentialReturn: stats.potentialReturn,
      }
    })(),
    createdAt: r.createdAt.toISOString(),
  })) as SavedTicket[]

}
/** Delete a ticket by ID */
export async function deleteTicket(_input: unknown) {
  const data = ((data: unknown) => z.object({ id: z.number() }).parse(data))(_input as any);

    await prisma.ticket.delete({ where: { id: data.id } })
    return { ok: true }
  
}
// ─── Value Bet Detection ───────────────────────────────────────────────────────

export type PredictionInput = {
  homeTeam: string
  awayTeam: string
  matchDate: string | null
  homeWin: number | null   // model probability 0-1
  draw: number | null
  awayWin: number | null
  over25: number | null
  under25: number | null
  bttsYes: number | null
  bttsNo: number | null
}

export type ValueBet = {
  key: string
  homeTeam: string          // from DB match
  awayTeam: string
  predHomeTeam: string      // from prediction (for display)
  predAwayTeam: string
  matchDate: string | null
  league: string | null
  sport: string
  matchId: number
  market: string
  submarket: string | null
  outcome: string
  label: string
  modelProb: number
  bestOdds: number
  impliedProb: number
  edge: number              // modelProb - impliedProb
  expectedValue: number     // modelProb * bestOdds - 1
  bookmaker: string
}

const predictionInputSchema = z.object({
  homeTeam: z.string(),
  awayTeam: z.string(),
  matchDate: z.string().nullable(),
  homeWin: z.number().nullable(),
  draw: z.number().nullable(),
  awayWin: z.number().nullable(),
  over25: z.number().nullable(),
  under25: z.number().nullable(),
  bttsYes: z.number().nullable(),
  bttsNo: z.number().nullable(),
})

/**
 * Internal: find value bets from prediction results against DB odds.
 * Shared by findValueBets API and generateTicketFromPredictions.
 */
async function findValueBetsInternal(predictions: PredictionInput[]): Promise<ValueBet[]> {
  const valueBets: ValueBet[] = []

  for (const pred of predictions) {
    // Fuzzy-match the prediction team names to DB team names.
    // Try exact match first, then partial contains in both directions.
    const homeFirst = pred.homeTeam.split(' ')[0]
    const awayFirst = pred.awayTeam.split(' ')[0]

    const match = await prisma.match.findFirst({
      where: {
        OR: [
          {
            homeTeam: { contains: homeFirst },
            awayTeam: { contains: awayFirst },
          },
          {
            homeTeam: { contains: pred.homeTeam },
            awayTeam: { contains: pred.awayTeam },
          },
        ],
        odds: { some: {} },
      },
      include: { odds: true },
      orderBy: { matchDate: 'asc' },
    })

    if (!match) continue

    // Aggregate best odds per (market, submarket, outcome) across all bookmakers
    type BestOddsEntry = { odds: number; bookmaker: string }
    const marketMap = new Map<string, { market: string; submarket: string | null; bestOdds: Record<string, BestOddsEntry> }>()

    for (const entry of match.odds) {
      const normalized = normalizeMarketGroup(entry.market, entry.submarket)
      const key = normalized.key
      if (!marketMap.has(key)) {
        marketMap.set(key, { market: entry.market, submarket: normalized.submarket, bestOdds: {} })
      }
      const group = marketMap.get(key)!

      const candidates: Array<[string, number | null]> = [
        ['home', entry.oddsHome],
        ['draw', entry.oddsDraw],
        ['away', entry.oddsAway],
        ['over', entry.oddsOver],
        ['under', entry.oddsUnder],
        ['yes', entry.oddsYes],
        ['no', entry.oddsNo],
      ]

      for (const [outcome, odds] of candidates) {
        if (odds !== null && odds > 1) {
          if (!group.bestOdds[outcome] || odds > group.bestOdds[outcome].odds) {
            group.bestOdds[outcome] = { odds, bookmaker: entry.bookmaker }
          }
        }
      }
    }

    // Map prediction probabilities to (market, outcome) pairs
    const probMap: Array<{ market: string; submarket: string | null; outcome: string; modelProb: number; label: string }> = []

    for (const [key, group] of marketMap.entries()) {
      if (group.market === '1x2') {
        if (pred.homeWin != null) probMap.push({ market: '1x2', submarket: null, outcome: 'home', modelProb: pred.homeWin, label: outcomeLabel('1x2', null, 'home', match.homeTeam, match.awayTeam) })
        if (pred.draw != null) probMap.push({ market: '1x2', submarket: null, outcome: 'draw', modelProb: pred.draw, label: outcomeLabel('1x2', null, 'draw', match.homeTeam, match.awayTeam) })
        if (pred.awayWin != null) probMap.push({ market: '1x2', submarket: null, outcome: 'away', modelProb: pred.awayWin, label: outcomeLabel('1x2', null, 'away', match.homeTeam, match.awayTeam) })
      } else if (group.market === 'btts') {
        if (pred.bttsYes != null) probMap.push({ market: 'btts', submarket: null, outcome: 'yes', modelProb: pred.bttsYes, label: 'BTTS Yes' })
        if (pred.bttsNo != null) probMap.push({ market: 'btts', submarket: null, outcome: 'no', modelProb: pred.bttsNo, label: 'BTTS No' })
      } else if (group.market === 'over_under') {
        const sm = group.submarket ?? ''
        if (sm.includes('2_5') || sm.includes('25')) {
          if (pred.over25 != null) probMap.push({ market: 'over_under', submarket: group.submarket, outcome: 'over', modelProb: pred.over25, label: `Over 2.5` })
          if (pred.under25 != null) probMap.push({ market: 'over_under', submarket: group.submarket, outcome: 'under', modelProb: pred.under25, label: `Under 2.5` })
        }
      }
    }

    // Compute edge for each prob entry if we have matching odds
    for (const probEntry of probMap) {
      const marketKey = probEntry.submarket ?? probEntry.market
      const group = marketMap.get(marketKey)
      if (!group) continue

      const best = group.bestOdds[probEntry.outcome]
      if (!best || best.odds <= 1) continue

      const impliedProb = 1 / best.odds
      const edge = probEntry.modelProb - impliedProb
      const expectedValue = probEntry.modelProb * best.odds - 1

      valueBets.push({
        key: `${match.id}-${probEntry.market}-${probEntry.outcome}`,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        predHomeTeam: pred.homeTeam,
        predAwayTeam: pred.awayTeam,
        matchDate: match.matchDate,
        league: match.league,
        sport: match.sport,
        matchId: match.id,
        market: probEntry.market,
        submarket: probEntry.submarket,
        outcome: probEntry.outcome,
        label: probEntry.label,
        modelProb: parseFloat(probEntry.modelProb.toFixed(4)),
        bestOdds: parseFloat(best.odds.toFixed(2)),
        impliedProb: parseFloat(impliedProb.toFixed(4)),
        edge: parseFloat(edge.toFixed(4)),
        expectedValue: parseFloat(expectedValue.toFixed(4)),
        bookmaker: best.bookmaker,
      })
    }
  }

  // Sort by edge descending
  return valueBets.sort((a, b) => b.edge - a.edge)
}

/**
 * Given a list of prediction results (model probabilities), find matching matches
 * in the DB and compute edge vs best available bookmaker odds.
 */
export async function findValueBets(_input: unknown) {
  const data = ((data: unknown) =>
    z.object({ predictions: z.array(predictionInputSchema) }).parse(data))(_input as any);

    return findValueBetsInternal(data.predictions)
  
}
/**
 * One-click: find value bets from predictions and save as a ticket in one step.
 * Combines findValueBets + saveTicket into a single server round-trip.
 */
export async function generateTicketFromPredictions(_input: unknown) {
  const data = ((data: unknown) =>
    z
      .object({
        predictions: z.array(predictionInputSchema),
        minEdge: z.number().default(0.03),
        name: z.string().optional(),
        currency: z.string().default('€'),
        stake: z.number().min(0).default(10),
        bankroll: z.number().min(0).default(1000),
      })
      .parse(data))(_input as any);

    const bets = await findValueBetsInternal(data.predictions)
    const selected = bets.filter((b) => b.edge >= data.minEdge)

    if (selected.length === 0) {
      return {
        ticket: null,
        valueBetsFound: bets.length,
        selectedCount: 0,
        message: bets.length > 0
          ? `Found ${bets.length} bets but none above ${(data.minEdge * 100).toFixed(1)}% edge threshold`
          : 'No matching odds found in database',
      }
    }

    const selections: TicketSelection[] = selected.map((b) => ({
      matchId: b.matchId,
      homeTeam: b.homeTeam,
      awayTeam: b.awayTeam,
      matchDate: b.matchDate,
      sport: b.sport,
      league: b.league,
      market: b.market,
      submarket: b.submarket,
      outcome: b.outcome,
      label: b.label,
      odds: b.bestOdds,
      bookmaker: b.bookmaker,
      modelProb: b.modelProb,
    }))

    const stats = calcTicketStats(selections, data.stake)

    const ticket = await prisma.ticket.create({
      data: {
        name: data.name ?? `Auto: ${selected.length} value bets`,
        currency: data.currency,
        stake: data.stake,
        bankroll: data.bankroll,
        selections: JSON.stringify(selections),
        combinedOdds: stats.combinedOdds,
        combinedProbability: stats.combinedProbability,
        expectedValue: stats.expectedValue,
        potentialReturn: stats.potentialReturn,
      },
    })

    return {
      ticket: {
        id: ticket.id,
        combinedOdds: stats.combinedOdds,
        potentialReturn: stats.potentialReturn,
        expectedValue: stats.expectedValue,
        selectionsCount: selections.length,
      },
      valueBetsFound: bets.length,
      selectedCount: selected.length,
      message: null,
    }
  
}
