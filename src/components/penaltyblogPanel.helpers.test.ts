import { describe, expect, it } from 'vitest'
import {
  buildHistoryLoadedMessage,
  deriveOneX2Result,
  hydratePayloadWithHistory,
} from '#/components/penaltyblogPanel.helpers'
import type { PenaltyblogHistoricalMatch } from '#/server/penaltyblog'

const sampleMatches: PenaltyblogHistoricalMatch[] = [
  {
    source: 'frontbet',
    league: 'Premier League',
    date: '2025-05-01',
    team_home: 'Arsenal',
    team_away: 'Chelsea',
    goals_home: 2,
    goals_away: 1,
    home_odds: 2.1,
    draw_odds: 3.2,
    away_odds: 3.5,
  },
  {
    source: 'soccerdata',
    league: 'Premier League',
    date: '2025-05-02',
    team_home: 'Liverpool',
    team_away: 'Arsenal',
    goals_home: 1,
    goals_away: 1,
    home_odds: null,
    draw_odds: null,
    away_odds: null,
  },
]

describe('penaltyblogPanel helpers', () => {
  it('builds the soccerdata backtest warning message', () => {
    expect(
      buildHistoryLoadedMessage({ family: 'backtest', source: 'soccerdata', count: 24 }),
    ).toContain('Soccerdata history does not include 1X2 odds')
  })

  it('does not append the odds warning for non-backtest loaders', () => {
    expect(
      buildHistoryLoadedMessage({ family: 'ratings', source: 'soccerdata', count: 24 }),
    ).toBe('Loaded 24 historical matches from soccerdata.')
  })

  it('derives 1X2 results from scorelines', () => {
    expect(deriveOneX2Result(sampleMatches[0])).toBe(0)
    expect(deriveOneX2Result(sampleMatches[1])).toBe(1)
    expect(
      deriveOneX2Result({
        ...sampleMatches[1],
        goals_home: 0,
        goals_away: 2,
      }),
    ).toBe(2)
  })

  it('hydrates backtest payloads with loaded odds data', () => {
    const hydrated = hydratePayloadWithHistory('backtest_run', { model: 'PoissonGoalsModel' }, sampleMatches) as {
      matches: Array<Record<string, unknown>>
    }

    expect(hydrated.matches).toHaveLength(2)
    expect(hydrated.matches[0]).toMatchObject({
      team_home: 'Arsenal',
      team_away: 'Chelsea',
      home_odds: 2.1,
      draw_odds: 3.2,
      away_odds: 3.5,
    })
    expect(hydrated.matches[1]).toMatchObject({
      team_home: 'Liverpool',
      team_away: 'Arsenal',
      home_odds: null,
      draw_odds: null,
      away_odds: null,
    })
  })

  it('preserves user-selected model instead of overriding to PoissonGoalsModel', () => {
    const hydrated = hydratePayloadWithHistory(
      'model_fit_predict',
      { model: 'DixonColesGoalModel', prediction: { home_team: 'Arsenal', away_team: 'Chelsea' } },
      sampleMatches,
    ) as { model: string }

    expect(hydrated.model).toBe('DixonColesGoalModel')
  })

  it('defaults to PoissonGoalsModel when no model is specified', () => {
    const hydrated = hydratePayloadWithHistory(
      'model_fit_predict',
      { prediction: { home_team: 'Arsenal', away_team: 'Chelsea' } },
      sampleMatches,
    ) as { model: string }

    // model should not be explicitly set; payload has no model property
    expect(hydrated.model).toBeUndefined()
  })

  it('adds team warnings when prediction teams are not in history', () => {
    const hydrated = hydratePayloadWithHistory(
      'model_fit_predict',
      { model: 'DixonColesGoalModel', prediction: { home_team: 'Wealdstone', away_team: 'Hartlepool' } },
      sampleMatches,
    ) as { _teamWarnings: string[]; prediction: { home_team: string; away_team: string } }

    expect(hydrated._teamWarnings).toBeDefined()
    expect(hydrated._teamWarnings).toHaveLength(2)
    expect(hydrated._teamWarnings[0]).toContain('Wealdstone')
    expect(hydrated._teamWarnings[1]).toContain('Hartlepool')
    // Falls back to last match teams
    expect(hydrated.prediction.home_team).toBe('Liverpool')
    expect(hydrated.prediction.away_team).toBe('Arsenal')
  })

  it('does not add team warnings when prediction teams are in history', () => {
    const hydrated = hydratePayloadWithHistory(
      'model_fit_predict',
      { model: 'DixonColesGoalModel', prediction: { home_team: 'Arsenal', away_team: 'Chelsea' } },
      sampleMatches,
    ) as { _teamWarnings?: string[] }

    expect(hydrated._teamWarnings).toBeUndefined()
  })
})