// OddsHarvester sport/league catalog loader.
// Parses sport_league_constants.py from the sibling OddsHarvester checkout.

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { LeagueCatalogItem } from './types'

const ODDSHARVESTER_LEAGUES_FILE = path.resolve(
  `${import.meta.dirname}/../../../../OddsHarvester/src/oddsharvester/utils/sport_league_constants.py`,
)

const SPORT_ENUM_TO_VALUE: Record<string, string> = {
  FOOTBALL: 'football',
  TENNIS: 'tennis',
  BASKETBALL: 'basketball',
  RUGBY_LEAGUE: 'rugby-league',
  RUGBY_UNION: 'rugby-union',
  ICE_HOCKEY: 'ice-hockey',
  BASEBALL: 'baseball',
  AMERICAN_FOOTBALL: 'american-football',
}

let leagueCatalogPromise: Promise<LeagueCatalogItem[]> | null = null

function formatSlugLabel(value: string) {
  const uppercaseTokens = new Set([
    'atp', 'wta', 'nba', 'nfl', 'mls', 'ncaa', 'qsl', 'pcl', 'dfb', 'isl',
    'nrl', 'khl', 'nhl', 'shl', 'del', 'aba', 'acb', 'lnb', 'bbl', 'vtb',
    'bnxt', 'pba', 'plk', 'lkl', 'lbl', 'kbl', 'kbsl', 'npb',
  ])
  const romanTokens = new Set(['i', 'ii', 'iii', 'iv', 'v'])

  return value
    .split('-')
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase()
      if (uppercaseTokens.has(lower) || /^\d+$/.test(part)) return part.toUpperCase()
      if (romanTokens.has(lower)) return lower.toUpperCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

export function loadLeagueCatalog(): Promise<LeagueCatalogItem[]> {
  if (!leagueCatalogPromise) {
    leagueCatalogPromise = readFile(ODDSHARVESTER_LEAGUES_FILE, 'utf-8').then((text) => {
      const items: LeagueCatalogItem[] = []
      let currentSport: string | null = null

      for (const line of text.split(/\r?\n/)) {
        const sportMatch = line.match(/^\s*Sport\.([A-Z_]+):\s*\{$/)
        if (sportMatch) {
          currentSport = SPORT_ENUM_TO_VALUE[sportMatch[1]] ?? null
          continue
        }

        if (currentSport && /^\s*},?\s*$/.test(line)) {
          currentSport = null
          continue
        }

        if (!currentSport) continue

        const leagueMatch = line.match(/^\s*"([^"]+)":\s*"([^"]+)",?\s*$/)
        if (!leagueMatch) continue

        const league = leagueMatch[1]
        const url = leagueMatch[2]

        try {
          const pathname = new URL(url).pathname.split('/').filter(Boolean)
          const country = pathname[1] ?? 'other'
          items.push({
            sport: currentSport,
            country,
            countryLabel: formatSlugLabel(country),
            league,
            leagueLabel: formatSlugLabel(league),
            urlLeague: pathname[2] ?? '',
            value: `${currentSport}:${league}`,
          })
        } catch {
          items.push({
            sport: currentSport,
            country: 'other',
            countryLabel: 'Other',
            league,
            leagueLabel: formatSlugLabel(league),
            urlLeague: '',
            value: `${currentSport}:${league}`,
          })
        }
      }

      return items
    })
  }

  return leagueCatalogPromise
}
