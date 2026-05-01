import { prisma } from '#/db'

export type BestOddsRow = {
  matchId: number
  market: string
  outcome: string
  odds: number
  bookmaker: string
}

const MARKET_OUTCOMES: Record<string, string[]> = {
  '1x2': ['home', 'draw', 'away'],
  btts: ['yes', 'no'],
  ou_2_5: ['over', 'under'],
}

function pickOddsValue(row: any, market: string, outcome: string): number | null {
  if (market === '1x2') {
    if (outcome === 'home') return row.oddsHome
    if (outcome === 'draw') return row.oddsDraw
    if (outcome === 'away') return row.oddsAway
  } else if (market === 'btts') {
    if (outcome === 'yes') return row.oddsYes
    if (outcome === 'no') return row.oddsNo
  } else if (market === 'ou_2_5') {
    if (outcome === 'over') return row.oddsOver
    if (outcome === 'under') return row.oddsUnder
  }
  return null
}

function rowMatchesMarket(row: any, market: string): boolean {
  if (market === '1x2') return row.market === '1x2' || row.market === 'match_winner'
  if (market === 'btts') return row.market === 'btts' || row.submarket === 'btts'
  if (market === 'ou_2_5')
    return (
      row.market === 'over_under_2_5' ||
      row.submarket === 'over_under_2_5' ||
      (row.market === 'over_under' && row.submarket === '2.5')
    )
  return false
}

/** Return best (highest) odds across bookmakers for each (match, market, outcome). */
export async function getBestOddsForMatches(matchIds: number[], markets: string[]): Promise<BestOddsRow[]> {
  if (!matchIds.length) return []
  const oddsRows = await prisma.oddsEntry.findMany({
    where: { matchId: { in: matchIds } },
    orderBy: { createdAt: 'desc' },
  })

  const best = new Map<string, BestOddsRow>()
  for (const row of oddsRows as any[]) {
    for (const market of markets) {
      if (!rowMatchesMarket(row, market)) continue
      const outcomes = MARKET_OUTCOMES[market] ?? []
      for (const outcome of outcomes) {
        const odds = pickOddsValue(row, market, outcome)
        if (!odds || odds <= 1) continue
        const key = `${row.matchId}|${market}|${outcome}`
        const cur = best.get(key)
        if (!cur || odds > cur.odds) {
          best.set(key, {
            matchId: row.matchId,
            market,
            outcome,
            odds,
            bookmaker: row.bookmaker,
          })
        }
      }
    }
  }
  return Array.from(best.values())
}
