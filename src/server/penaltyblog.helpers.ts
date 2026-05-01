import type { PenaltyblogHistoricalMatch } from '#/server/penaltyblog'

export type SoccerdataHistoryRequest = {
  league: string
  season: string
  limit: number
  refresh: boolean
}

export type SoccerdataMatchHistoryResult = {
  rows: Array<{
    league: string | null
    date: string
    homeTeam: string
    awayTeam: string
    homeGoals: number | null
    awayGoals: number | null
  }>
}

export type SoccerdataScheduleResult = {
  rows: Array<Record<string, unknown>>
}

export type SoccerdataHistoryLoaders = {
  loadMatchHistoryGames: (request: SoccerdataHistoryRequest) => Promise<SoccerdataMatchHistoryResult>
  loadWhoScoredSchedule: (request: SoccerdataHistoryRequest) => Promise<SoccerdataScheduleResult>
  loadSofascoreSchedule: (request: Omit<SoccerdataHistoryRequest, 'limit'>) => Promise<SoccerdataScheduleResult>
}

export type FrontbetHistoricalMatchRow = {
  league: string | null
  matchDate: string | null
  createdAt: Date
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  odds: Array<{
    oddsHome: number | null
    oddsDraw: number | null
    oddsAway: number | null
  }>
}

export function pickOneX2Odds(
  odds: Array<{
    oddsHome: number | null
    oddsDraw: number | null
    oddsAway: number | null
  }>,
) {
  const complete = odds.find((entry) => entry.oddsHome != null && entry.oddsDraw != null && entry.oddsAway != null)
  if (complete) {
    return complete
  }

  const partial = odds.find((entry) => entry.oddsHome != null || entry.oddsDraw != null || entry.oddsAway != null)
  return partial ?? { oddsHome: null, oddsDraw: null, oddsAway: null }
}

export function sortHistoricalMatches(matches: PenaltyblogHistoricalMatch[]) {
  return [...matches].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
}

export function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function toStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

export function buildSeasonVariants(season: string) {
  const trimmed = season.trim()
  const variants = new Set<string>([trimmed])

  const fullSeasonMatch = trimmed.match(/^(\d{4})[-/](\d{4})$/)
  if (fullSeasonMatch) {
    const startYear = fullSeasonMatch[1]
    const endYear = fullSeasonMatch[2]
    variants.add(`${startYear.slice(2)}${endYear.slice(2)}`)
    variants.add(startYear)
    return [...variants]
  }

  const compactSeasonMatch = trimmed.match(/^(\d{2})(\d{2})$/)
  if (compactSeasonMatch) {
    const startYear = Number(`20${compactSeasonMatch[1]}`)
    const endYear = Number(`20${compactSeasonMatch[2]}`)

    if (endYear === startYear + 1) {
      variants.add(`${startYear}-${endYear}`)
      variants.add(String(startYear))
      return [...variants]
    }
  }

  const yearMatch = trimmed.match(/^(\d{4})$/)
  if (yearMatch) {
    const startYear = Number(yearMatch[1])
    variants.add(`${startYear}-${startYear + 1}`)
    variants.add(`${String(startYear).slice(2)}${String(startYear + 1).slice(2)}`)
  }

  return [...variants]
}

export function normalizeSoccerdataScheduleRows(
  rows: Array<Record<string, unknown>>,
  league: string,
  sourceLabel: 'soccerdata',
) {
  return rows
    .map((row) => {
      const goalsHome = toNumber(
        row.homeGoals ?? row.homeScore ?? row.home_score ?? row.score_home ?? row.scoreHome,
      )
      const goalsAway = toNumber(
        row.awayGoals ?? row.awayScore ?? row.away_score ?? row.score_away ?? row.scoreAway,
      )
      const teamHome = toStringValue(row.homeTeam ?? row.home_team)
      const teamAway = toStringValue(row.awayTeam ?? row.away_team)
      const date = toStringValue(row.date)

      if (goalsHome == null || goalsAway == null || !teamHome || !teamAway || !date) {
        return null
      }

      return {
        source: sourceLabel,
        league,
        date,
        team_home: teamHome,
        team_away: teamAway,
        goals_home: goalsHome,
        goals_away: goalsAway,
        home_odds: null,
        draw_odds: null,
        away_odds: null,
      } as PenaltyblogHistoricalMatch
    })
    .filter((match): match is PenaltyblogHistoricalMatch => match !== null)
}

export function selectRecentMatches(matches: PenaltyblogHistoricalMatch[], limit: number) {
  return sortHistoricalMatches(matches).slice(-limit)
}

export function mapFrontbetHistoricalMatches(matches: FrontbetHistoricalMatchRow[]) {
  const mapped = matches.map((match) => {
    const odds = pickOneX2Odds(match.odds)
    return {
      source: 'frontbet' as const,
      league: match.league,
      date: match.matchDate ?? match.createdAt.toISOString(),
      team_home: match.homeTeam,
      team_away: match.awayTeam,
      goals_home: match.homeScore ?? 0,
      goals_away: match.awayScore ?? 0,
      home_odds: odds.oddsHome,
      draw_odds: odds.oddsDraw,
      away_odds: odds.oddsAway,
    }
  })

  // Deduplicate by (team_home, team_away, date) — keep the entry with non-zero scores
  const seen = new Map<string, (typeof mapped)[number]>()
  for (const m of mapped) {
    const key = `${m.team_home}|${m.team_away}|${m.date.slice(0, 10)}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, m)
    } else {
      // Prefer entry with actual scores (non-zero) and odds
      const hasScores = (m.goals_home !== 0 || m.goals_away !== 0)
      const existingHasScores = (existing.goals_home !== 0 || existing.goals_away !== 0)
      if (hasScores && !existingHasScores) {
        seen.set(key, m)
      }
    }
  }

  return sortHistoricalMatches([...seen.values()])
}

export async function resolveSoccerdataHistoricalMatches(
  request: SoccerdataHistoryRequest,
  loaders: SoccerdataHistoryLoaders,
) {
  const errors: string[] = []

  try {
    const result = await loaders.loadMatchHistoryGames(request)

    return sortHistoricalMatches(
      result.rows
        .filter((row) => row.homeGoals != null && row.awayGoals != null)
        .map((row) => ({
          source: 'soccerdata' as const,
          league: row.league,
          date: row.date,
          team_home: row.homeTeam,
          team_away: row.awayTeam,
          goals_home: row.homeGoals ?? 0,
          goals_away: row.awayGoals ?? 0,
          home_odds: null,
          draw_odds: null,
          away_odds: null,
        })),
    )
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Failed to load MatchHistory games')
  }

  const seasonVariants = buildSeasonVariants(request.season)

  for (const season of seasonVariants) {
    try {
      const result = await loaders.loadWhoScoredSchedule({
        ...request,
        season,
      })

      const matches = selectRecentMatches(
        normalizeSoccerdataScheduleRows(result.rows, request.league, 'soccerdata'),
        request.limit,
      )
      if (matches.length > 0) {
        return matches
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Failed to load WhoScored schedule for ${season}`)
    }
  }

  for (const season of seasonVariants) {
    try {
      const result = await loaders.loadSofascoreSchedule({
        league: request.league,
        season,
        refresh: request.refresh,
      })

      const matches = selectRecentMatches(
        normalizeSoccerdataScheduleRows(result.rows, request.league, 'soccerdata'),
        request.limit,
      )
      if (matches.length > 0) {
        return matches
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Failed to load Sofascore schedule for ${season}`)
    }
  }

  throw new Error(errors[0] ?? 'Failed to load soccerdata historical matches')
}