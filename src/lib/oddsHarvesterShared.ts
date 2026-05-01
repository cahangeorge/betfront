import type { LeagueCatalogItem } from '#/server/scraper'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketOption = { label: string; value: string }
export type MarketGroup = {
  category: string
  display: 'pills' | 'multiselect'
  options: MarketOption[]
}
export type MarketPeriod = string // 'all' | specific period value

export type MarketEntry = { value: string; period: MarketPeriod }

// ─── Constants ────────────────────────────────────────────────────────────────

export const SPORTS = [
  { label: '⚽ Football', value: 'football' },
  { label: '🎾 Tennis', value: 'tennis' },
  { label: '🏀 Basketball', value: 'basketball' },
  { label: '🏉 Rugby League', value: 'rugby-league' },
  { label: '🏉 Rugby Union', value: 'rugby-union' },
  { label: '🏒 Ice Hockey', value: 'ice-hockey' },
  { label: '⚾ Baseball', value: 'baseball' },
  { label: '🏈 American Football', value: 'american-football' },
]

export const SPORT_PERIODS: Record<string, Array<{ label: string; value: string }>> = {
  football: [
    { label: 'Full Time', value: 'full_time' },
    { label: '1st Half', value: '1st_half' },
    { label: '2nd Half', value: '2nd_half' },
  ],
  tennis: [
    { label: 'Full Time', value: 'full_time' },
    { label: '1st Set', value: '1st_set' },
    { label: '2nd Set', value: '2nd_set' },
  ],
  basketball: [
    { label: 'FT including OT', value: 'full_including_ot' },
    { label: '1st Half', value: '1st_half' },
    { label: '2nd Half', value: '2nd_half' },
    { label: '1st Quarter', value: '1st_quarter' },
    { label: '2nd Quarter', value: '2nd_quarter' },
    { label: '3rd Quarter', value: '3rd_quarter' },
    { label: '4th Quarter', value: '4th_quarter' },
  ],
  'rugby-league': [
    { label: 'Full Time', value: 'full_time' },
    { label: '1st Half', value: '1st_half' },
  ],
  'rugby-union': [
    { label: 'Full Time', value: 'full_time' },
    { label: '1st Half', value: '1st_half' },
  ],
  'ice-hockey': [
    { label: 'Full Time', value: 'full_time' },
    { label: '1st Period', value: '1st_period' },
    { label: '2nd Period', value: '2nd_period' },
    { label: '3rd Period', value: '3rd_period' },
  ],
  baseball: [
    { label: 'FT including OT', value: 'full_including_ot' },
    { label: 'Full Time', value: 'full_time' },
    { label: '1st Half', value: '1st_half' },
  ],
  'american-football': [
    { label: 'FT including OT', value: 'full_including_ot' },
    { label: '1st Half', value: '1st_half' },
    { label: '2nd Half', value: '2nd_half' },
    { label: '1st Quarter', value: '1st_quarter' },
    { label: '2nd Quarter', value: '2nd_quarter' },
    { label: '3rd Quarter', value: '3rd_quarter' },
    { label: '4th Quarter', value: '4th_quarter' },
  ],
}

// ─── Market option builders ───────────────────────────────────────────────────

function seq(start: number, end: number, step = 1): number[] {
  const r: number[] = []
  for (let n = start; n <= end + step * 0.01; n += step) r.push(Math.round(n * 100) / 100)
  return r
}

function ou(prefix: string, lines: number[]): MarketOption[] {
  return lines.map((n) => ({
    label: `O/U ${n}`,
    value: `${prefix}${n.toString().replace('.', '_')}`,
  }))
}

function ouD(prefix: string, lines: number[]): MarketOption[] {
  return lines.map((n) => ({
    label: `O/U ${n}`,
    value: `${prefix}${n.toFixed(1).replace('.', '_')}`,
  }))
}

function hcap(prefix: string, lines: number[], lbl: string, suffix = ''): MarketOption[] {
  return lines.map((n) => ({
    label: `${lbl} ${n > 0 ? '+' : ''}${n}`,
    value: `${prefix}${n === 0 ? '0' : `${n > 0 ? '+' : ''}${n.toString().replace('.', '_')}`}${suffix}`,
  }))
}

function hcapD(prefix: string, lines: number[], lbl: string, suffix = ''): MarketOption[] {
  return lines.map((n) => ({
    label: `${lbl} ${n > 0 ? '+' : ''}${n}`,
    value: `${prefix}${n === 0 ? '0' : `${n > 0 ? '+' : ''}${n.toFixed(1).replace('.', '_')}`}${suffix}`,
  }))
}

export const ODDSHARVESTER_MARKETS: Record<string, MarketGroup[]> = {
  football: [
    {
      category: 'Base Markets',
      display: 'pills',
      options: [
        { label: '1x2', value: '1x2' },
        { label: 'BTTS', value: 'btts' },
        { label: 'Double Chance', value: 'double_chance' },
        { label: 'Draw No Bet', value: 'dnb' },
      ],
    },
    {
      category: 'Over/Under',
      display: 'multiselect',
      options: ou('over_under_', [0.5, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.25, 4.5, 4.75, 5, 5.25, 5.5, 5.75, 6, 6.25, 6.5, 6.75, 7.5, 8.5]),
    },
    {
      category: 'European Handicap',
      display: 'multiselect',
      options: hcap('european_handicap_', [-4, -3, -2, -1, 1, 2, 3, 4], 'EH'),
    },
    {
      category: 'Asian Handicap',
      display: 'multiselect',
      options: hcap('asian_handicap_', [-4, -3.75, -3.5, -3.25, -3, -2.75, -2.5, -2.25, -2, -1.75, -1.5, -1.25, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], 'AH'),
    },
  ],
  tennis: [
    {
      category: 'Base Markets',
      display: 'pills',
      options: [{ label: 'Match Winner', value: 'match_winner' }],
    },
    {
      category: 'Over/Under Sets',
      display: 'multiselect',
      options: ou('over_under_sets_', seq(2.5, 10.5, 1)),
    },
    {
      category: 'Over/Under Games',
      display: 'multiselect',
      options: ouD('over_under_games_', seq(6.5, 50.5, 0.5)),
    },
    {
      category: 'Asian Handicap Sets',
      display: 'multiselect',
      options: hcapD('asian_handicap_', [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5], 'AH', '_sets'),
    },
    {
      category: 'Asian Handicap Games',
      display: 'multiselect',
      options: hcapD('asian_handicap_', [-8.5, -7.5, -6.5, -5.5, -4.5, -3.5, -2.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5], 'AH', '_games'),
    },
    {
      category: 'Correct Score',
      display: 'multiselect',
      options: [
        { label: 'CS 2-0', value: 'correct_score_2_0' },
        { label: 'CS 2-1', value: 'correct_score_2_1' },
        { label: 'CS 0-2', value: 'correct_score_0_2' },
        { label: 'CS 1-2', value: 'correct_score_1_2' },
        { label: 'CS 3-0', value: 'correct_score_3_0' },
        { label: 'CS 0-3', value: 'correct_score_0_3' },
        { label: 'CS 1-3', value: 'correct_score_1_3' },
        { label: 'CS 2-3', value: 'correct_score_2_3' },
        { label: 'CS 3-1', value: 'correct_score_3_1' },
        { label: 'CS 3-2', value: 'correct_score_3_2' },
        { label: 'CS 6-0', value: 'correct_score_6_0' },
        { label: 'CS 6-1', value: 'correct_score_6_1' },
        { label: 'CS 6-2', value: 'correct_score_6_2' },
        { label: 'CS 6-3', value: 'correct_score_6_3' },
        { label: 'CS 6-4', value: 'correct_score_6_4' },
        { label: 'CS 7-5', value: 'correct_score_7_5' },
        { label: 'CS 7-6', value: 'correct_score_7_6' },
        { label: 'CS 0-6', value: 'correct_score_0_6' },
        { label: 'CS 1-6', value: 'correct_score_1_6' },
        { label: 'CS 2-6', value: 'correct_score_2_6' },
        { label: 'CS 3-6', value: 'correct_score_3_6' },
        { label: 'CS 4-6', value: 'correct_score_4_6' },
        { label: 'CS 5-7', value: 'correct_score_5_7' },
        { label: 'CS 6-7', value: 'correct_score_6_7' },
      ],
    },
  ],
  basketball: [
    {
      category: 'Base Markets',
      display: 'pills',
      options: [
        { label: '1x2', value: '1x2' },
        { label: 'Home/Away', value: 'home_away' },
      ],
    },
    {
      category: 'Over/Under',
      display: 'multiselect',
      options: ou('over_under_games_', seq(100.5, 260.5, 1)),
    },
    {
      category: 'Asian Handicap',
      display: 'multiselect',
      options: hcap('asian_handicap_games_', [...seq(-25.5, -1.5, 1), ...seq(0.5, 25.5, 1)], 'AH', '_games'),
    },
  ],
  'rugby-league': [
    {
      category: 'Base Markets',
      display: 'pills',
      options: [
        { label: '1x2', value: '1x2' },
        { label: 'Home/Away', value: 'home_away' },
        { label: 'Draw No Bet', value: 'dnb' },
        { label: 'Double Chance', value: 'double_chance' },
      ],
    },
    {
      category: 'Over/Under',
      display: 'multiselect',
      options: ou('over_under_', [32.5, 36.5, 40.5, 41.5, 42.5, 43.5, 44.5, 45.5, 46.5, 47.5, 48.5, 49.5, 50.5, 51.5, 52.5]),
    },
    {
      category: 'Handicap',
      display: 'multiselect',
      options: hcap('handicap_', [-16.5, -12.5, -8.5, -4.5, 4.5, 8.5, 12.5, 16.5], 'H'),
    },
  ],
  'rugby-union': [
    {
      category: 'Base Markets',
      display: 'pills',
      options: [
        { label: '1x2', value: '1x2' },
        { label: 'Home/Away', value: 'home_away' },
        { label: 'Draw No Bet', value: 'dnb' },
        { label: 'Double Chance', value: 'double_chance' },
      ],
    },
    {
      category: 'Over/Under',
      display: 'multiselect',
      options: ou('over_under_', [35.5, 39.5, 43.5, 47.5, 51.5, 55.5]),
    },
    {
      category: 'Handicap',
      display: 'multiselect',
      options: hcap('handicap_', [-17.5, -13.5, -11.5, -10.5, -9.5, -5.5, 5.5, 9.5, 10.5, 11.5, 13.5, 17.5], 'H'),
    },
  ],
  'ice-hockey': [
    {
      category: 'Base Markets',
      display: 'pills',
      options: [
        { label: '1x2', value: '1x2' },
        { label: 'Home/Away', value: 'home_away' },
        { label: 'Draw No Bet', value: 'dnb' },
        { label: 'BTTS', value: 'btts' },
        { label: 'Double Chance', value: 'double_chance' },
      ],
    },
    {
      category: 'Over/Under',
      display: 'multiselect',
      options: ou('over_under_', seq(1.5, 11.5, 1)),
    },
  ],
  baseball: [
    {
      category: 'Base Markets',
      display: 'pills',
      options: [
        { label: '1x2', value: '1x2' },
        { label: 'Home/Away', value: 'home_away' },
      ],
    },
    {
      category: 'Over/Under',
      display: 'multiselect',
      options: ouD('over_under_', seq(6.5, 11.5, 0.5)),
    },
  ],
  'american-football': [
    {
      category: 'Base Markets',
      display: 'pills',
      options: [
        { label: '1x2', value: '1x2' },
        { label: 'Home/Away', value: 'home_away' },
      ],
    },
    {
      category: 'Over/Under',
      display: 'multiselect',
      options: ou('over_under_', seq(1.5, 60.5, 1)),
    },
    {
      category: 'Asian Handicap',
      display: 'multiselect',
      options: hcapD('asian_handicap_', seq(-21.5, 3.5, 0.5), 'AH'),
    },
  ],
}

export const PERIOD_BADGE: Record<string, string> = {
  all: 'All',
  full_time: 'FT',
  full_including_ot: 'FT+OT',
  '1st_half': '1H',
  '2nd_half': '2H',
  '1st_set': '1S',
  '2nd_set': '2S',
  '1st_period': '1P',
  '2nd_period': '2P',
  '3rd_period': '3P',
  '1st_quarter': '1Q',
  '2nd_quarter': '2Q',
  '3rd_quarter': '3Q',
  '4th_quarter': '4Q',
}

export function periodBadge(p: MarketPeriod): string {
  return PERIOD_BADGE[p] ?? p
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function currentSeasonStartYear() {
  const now = new Date()
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
}

export function seasonOptions(count = 9) {
  const y = currentSeasonStartYear()
  return Array.from({ length: count }, (_, i) => {
    const start = y - (count - 1 - i)
    return { label: `${start}-${start + 1}`, value: `${start}-${start + 1}` }
  })
}

export function formatDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getCountryOptions(sports: string[], catalog: LeagueCatalogItem[]) {
  const seen = new Set<string>()
  return catalog
    .filter((item) => sports.includes(item.sport))
    .filter((item) => {
      if (seen.has(item.country)) return false
      seen.add(item.country)
      return true
    })
    .map((item) => ({ label: item.countryLabel, value: item.country }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function getLeagueGroupedOptions(
  sports: string[],
  countries: string[],
  catalog: LeagueCatalogItem[],
) {
  const selectedCountries = new Set(countries)
  const grouped = new Map<string, { label: string; value: string }[]>()

  for (const item of catalog) {
    if (!sports.includes(item.sport)) continue
    if (selectedCountries.size > 0 && !selectedCountries.has(item.country)) continue

    const label =
      sports.length > 1
        ? `${SPORTS.find((s) => s.value === item.sport)?.label ?? item.sport} / ${item.leagueLabel}`
        : item.leagueLabel

    const group = grouped.get(item.countryLabel) ?? []
    group.push({ label, value: item.value })
    grouped.set(item.countryLabel, group)
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, options]) => ({
      label,
      options: options.sort((a, b) => a.label.localeCompare(b.label)),
    }))
}

// ─── Market state helpers ─────────────────────────────────────────────────────

export function getAvailableMarketGroups(sports: string[]): MarketGroup[] {
  if (sports.length === 0) return []
  const allGroups = sports.flatMap((s) => ODDSHARVESTER_MARKETS[s] ?? [])
  const merged = new Map<string, MarketGroup>()
  for (const g of allGroups) {
    const existing = merged.get(g.category)
    if (existing) {
      const seen = new Set(existing.options.map((o) => o.value))
      for (const o of g.options) {
        if (!seen.has(o.value)) {
          existing.options.push(o)
          seen.add(o.value)
        }
      }
    } else {
      merged.set(g.category, { ...g, options: [...g.options] })
    }
  }
  return Array.from(merged.values())
}

export function getAvailablePeriods(sports: string[]) {
  if (sports.length === 0) return SPORT_PERIODS.football ?? []
  const merged = new Map<string, { label: string; value: string }>()
  for (const s of sports) {
    for (const p of SPORT_PERIODS[s] ?? []) merged.set(p.value, p)
  }
  return Array.from(merged.values())
}

export function getPeriodCycleOptions(sports: string[]) {
  return ['all', ...getAvailablePeriods(sports).map((p) => p.value)]
}
