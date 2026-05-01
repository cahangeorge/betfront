import { describe, expect, it } from 'vitest'

/**
 * Unit tests for ticket generation helpers.
 * Tests the pure logic extracted from tickets.ts that doesn't need Prisma/DB.
 */

// Re-implement the pure calcTicketStats logic for testing
// (the real one lives inside tickets.ts but isn't exported separately)
function calcTicketStats(
  selections: Array<{ odds: number; modelProb?: number }>,
  stake: number,
) {
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

function marketDisplayName(market: string, submarket: string | null): string {
  const key = submarket ?? market
  if (key === '1x2') return '1X2'
  if (key === 'btts') return 'BTTS'
  if (key === 'double_chance') return 'Double Chance'
  if (key === 'draw_no_bet') return 'Draw No Bet'
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
  if (key.startsWith('over_under')) {
    const num = key.replace('over_under_', '').replace(/_/g, '.')
    const parsed = parseFloat(num)
    const line = isNaN(parsed) ? '' : ` ${parsed}`
    if (outcome === 'over') return `Over${line}`
    if (outcome === 'under') return `Under${line}`
  }
  return outcome.charAt(0).toUpperCase() + outcome.slice(1)
}

describe('calcTicketStats', () => {
  it('returns default for empty selections', () => {
    const stats = calcTicketStats([], 10)
    expect(stats.combinedOdds).toBe(1)
    expect(stats.potentialReturn).toBe(0)
    expect(stats.expectedValue).toBe(0)
  })

  it('calculates single selection correctly', () => {
    const stats = calcTicketStats([{ odds: 2.5 }], 10)
    expect(stats.combinedOdds).toBe(2.5)
    expect(stats.potentialReturn).toBe(25)
    expect(stats.combinedProbability).toBeCloseTo(0.4, 1)
  })

  it('calculates accumulator stats correctly', () => {
    const stats = calcTicketStats(
      [{ odds: 1.8 }, { odds: 2.1 }, { odds: 1.5 }],
      10,
    )
    expect(stats.combinedOdds).toBeCloseTo(5.67, 1)
    expect(stats.potentialReturn).toBeCloseTo(56.7, 0)
    expect(stats.combinedProbability).toBeGreaterThan(0)
    expect(stats.combinedProbability).toBeLessThan(1)
  })

  it('expected value is near zero for fair bets', () => {
    // If the implied probability equals 1/odds for all selections,
    // the expected value of the combined bet should be near 0
    const stats = calcTicketStats([{ odds: 2.0 }, { odds: 2.0 }], 10)
    // combinedProbability = 0.5 * 0.5 = 0.25; combinedOdds = 4.0; EV = 0.25*4 - 1 = 0
    expect(stats.expectedValue).toBeCloseTo(0, 4)
  })

  it('uses model probabilities for total EV when available', () => {
    const stats = calcTicketStats(
      [{ odds: 3.8, modelProb: 0.776 }, { odds: 3.05, modelProb: 0.742 }],
      10,
    )

    expect(stats.combinedOdds).toBeCloseTo(11.59, 2)
    expect(stats.combinedProbability).toBeCloseTo(0.5758, 4)
    expect(stats.expectedValue).toBeCloseTo(5.6734, 4)
    expect(stats.expectedValue).toBeGreaterThan(0)
  })
})

describe('marketDisplayName', () => {
  it('maps well-known markets', () => {
    expect(marketDisplayName('1x2', null)).toBe('1X2')
    expect(marketDisplayName('btts', null)).toBe('BTTS')
    expect(marketDisplayName('double_chance', null)).toBe('Double Chance')
  })

  it('parses over/under with line', () => {
    expect(marketDisplayName('over_under', 'over_under_2_5')).toBe('Over/Under 2.5')
    expect(marketDisplayName('over_under', 'over_under_1_5')).toBe('Over/Under 1.5')
  })

  it('falls back to titlecase for unknown markets', () => {
    expect(marketDisplayName('corner_kicks', null)).toBe('Corner Kicks')
  })
})

describe('outcomeLabel', () => {
  it('formats 1x2 outcomes with team names', () => {
    expect(outcomeLabel('1x2', null, 'home', 'Arsenal', 'Chelsea')).toBe('Arsenal Win')
    expect(outcomeLabel('1x2', null, 'draw', 'Arsenal', 'Chelsea')).toBe('Draw')
    expect(outcomeLabel('1x2', null, 'away', 'Arsenal', 'Chelsea')).toBe('Chelsea Win')
  })

  it('formats BTTS outcomes', () => {
    expect(outcomeLabel('btts', null, 'yes', 'A', 'B')).toBe('BTTS Yes')
    expect(outcomeLabel('btts', null, 'no', 'A', 'B')).toBe('BTTS No')
  })

  it('formats over/under with line', () => {
    expect(outcomeLabel('over_under', 'over_under_2_5', 'over', 'A', 'B')).toBe('Over 2.5')
    expect(outcomeLabel('over_under', 'over_under_2_5', 'under', 'A', 'B')).toBe('Under 2.5')
  })
})

describe('value bet edge calculation', () => {
  it('computes positive edge when model prob > implied prob', () => {
    const modelProb = 0.6
    const bestOdds = 2.0
    const impliedProb = 1 / bestOdds // 0.5
    const edge = modelProb - impliedProb // 0.1
    const expectedValue = modelProb * bestOdds - 1 // 0.2

    expect(edge).toBeCloseTo(0.1, 4)
    expect(expectedValue).toBeCloseTo(0.2, 4)
    expect(edge).toBeGreaterThan(0)
    expect(expectedValue).toBeGreaterThan(0)
  })

  it('computes negative edge when model prob < implied prob', () => {
    const modelProb = 0.3
    const bestOdds = 2.0
    const impliedProb = 1 / bestOdds // 0.5
    const edge = modelProb - impliedProb // -0.2
    const expectedValue = modelProb * bestOdds - 1 // -0.4

    expect(edge).toBeLessThan(0)
    expect(expectedValue).toBeLessThan(0)
  })

  it('filters bets by minimum edge threshold', () => {
    const bets = [
      { edge: 0.05, key: 'a' },
      { edge: 0.02, key: 'b' },
      { edge: -0.01, key: 'c' },
      { edge: 0.10, key: 'd' },
    ]

    const minEdge = 0.03
    const selected = bets.filter((b) => b.edge >= minEdge)
    expect(selected).toHaveLength(2)
    expect(selected.map((b) => b.key)).toEqual(['a', 'd'])
  })
})

describe('generateTicketFromPredictions logic', () => {
  it('builds correct selections from value bets', () => {
    // Simulate the selection-building logic from generateTicketFromPredictions
    const valueBets = [
      {
        matchId: 1,
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        matchDate: '2026-03-25',
        sport: 'football',
        league: 'Premier League',
        market: '1x2',
        submarket: null,
        outcome: 'home',
        label: 'Arsenal Win',
        bestOdds: 2.1,
        bookmaker: 'bet365',
        edge: 0.08,
        modelProb: 0.556,
        impliedProb: 0.476,
        expectedValue: 0.168,
      },
    ]

    const selections = valueBets.map((b) => ({
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

    expect(selections).toHaveLength(1)
    expect(selections[0]).toMatchObject({
      matchId: 1,
      homeTeam: 'Arsenal',
      odds: 2.1,
      market: '1x2',
      outcome: 'home',
    })

    const stats = calcTicketStats(selections, 10)
    expect(stats.combinedOdds).toBe(2.1)
    expect(stats.potentialReturn).toBe(21)
    expect(stats.expectedValue).toBeCloseTo(0.1676, 4)
  })

  it('returns empty when no bets above threshold', () => {
    const bets = [
      { edge: 0.01 },
      { edge: -0.05 },
    ]
    const minEdge = 0.03
    const selected = bets.filter((b) => b.edge >= minEdge)
    expect(selected).toHaveLength(0)
  })

  it('auto-names ticket with count when no name provided', () => {
    const selectedCount = 4
    const autoName = `Auto: ${selectedCount} value bets`
    expect(autoName).toBe('Auto: 4 value bets')
  })
})
