import { z } from 'zod'
import { prisma } from '#/db'
import { getBestOddsForMatches } from '../scrape/best-odds'

const MARKET_OUTCOMES: Record<string, string[]> = {
  '1x2': ['home', 'draw', 'away'],
  btts: ['yes', 'no'],
  ou_2_5: ['over', 'under'],
}

const MARKET_LABELS: Record<string, Record<string, string>> = {
  '1x2': { home: '1', draw: 'X', away: '2' },
  btts: { yes: 'BTTS Yes', no: 'BTTS No' },
  ou_2_5: { over: 'Over 2.5', under: 'Under 2.5' },
}

export const scanArbitrageSchema = z.object({
  markets: z.array(z.enum(['1x2', 'btts', 'ou_2_5'])).default(['1x2', 'btts', 'ou_2_5']),
  league: z.string().optional(),
  windowDays: z.number().int().min(1).max(60).default(7),
  minMargin: z.number().min(0).max(0.5).default(0.0),
  limit: z.number().int().min(1).max(200).default(50),
})

export type ArbitrageOpportunity = {
  matchId: number
  league: string | null
  homeTeam: string
  awayTeam: string
  matchDate: string | null
  market: string
  legs: Array<{
    outcome: string
    label: string
    odds: number
    bookmaker: string
    impliedProb: number
    stakeShare: number
  }>
  totalImplied: number
  margin: number
  guaranteedReturnPerUnitStake: number
}

export const placeArbitrageSchema = z.object({
  matchId: z.number().int().positive(),
  market: z.enum(['1x2', 'btts', 'ou_2_5']),
  bankrollId: z.number().int().positive(),
  totalStake: z.number().positive(),
  // mapping outcome -> bookmakerAccountId (must cover all outcomes for the market)
  legs: z.array(
    z.object({
      outcome: z.string(),
      bookmakerAccountId: z.number().int().positive(),
      odds: z.number().positive(),
    }),
  ),
  notes: z.string().optional(),
})

export async function scanArbitrage(_input: unknown): Promise<ArbitrageOpportunity[]> {
  const input = scanArbitrageSchema.parse(_input ?? {})

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const windowEnd = new Date(today)
  windowEnd.setDate(today.getDate() + input.windowDays)
  const todayIso = today.toISOString()
  const windowEndIso = windowEnd.toISOString()

  const matchWhere: any = { matchDate: { gte: todayIso, lte: windowEndIso } }
  if (input.league) matchWhere.league = { contains: input.league }

  const matches = await prisma.match.findMany({
    where: matchWhere,
    orderBy: { matchDate: 'asc' },
    take: 500,
    select: {
      id: true,
      homeTeam: true,
      awayTeam: true,
      matchDate: true,
      league: true,
    },
  })

  if (!matches.length) return []
  const ids = matches.map((m) => m.id)
  const best = await getBestOddsForMatches(ids, input.markets)

  // index by matchId+market
  const grouped = new Map<string, Map<string, { odds: number; bookmaker: string }>>()
  for (const row of best) {
    const key = `${row.matchId}|${row.market}`
    if (!grouped.has(key)) grouped.set(key, new Map())
    grouped.get(key)!.set(row.outcome, { odds: row.odds, bookmaker: row.bookmaker })
  }

  const opportunities: ArbitrageOpportunity[] = []
  for (const match of matches) {
    for (const market of input.markets) {
      const expected = MARKET_OUTCOMES[market]
      const map = grouped.get(`${match.id}|${market}`)
      if (!map || expected.some((o) => !map.has(o))) continue
      let totalImplied = 0
      const legs = expected.map((outcome) => {
        const entry = map.get(outcome)!
        const implied = 1 / entry.odds
        totalImplied += implied
        return {
          outcome,
          label: MARKET_LABELS[market]?.[outcome] ?? outcome,
          odds: entry.odds,
          bookmaker: entry.bookmaker,
          impliedProb: implied,
          stakeShare: 0,
        }
      })
      if (totalImplied >= 1 - input.minMargin) continue
      const margin = 1 - totalImplied
      const guaranteed = 1 / totalImplied
      // stake share = implied / sum -> equal payout regardless of outcome
      for (const leg of legs) leg.stakeShare = leg.impliedProb / totalImplied
      opportunities.push({
        matchId: match.id,
        league: match.league,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        matchDate: match.matchDate ?? null,
        market,
        legs,
        totalImplied,
        margin,
        guaranteedReturnPerUnitStake: guaranteed,
      })
    }
  }

  opportunities.sort((a, b) => b.margin - a.margin)
  return opportunities.slice(0, input.limit)
}

/**
 * Place an arbitrage opportunity as N separate hedge tickets (one per outcome,
 * each on its own BookmakerAccount). All tickets share a TicketBatch with
 * strategy='arbitrage'. Stakes are split using the provided per-leg odds.
 */
export async function placeArbitrage(_input: unknown) {
  const data = placeArbitrageSchema.parse(_input)

  const expected = MARKET_OUTCOMES[data.market]
  if (!expected) throw new Error(`Unsupported market: ${data.market}`)
  if (data.legs.length !== expected.length) {
    throw new Error(`Expected ${expected.length} legs for market ${data.market}, got ${data.legs.length}`)
  }
  const provided = new Set(data.legs.map((l) => l.outcome))
  for (const o of expected) {
    if (!provided.has(o)) throw new Error(`Missing leg for outcome: ${o}`)
  }

  const bankroll = await prisma.bankroll.findUnique({ where: { id: data.bankrollId } })
  if (!bankroll) throw new Error('Bankroll not found')
  if (bankroll.balance < data.totalStake) throw new Error('Insufficient bankroll balance')

  const accounts = await prisma.bookmakerAccount.findMany({
    where: { id: { in: data.legs.map((l) => l.bookmakerAccountId) } },
  })
  for (const leg of data.legs) {
    const acct = accounts.find((a) => a.id === leg.bookmakerAccountId)
    if (!acct) throw new Error(`BookmakerAccount #${leg.bookmakerAccountId} not found`)
    if (acct.bankrollId !== data.bankrollId)
      throw new Error(`Account #${acct.id} does not belong to bankroll #${data.bankrollId}`)
  }

  const match = await prisma.match.findUnique({ where: { id: data.matchId } })
  if (!match) throw new Error('Match not found')

  // stake distribution: stake_i = total * (1/odds_i) / sum(1/odds_j)
  const inverseSum = data.legs.reduce((acc, l) => acc + 1 / l.odds, 0)
  if (inverseSum >= 1) {
    // not actually arbitrage anymore (odds may have shifted), allow with warning notes
  }
  const distribution = data.legs.map((l) => ({
    ...l,
    stake: (data.totalStake * (1 / l.odds)) / inverseSum,
  }))

  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.ticketBatch.create({
      data: {
        bankrollId: data.bankrollId,
        strategy: 'arbitrage',
        params: JSON.stringify({
          matchId: data.matchId,
          market: data.market,
          totalStake: data.totalStake,
          inverseSum,
          notes: data.notes,
        }),
        ticketCount: distribution.length,
      },
    })

    const ticketIds: number[] = []
    let runningBalance = bankroll.balance
    for (const leg of distribution) {
      const ticket = await tx.ticket.create({
        data: {
          name: `Arb #${data.matchId} ${data.market}/${leg.outcome}`,
          stake: leg.stake,
          bankroll: bankroll.balance,
          bankrollId: data.bankrollId,
          batchId: batch.id,
          strategy: 'arbitrage',
          status: 'placed',
          combinedOdds: leg.odds,
          combinedProbability: 1 / leg.odds,
          expectedValue: 1 - inverseSum,
          potentialReturn: leg.stake * leg.odds,
          selections: JSON.stringify([
            {
              matchId: data.matchId,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              matchDate: match.matchDate ?? null,
              market: data.market,
              outcome: leg.outcome,
              odds: leg.odds,
              bookmaker: '',
            },
          ]),
          legs: {
            create: [
              {
                matchId: data.matchId,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                matchDate: match.matchDate ?? null,
                league: match.league,
                sport: match.sport,
                market: data.market,
                outcome: leg.outcome,
                label: MARKET_LABELS[data.market]?.[leg.outcome] ?? leg.outcome,
                odds: leg.odds,
                modelProb: null,
                bookmaker: '',
              },
            ],
          },
        },
      })
      ticketIds.push(ticket.id)

      const placement = await tx.betPlacement.create({
        data: {
          ticketId: ticket.id,
          bookmakerAccountId: leg.bookmakerAccountId,
          stake: leg.stake,
          status: 'placed',
        },
      })

      runningBalance -= leg.stake
      await tx.ledgerEntry.create({
        data: {
          bankrollId: data.bankrollId,
          ticketId: ticket.id,
          placementId: placement.id,
          kind: 'stake',
          amount: -leg.stake,
          balanceAfter: runningBalance,
          notes: `Arbitrage leg ${leg.outcome} @ ${leg.odds}`,
        },
      })
    }

    await tx.bankroll.update({
      where: { id: data.bankrollId },
      data: { balance: runningBalance },
    })

    return { batchId: batch.id, ticketIds, distribution }
  })

  return result
}
