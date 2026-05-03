import { describe, expect, it } from 'vitest'

import { mapPredictionRunToHistorySession } from '#/server/predictionHistory.helpers'

describe('prediction history helpers', () => {
  it('maps a successful single-model run into a history session with per-match aggregates', () => {
    const session = mapPredictionRunToHistorySession({
      id: 7,
      league: 'England Premier League',
      source: 'single',
      modelKey: 'PoissonGoalsModel',
      createdAt: new Date('2026-05-03T00:00:00.000Z'),
      error: '{"written":7}',
      ensemblePredictions: [],
      modelPredictions: [
        { id: 101, matchId: 10, market: '1x2', outcome: 'home', probability: 0.52, createdAt: new Date('2026-05-03T00:00:00.000Z'), match: { id: 10, homeTeam: 'Arsenal', awayTeam: 'Chelsea', matchDate: '2026-05-10', league: 'England Premier League', homeScore: 2, awayScore: 1 } },
        { id: 102, matchId: 10, market: '1x2', outcome: 'draw', probability: 0.24, createdAt: new Date('2026-05-03T00:00:00.000Z'), match: { id: 10, homeTeam: 'Arsenal', awayTeam: 'Chelsea', matchDate: '2026-05-10', league: 'England Premier League', homeScore: 2, awayScore: 1 } },
        { id: 103, matchId: 10, market: '1x2', outcome: 'away', probability: 0.24, createdAt: new Date('2026-05-03T00:00:00.000Z'), match: { id: 10, homeTeam: 'Arsenal', awayTeam: 'Chelsea', matchDate: '2026-05-10', league: 'England Premier League', homeScore: 2, awayScore: 1 } },
        { id: 104, matchId: 10, market: 'btts', outcome: 'yes', probability: 0.61, createdAt: new Date('2026-05-03T00:00:00.000Z'), match: { id: 10, homeTeam: 'Arsenal', awayTeam: 'Chelsea', matchDate: '2026-05-10', league: 'England Premier League', homeScore: 2, awayScore: 1 } },
        { id: 105, matchId: 10, market: 'btts', outcome: 'no', probability: 0.39, createdAt: new Date('2026-05-03T00:00:00.000Z'), match: { id: 10, homeTeam: 'Arsenal', awayTeam: 'Chelsea', matchDate: '2026-05-10', league: 'England Premier League', homeScore: 2, awayScore: 1 } },
        { id: 106, matchId: 10, market: 'ou_2_5', outcome: 'over', probability: 0.58, createdAt: new Date('2026-05-03T00:00:00.000Z'), match: { id: 10, homeTeam: 'Arsenal', awayTeam: 'Chelsea', matchDate: '2026-05-10', league: 'England Premier League', homeScore: 2, awayScore: 1 } },
        { id: 107, matchId: 10, market: 'ou_2_5', outcome: 'under', probability: 0.42, createdAt: new Date('2026-05-03T00:00:00.000Z'), match: { id: 10, homeTeam: 'Arsenal', awayTeam: 'Chelsea', matchDate: '2026-05-10', league: 'England Premier League', homeScore: 2, awayScore: 1 } },
      ],
    })

    expect(session).not.toBeNull()
    expect(session).toMatchObject({
      id: -7,
      source: 'pillar-single',
      model: 'PoissonGoalsModel',
      matchCount: 1,
    })
    expect(session?.predictions[0]).toMatchObject({
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      homeWinProb: 0.52,
      drawProb: 0.24,
      awayWinProb: 0.24,
      dc1X: 0.76,
      dcX2: 0.48,
      dc12: 0.76,
      ahHome: 0.52,
      ahAway: 0.48,
      predictedOutcome: '1',
      actualOutcome: '1',
      isCorrect: true,
      bttsYes: 0.61,
      over25: 0.58,
    })
  })

  it('maps an ensemble run and labels it as pillar ensemble history', () => {
    const session = mapPredictionRunToHistorySession({
      id: 4,
      league: 'England Premier League',
      source: 'ensemble',
      modelKey: null,
      createdAt: '2026-05-03T00:00:00.000Z',
      error: '{"ensembleRows":21}',
      modelPredictions: [],
      ensemblePredictions: [
        { id: 201, matchId: 11, market: '1x2', outcome: 'home', probability: 0.34, createdAt: '2026-05-03T00:00:00.000Z', match: { id: 11, homeTeam: 'Liverpool', awayTeam: 'Everton', matchDate: '2026-05-11', league: 'England Premier League', homeScore: null, awayScore: null } },
        { id: 202, matchId: 11, market: '1x2', outcome: 'draw', probability: 0.31, createdAt: '2026-05-03T00:00:00.000Z', match: { id: 11, homeTeam: 'Liverpool', awayTeam: 'Everton', matchDate: '2026-05-11', league: 'England Premier League', homeScore: null, awayScore: null } },
        { id: 203, matchId: 11, market: '1x2', outcome: 'away', probability: 0.35, createdAt: '2026-05-03T00:00:00.000Z', match: { id: 11, homeTeam: 'Liverpool', awayTeam: 'Everton', matchDate: '2026-05-11', league: 'England Premier League', homeScore: null, awayScore: null } },
      ],
    })

    expect(session).toMatchObject({
      id: -4,
      source: 'pillar-ensemble',
      model: 'Ensemble',
      matchCount: 1,
    })
    expect(session?.predictions[0]).toMatchObject({
      predictedOutcome: '2',
      confidence: 0.35,
      actualOutcome: null,
      isCorrect: null,
    })
  })

  it('keeps actual outcomes aligned to each match when a run contains multiple matches', () => {
    const session = mapPredictionRunToHistorySession({
      id: 9,
      league: 'England Premier League',
      source: 'single',
      modelKey: 'DixonColesGoalModel',
      createdAt: '2026-05-03T00:00:00.000Z',
      error: null,
      ensemblePredictions: [],
      modelPredictions: [
        { id: 301, matchId: 21, market: '1x2', outcome: 'home', probability: 0.6, createdAt: '2026-05-03T00:00:00.000Z', match: { id: 21, homeTeam: 'A', awayTeam: 'B', matchDate: '2026-05-09', league: 'England Premier League', homeScore: 1, awayScore: 0 } },
        { id: 302, matchId: 21, market: '1x2', outcome: 'draw', probability: 0.2, createdAt: '2026-05-03T00:00:00.000Z', match: { id: 21, homeTeam: 'A', awayTeam: 'B', matchDate: '2026-05-09', league: 'England Premier League', homeScore: 1, awayScore: 0 } },
        { id: 303, matchId: 21, market: '1x2', outcome: 'away', probability: 0.2, createdAt: '2026-05-03T00:00:00.000Z', match: { id: 21, homeTeam: 'A', awayTeam: 'B', matchDate: '2026-05-09', league: 'England Premier League', homeScore: 1, awayScore: 0 } },
        { id: 304, matchId: 22, market: '1x2', outcome: 'home', probability: 0.2, createdAt: '2026-05-03T00:00:00.000Z', match: { id: 22, homeTeam: 'C', awayTeam: 'D', matchDate: '2026-05-10', league: 'England Premier League', homeScore: 0, awayScore: 1 } },
        { id: 305, matchId: 22, market: '1x2', outcome: 'draw', probability: 0.3, createdAt: '2026-05-03T00:00:00.000Z', match: { id: 22, homeTeam: 'C', awayTeam: 'D', matchDate: '2026-05-10', league: 'England Premier League', homeScore: 0, awayScore: 1 } },
        { id: 306, matchId: 22, market: '1x2', outcome: 'away', probability: 0.5, createdAt: '2026-05-03T00:00:00.000Z', match: { id: 22, homeTeam: 'C', awayTeam: 'D', matchDate: '2026-05-10', league: 'England Premier League', homeScore: 0, awayScore: 1 } },
      ],
    })

    expect(session?.predictions).toHaveLength(2)
    expect(session?.predictions[0]).toMatchObject({ homeTeam: 'A', actualOutcome: '1', isCorrect: true })
    expect(session?.predictions[1]).toMatchObject({ homeTeam: 'C', actualOutcome: '2', isCorrect: true })
  })
})