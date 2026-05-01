import type { PenaltyblogHistoricalMatch } from '#/server/penaltyblog'

export type HistoryMessageOptions = {
  family: 'models' | 'betting' | 'ratings' | 'metrics' | 'backtest' | 'scrapers' | 'fpl'
  source: 'frontbet' | 'soccerdata'
  count: number
}

export function deriveOneX2Result(match: PenaltyblogHistoricalMatch) {
  if (match.goals_home > match.goals_away) return 0
  if (match.goals_home === match.goals_away) return 1
  return 2
}

export function teamExistsInHistory(team: unknown, matches: PenaltyblogHistoricalMatch[]) {
  if (typeof team !== 'string' || !team) {
    return false
  }

  return matches.some((match) => match.team_home === team || match.team_away === team)
}

export function hydratePayloadWithHistory(
  operation: string,
  payload: Record<string, unknown>,
  matches: PenaltyblogHistoricalMatch[],
) {
  if (matches.length === 0) {
    return payload
  }

  const lastMatch = matches[matches.length - 1]

  switch (operation) {
    case 'model_fit_predict': {
      const currentPrediction =
        payload.prediction && typeof payload.prediction === 'object' && !Array.isArray(payload.prediction)
          ? (payload.prediction as Record<string, unknown>)
          : {}

      const homeTeam = currentPrediction.home_team
      const awayTeam = currentPrediction.away_team
      const homeInHistory = teamExistsInHistory(homeTeam, matches)
      const awayInHistory = teamExistsInHistory(awayTeam, matches)

      const teamWarnings: string[] = []
      if (typeof homeTeam === 'string' && homeTeam && !homeInHistory) {
        teamWarnings.push(`Home team "${homeTeam}" not found in history, using "${lastMatch.team_home}" instead`)
      }
      if (typeof awayTeam === 'string' && awayTeam && !awayInHistory) {
        teamWarnings.push(`Away team "${awayTeam}" not found in history, using "${lastMatch.team_away}" instead`)
      }

      return {
        ...payload,
        ...(teamWarnings.length > 0 ? { _teamWarnings: teamWarnings } : {}),
        goals_home: matches.map((match) => match.goals_home),
        goals_away: matches.map((match) => match.goals_away),
        teams_home: matches.map((match) => match.team_home),
        teams_away: matches.map((match) => match.team_away),
        prediction: {
          ...currentPrediction,
          home_team: homeInHistory ? homeTeam : lastMatch.team_home,
          away_team: awayInHistory ? awayTeam : lastMatch.team_away,
          max_goals:
            typeof currentPrediction.max_goals === 'number' && Number.isFinite(currentPrediction.max_goals)
              ? currentPrediction.max_goals
              : 8,
        },
      }
    }

    case 'elo_ratings':
      return {
        ...payload,
        matches: matches.map((match) => ({
          home: match.team_home,
          away: match.team_away,
          result: deriveOneX2Result(match),
        })),
      }

    case 'pi_ratings':
      return {
        ...payload,
        matches: matches.map((match) => ({
          home: match.team_home,
          away: match.team_away,
          goals_home: match.goals_home,
          goals_away: match.goals_away,
          date: match.date,
        })),
      }

    case 'colley_ratings':
    case 'massey_ratings':
      return {
        ...payload,
        goals_home: matches.map((match) => match.goals_home),
        goals_away: matches.map((match) => match.goals_away),
        teams_home: matches.map((match) => match.team_home),
        teams_away: matches.map((match) => match.team_away),
      }

    case 'backtest_run':
      return {
        ...payload,
        matches: matches.map((match) => ({
          date: match.date,
          team_home: match.team_home,
          team_away: match.team_away,
          goals_home: match.goals_home,
          goals_away: match.goals_away,
          home_odds: match.home_odds,
          draw_odds: match.draw_odds,
          away_odds: match.away_odds,
        })),
      }

    default:
      return payload
  }
}

export function buildHistoryLoadedMessage({ family, source, count }: HistoryMessageOptions) {
  const base = `Loaded ${count} historical matches from ${source}.`

  if (family === 'backtest' && source === 'soccerdata') {
    return `${base} Soccerdata history does not include 1X2 odds, so automated backtests will only place bets after you add odds manually.`
  }

  return base
}