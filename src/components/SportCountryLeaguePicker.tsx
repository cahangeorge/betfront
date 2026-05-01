import * as React from 'react'
import { useQuery } from '#/lib/query'
import { OddsHarvesterFilters } from '#/components/OddsHarvesterFilters'
import { getCountryOptions, type MarketEntry } from '#/lib/oddsHarvesterShared'
import { getLeagueCatalog } from '#/lib/client-actions/scraper'
import { getSoccerDataCatalog, type SoccerDataCatalog } from '#/lib/client-actions/soccerdata'
import { getPredictionLeagues } from '#/lib/client-actions/tickets'

export const ALL_LEAGUES_VALUE = '__all__'

// ─── Shared helpers (extracted from PredictionsPanel) ────────────────────────

export function getSoccerdataLeagueOptions(catalog: SoccerDataCatalog) {
  const all = new Map<string, string>()
  for (const l of catalog.espnLeagues) all.set(l.value, l.label)
  for (const l of catalog.matchHistoryLeagues) all.set(l.value, l.label)
  for (const l of catalog.sofascoreLeagues) all.set(l.value, l.label)
  return [...all.entries()]
    .map(([value, label]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// Static OddsHarvester country slug → soccerdata 2-4 letter code mapping.
export const OH_TO_SD: Record<string, string> = {
  england: 'ENG', spain: 'ESP', italy: 'ITA', germany: 'GER', france: 'FRA',
  portugal: 'POR', netherlands: 'NED', scotland: 'SCO', turkey: 'TUR',
  belgium: 'BEL', russia: 'RUS', greece: 'GRE', sweden: 'SWE',
  denmark: 'DEN', norway: 'NOR', poland: 'POL', switzerland: 'SUI',
  austria: 'AUT', croatia: 'CRO', czechia: 'CZE', romania: 'ROU',
  ukraine: 'UKR', serbia: 'SRB', brazil: 'BRA', argentina: 'ARG',
  usa: 'USA', mexico: 'MEX', japan: 'JPN', china: 'CHN',
}

const SD_CODE_TO_OH_COUNTRY: Record<string, string> = Object.fromEntries(
  Object.entries(OH_TO_SD).map(([country, code]) => [code, country]),
)

const UPPERCASE_ABBREVS = new Set([
  'fa', 'atp', 'wta', 'nba', 'nfl', 'mls', 'dfb', 'nhl', 'khl', 'npl', 'wsl', 'u18', 'u21', 'u23',
])

function slugToTitle(s: string) {
  return s
    .split('-')
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase()
      return UPPERCASE_ABBREVS.has(lower) ? lower.toUpperCase() : lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

export function getLocalLeagueQuery(league: string) {
  if (league === ALL_LEAGUES_VALUE) return ''
  return league.replace(/^[A-Z]{2,4}-/, '').trim()
}

// ─── Hook: shared picker state + computed options ───────────────────────────

export type SportCountryLeagueState = {
  sports: string[]
  countries: string[]
  leagues: string[]
  setSports: (v: string[]) => void
  setCountries: (v: string[]) => void
  setLeagues: (v: string[]) => void
  countryOptions: { label: string; value: string }[]
  leagueOptions: { label: string; value: string }[]
  filteredLeagueOptions: { label: string; value: string }[]
  filteredLeagueOptionGroups: { label: string; options: { label: string; value: string }[] }[]
  sdLeagueValues: Set<string>
  isLoading: boolean
  /** First selected league as a plain DB-friendly string (no `ENG-` prefix). Empty when nothing or "All" picked. */
  primaryLeague: string
}

export function useSportCountryLeagues(initial?: {
  sports?: string[]
  countries?: string[]
  leagues?: string[]
}): SportCountryLeagueState {
  const [sports, setSports] = React.useState<string[]>(initial?.sports ?? ['football'])
  const [countries, setCountries] = React.useState<string[]>(initial?.countries ?? [])
  const [leagues, setLeagues] = React.useState<string[]>(initial?.leagues ?? [])

  const catalogQ = useQuery({
    queryKey: ['league-catalog'],
    queryFn: () => getLeagueCatalog(),
    staleTime: 10 * 60_000,
  })
  const sdCatalogQ = useQuery({
    queryKey: ['soccerdata-catalog'],
    queryFn: () => getSoccerDataCatalog(),
    staleTime: 10 * 60_000,
  })
  const localLeagueQ = useQuery({
    queryKey: ['prediction-local-leagues'],
    queryFn: () => getPredictionLeagues(),
    staleTime: 60_000,
  })

  const ohCatalog = catalogQ.data ?? []
  const sdCatalog = sdCatalogQ.data
  const localLeagues = localLeagueQ.data ?? []

  const countryOptions = React.useMemo(
    () => getCountryOptions(sports, ohCatalog),
    [sports, ohCatalog],
  )

  const leagueOptions = React.useMemo(() => {
    const merged = new Map<string, string>()

    if (sdCatalog) {
      for (const option of getSoccerdataLeagueOptions(sdCatalog)) {
        merged.set(option.value, option.label)
      }
    }

    for (const leagueName of localLeagues) {
      merged.set(leagueName, merged.get(leagueName) ?? leagueName)
    }

    for (const item of ohCatalog) {
      if (item.sport !== 'football') continue
      const sdCode = OH_TO_SD[item.country]
      const leagueSlug = item.urlLeague || item.league.replace(new RegExp(`^${item.country}-`), '')
      const leagueTitle = slugToTitle(leagueSlug)
      const value = sdCode ? `${sdCode}-${leagueTitle}` : item.league
      if (!merged.has(value)) merged.set(value, value)
    }

    return [
      { value: ALL_LEAGUES_VALUE, label: 'All leagues (Frontbet DB)' },
      ...[...merged.entries()]
        .map(([value, label]) => ({ label, value }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ]
  }, [localLeagues, ohCatalog, sdCatalog])

  const sdLeagueValues = React.useMemo(
    () => new Set(sdCatalog ? getSoccerdataLeagueOptions(sdCatalog).map((l) => l.value) : []),
    [sdCatalog],
  )

  const filteredLeagueOptions = React.useMemo(() => {
    if (countries.length === 0) return leagueOptions

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

    const matchingNorm = new Set<string>()
    for (const item of ohCatalog) {
      if (item.sport !== 'football' || !countries.includes(item.country)) continue
      if (item.urlLeague) matchingNorm.add(normalize(item.urlLeague))
      const countryPrefix = item.country + '-'
      const keySlug = item.league.startsWith(countryPrefix)
        ? item.league.slice(countryPrefix.length)
        : item.league
      matchingNorm.add(normalize(keySlug))
    }

    return leagueOptions.filter((l) => {
      if (l.value === ALL_LEAGUES_VALUE) return true

      const prefixMatch = l.label.match(/^([A-Z]{2,4})-/)
      if (prefixMatch) {
        const code = prefixMatch[1]
        const ohCountry = SD_CODE_TO_OH_COUNTRY[code]
        if (ohCountry) return countries.includes(ohCountry)
      }

      const stripped = l.label.replace(/^[A-Z]{2,4}-/, '').trim()
      return matchingNorm.has(normalize(stripped)) || matchingNorm.has(normalize(l.label))
    })
  }, [countries, leagueOptions, ohCatalog])

  const countryGroupOptions = React.useMemo(() => {
    if (countries.length === 0) return []
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
    return countries
      .filter((c) => OH_TO_SD[c])
      .map((c) => ({ value: `__country_${c}__`, label: `All ${capitalize(c)} leagues` }))
  }, [countries])

  const filteredLeagueOptionGroups = React.useMemo(() => {
    const allLeaguesOpts = filteredLeagueOptions.filter((l) => l.value === ALL_LEAGUES_VALUE)
    const sdOpts = filteredLeagueOptions.filter(
      (l) => l.value !== ALL_LEAGUES_VALUE && sdLeagueValues.has(l.value),
    )
    const ohOpts = filteredLeagueOptions.filter(
      (l) => l.value !== ALL_LEAGUES_VALUE && !sdLeagueValues.has(l.value),
    )
    return [
      ...(countryGroupOptions.length ? [{ label: 'Select by country', options: countryGroupOptions }] : []),
      ...(allLeaguesOpts.length ? [{ label: 'Featured', options: allLeaguesOpts }] : []),
      ...(sdOpts.length ? [{ label: 'Classic (Soccerdata — history + schedule)', options: sdOpts }] : []),
      ...(ohOpts.length ? [{ label: 'Extended (OddsHarvester — scrape only)', options: ohOpts }] : []),
    ]
  }, [filteredLeagueOptions, sdLeagueValues, countryGroupOptions])

  const primaryLeague = React.useMemo(() => {
    const first = leagues.find((l) => l !== ALL_LEAGUES_VALUE && !l.startsWith('__country_'))
    if (!first) return ''
    return getLocalLeagueQuery(first)
  }, [leagues])

  return {
    sports,
    countries,
    leagues,
    setSports,
    setCountries,
    setLeagues,
    countryOptions,
    leagueOptions,
    filteredLeagueOptions,
    filteredLeagueOptionGroups,
    sdLeagueValues,
    isLoading: catalogQ.isLoading || sdCatalogQ.isLoading || localLeagueQ.isLoading,
    primaryLeague,
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export type SportCountryLeaguePickerProps = {
  state: SportCountryLeagueState
  showSports?: boolean
  showCountries?: boolean
  showLeagues?: boolean
}

export function SportCountryLeaguePicker({
  state,
  showSports = true,
  showCountries = true,
  showLeagues = true,
}: SportCountryLeaguePickerProps) {
  const [marketEntries, setMarketEntries] = React.useState<MarketEntry[]>([])
  return (
    <OddsHarvesterFilters
      sports={state.sports}
      onSportsChange={state.setSports}
      countries={state.countries}
      onCountriesChange={state.setCountries}
      countryOptions={state.countryOptions}
      leagues={state.leagues}
      onLeaguesChange={state.setLeagues}
      leagueOptions={state.filteredLeagueOptions}
      leagueOptionGroups={state.filteredLeagueOptionGroups}
      leagueExclusiveValues={[ALL_LEAGUES_VALUE]}
      marketEntries={marketEntries}
      onMarketEntriesChange={setMarketEntries}
      showSports={showSports}
      showCountries={showCountries}
      showLeagues={showLeagues}
      showMarkets={false}
    />
  )
}
