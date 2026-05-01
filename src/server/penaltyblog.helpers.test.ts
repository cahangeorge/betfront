import { describe, expect, it, vi } from 'vitest'
import {
  buildSeasonVariants,
  mapFrontbetHistoricalMatches,
  normalizeSoccerdataScheduleRows,
  pickOneX2Odds,
  resolveSoccerdataHistoricalMatches,
  selectRecentMatches,
  sortHistoricalMatches,
  toNumber,
  toStringValue,
} from '#/server/penaltyblog.helpers'

describe('penaltyblog server helpers', () => {
  it('builds season variants for full, compact, and yearly forms', () => {
    expect(buildSeasonVariants('2024-2025')).toEqual(expect.arrayContaining(['2024-2025', '2425', '2024']))
    expect(buildSeasonVariants('2425')).toEqual(expect.arrayContaining(['2425', '2024-2025', '2024']))
    expect(buildSeasonVariants('2024')).toEqual(expect.arrayContaining(['2024', '2024-2025', '2425']))
  })

  it('normalizes soccerdata rows and drops incomplete fixtures', () => {
    const rows = normalizeSoccerdataScheduleRows(
      [
        {
          home_score: '2',
          away_score: '1',
          home_team: 'Arsenal',
          away_team: 'Chelsea',
          date: '2025-05-01',
        },
        {
          homeGoals: 1,
          awayGoals: null,
          homeTeam: 'Liverpool',
          awayTeam: 'Spurs',
          date: '2025-05-02',
        },
      ],
      'Premier League',
      'soccerdata',
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      source: 'soccerdata',
      league: 'Premier League',
      team_home: 'Arsenal',
      team_away: 'Chelsea',
      goals_home: 2,
      goals_away: 1,
      home_odds: null,
    })
  })

  it('selects complete odds before partial odds', () => {
    expect(
      pickOneX2Odds([
        { oddsHome: 2.1, oddsDraw: null, oddsAway: null },
        { oddsHome: 2.0, oddsDraw: 3.2, oddsAway: 3.7 },
      ]),
    ).toEqual({ oddsHome: 2.0, oddsDraw: 3.2, oddsAway: 3.7 })
  })

  it('falls back to partial or empty odds when complete odds are unavailable', () => {
    expect(
      pickOneX2Odds([{ oddsHome: null, oddsDraw: 3.3, oddsAway: null }]),
    ).toEqual({ oddsHome: null, oddsDraw: 3.3, oddsAway: null })

    expect(pickOneX2Odds([])).toEqual({ oddsHome: null, oddsDraw: null, oddsAway: null })
  })

  it('sorts and limits historical matches from oldest to newest', () => {
    const matches = [
      {
        source: 'frontbet' as const,
        league: 'Premier League',
        date: '2025-05-03',
        team_home: 'C',
        team_away: 'D',
        goals_home: 3,
        goals_away: 2,
        home_odds: 2.2,
        draw_odds: 3.1,
        away_odds: 3.0,
      },
      {
        source: 'frontbet' as const,
        league: 'Premier League',
        date: '2025-05-01',
        team_home: 'A',
        team_away: 'B',
        goals_home: 1,
        goals_away: 0,
        home_odds: 1.9,
        draw_odds: 3.4,
        away_odds: 4.0,
      },
      {
        source: 'frontbet' as const,
        league: 'Premier League',
        date: '2025-05-02',
        team_home: 'B',
        team_away: 'C',
        goals_home: 1,
        goals_away: 1,
        home_odds: 2.4,
        draw_odds: 3.0,
        away_odds: 2.9,
      },
    ]

    const sorted = sortHistoricalMatches(matches)
    expect(sorted.map((match) => match.date)).toEqual(['2025-05-01', '2025-05-02', '2025-05-03'])

    const recent = selectRecentMatches(matches, 2)
    expect(recent.map((match) => match.date)).toEqual(['2025-05-02', '2025-05-03'])
  })

  it('parses numbers and non-empty strings safely', () => {
    expect(toNumber(2.5)).toBe(2.5)
    expect(toNumber('3')).toBe(3)
    expect(toNumber('abc')).toBeNull()
    expect(toStringValue(' Premier League ')).toBe(' Premier League ')
    expect(toStringValue('')).toBeNull()
  })

  it('maps frontbet matches with score defaults, date fallback, and odds precedence', () => {
    const matches = mapFrontbetHistoricalMatches([
      {
        league: 'Premier League',
        matchDate: null,
        createdAt: new Date('2025-05-02T12:00:00.000Z'),
        homeTeam: 'Chelsea',
        awayTeam: 'Arsenal',
        homeScore: null,
        awayScore: 1,
        odds: [{ oddsHome: 2.9, oddsDraw: null, oddsAway: null }],
      },
      {
        league: 'Premier League',
        matchDate: '2025-05-01',
        createdAt: new Date('2025-05-01T12:00:00.000Z'),
        homeTeam: 'Arsenal',
        awayTeam: 'Liverpool',
        homeScore: 2,
        awayScore: 0,
        odds: [
          { oddsHome: 2.5, oddsDraw: null, oddsAway: null },
          { oddsHome: 2.1, oddsDraw: 3.2, oddsAway: 3.6 },
        ],
      },
    ])

    expect(matches).toEqual([
      {
        source: 'frontbet',
        league: 'Premier League',
        date: '2025-05-01',
        team_home: 'Arsenal',
        team_away: 'Liverpool',
        goals_home: 2,
        goals_away: 0,
        home_odds: 2.1,
        draw_odds: 3.2,
        away_odds: 3.6,
      },
      {
        source: 'frontbet',
        league: 'Premier League',
        date: '2025-05-02T12:00:00.000Z',
        team_home: 'Chelsea',
        team_away: 'Arsenal',
        goals_home: 0,
        goals_away: 1,
        home_odds: 2.9,
        draw_odds: null,
        away_odds: null,
      },
    ])
  })

  it('returns MatchHistory rows before attempting fallback providers', async () => {
    const loadMatchHistoryGames = vi.fn().mockResolvedValue({
      rows: [
        {
          league: 'Premier League',
          date: '2025-05-01',
          homeTeam: 'Arsenal',
          awayTeam: 'Chelsea',
          homeGoals: 2,
          awayGoals: 1,
        },
      ],
    })
    const loadWhoScoredSchedule = vi.fn()
    const loadSofascoreSchedule = vi.fn()

    const matches = await resolveSoccerdataHistoricalMatches(
      {
        league: 'Premier League',
        season: '2024-2025',
        limit: 50,
        refresh: false,
      },
      {
        loadMatchHistoryGames,
        loadWhoScoredSchedule,
        loadSofascoreSchedule,
      },
    )

    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({
      source: 'soccerdata',
      team_home: 'Arsenal',
      team_away: 'Chelsea',
      goals_home: 2,
      goals_away: 1,
    })
    expect(loadWhoScoredSchedule).not.toHaveBeenCalled()
    expect(loadSofascoreSchedule).not.toHaveBeenCalled()
  })

  it('falls back through WhoScored and then Sofascore using season variants', async () => {
    const loadMatchHistoryGames = vi.fn().mockRejectedValue(new Error('matchhistory down'))
    const loadWhoScoredSchedule = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
    const loadSofascoreSchedule = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            home_score: '3',
            away_score: '1',
            home_team: 'Liverpool',
            away_team: 'Spurs',
            date: '2025-05-02',
          },
        ],
      })

    const matches = await resolveSoccerdataHistoricalMatches(
      {
        league: 'Premier League',
        season: '2425',
        limit: 50,
        refresh: true,
      },
      {
        loadMatchHistoryGames,
        loadWhoScoredSchedule,
        loadSofascoreSchedule,
      },
    )

    expect(loadWhoScoredSchedule.mock.calls.map((call) => call[0].season)).toEqual(['2425', '2024-2025', '2024'])
    expect(loadSofascoreSchedule.mock.calls.map((call) => call[0].season)).toEqual(['2425', '2024-2025'])
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({
      team_home: 'Liverpool',
      team_away: 'Spurs',
      goals_home: 3,
      goals_away: 1,
    })
  })
})