export const ALL_LEAGUES_VALUE = '__all__'

export const OH_TO_SD: Record<string, string> = {
  england: 'ENG', spain: 'ESP', italy: 'ITA', germany: 'GER', france: 'FRA',
  portugal: 'POR', netherlands: 'NED', scotland: 'SCO', turkey: 'TUR',
  belgium: 'BEL', russia: 'RUS', greece: 'GRE', sweden: 'SWE',
  denmark: 'DEN', norway: 'NOR', poland: 'POL', switzerland: 'SUI',
  austria: 'AUT', croatia: 'CRO', czechia: 'CZE', romania: 'ROU',
  ukraine: 'UKR', serbia: 'SRB', brazil: 'BRA', argentina: 'ARG',
  usa: 'USA', mexico: 'MEX', japan: 'JPN', china: 'CHN',
}

export function getLocalLeagueQuery(league: string) {
  if (league === ALL_LEAGUES_VALUE) return ''
  return league.replace(/^[A-Z]{2,4}-/, '').trim()
}

export function expandCountryLeagueSelections(
  newValues: string[],
  filteredLeagueOptions: { label: string; value: string }[],
) {
  const buckets = newValues.filter((value) => value.startsWith('__country_') && value.endsWith('__'))
  if (buckets.length === 0) {
    return newValues
  }

  const base = newValues.filter((value) => !value.startsWith('__country_'))
  const expanded = [...base]

  for (const bucket of buckets) {
    const country = bucket.slice('__country_'.length, -2)
    const code = OH_TO_SD[country]
    if (!code) continue

    const prefix = `${code}-`
    for (const option of filteredLeagueOptions) {
      if (
        option.value !== ALL_LEAGUES_VALUE &&
        option.value.startsWith(prefix) &&
        !expanded.includes(option.value)
      ) {
        expanded.push(option.value)
      }
    }
  }

  return expanded
}

export function getPrimaryLeagueValue(
  leagues: string[],
  filteredLeagueOptions: { label: string; value: string }[] = [],
) {
  const expanded = expandCountryLeagueSelections(leagues, filteredLeagueOptions)
  const first = expanded.find((value) => value !== ALL_LEAGUES_VALUE && !value.startsWith('__country_'))
  if (!first) return ''
  return getLocalLeagueQuery(first)
}