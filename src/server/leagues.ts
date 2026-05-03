export function buildLeagueFilter(league: string) {
  const trimmed = league.trim()
  if (!trimmed) return []

  const terms = new Set<string>([trimmed])
  const withoutPrefix = trimmed.replace(/^[A-Z]{2,4}-/, '').trim()
  if (withoutPrefix) terms.add(withoutPrefix)

  const filters: Array<Record<string, any>> = []
  for (const term of terms) {
    filters.push({ league: { equals: term } })
    filters.push({ league: { startsWith: `${term} ` } })
  }

  const slug = trimmed.toLowerCase().replace(/\s+/g, '-')
  filters.push({ job: { league: { equals: slug } } })
  filters.push({ job: { league: { endsWith: `-${slug}` } } })
  if (withoutPrefix !== trimmed) {
    const withoutPrefixSlug = withoutPrefix.toLowerCase().replace(/\s+/g, '-')
    filters.push({ job: { league: { equals: withoutPrefixSlug } } })
    filters.push({ job: { league: { endsWith: `-${withoutPrefixSlug}` } } })
  }
  return filters
}

export function buildLeagueSearchTerms(league: string): string[] {
  const terms = [league.trim()]
  const withoutPrefix = league.trim().replace(/^[A-Z]{2,4}-/, '').trim()
  if (withoutPrefix !== league.trim()) terms.push(withoutPrefix)
  const slug = league.trim().toLowerCase().replace(/\s+/g, '-')
  terms.push(slug)
  return [...new Set(terms)]
}
