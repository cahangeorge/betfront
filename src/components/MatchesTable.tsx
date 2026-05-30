import * as React from 'react'
import { useQuery, useQueryClient } from '#/lib/query'
import { ChevronUpIcon, ChevronDownIcon } from '@radix-ui/react-icons'
import { getMatches, deleteMatches, getLeagueCatalog, type LeagueCatalogItem } from '#/lib/client-actions/scraper'
import { Card, Input, Spinner, Badge } from '#/components/ui'
import { cn } from '#/lib/cn'

type OddsEntry = {
  id: number
  market: string
  submarket: string | null
  bookmaker: string
  oddsHome: number | null
  oddsDraw: number | null
  oddsAway: number | null
  oddsOver: number | null
  oddsUnder: number | null
  oddsYes: number | null
  oddsNo: number | null
}

type Match = {
  id: number
  jobId: number
  sport: string
  league: string | null
  homeTeam: string
  awayTeam: string
  matchDate: string | null
  matchUrl: string | null
  homeScore: number | null
  awayScore: number | null
  odds: OddsEntry[]
  job: { command: string; sport: string; league: string | null; markets: string }
}

function getMatchStatus(match: Match): { label: string; tone: string } {
  if (match.job.command === 'historic') {
    return { label: 'played', tone: 'success' }
  }

  if (match.matchDate) {
    const date = new Date(match.matchDate)
    if (!Number.isNaN(date.getTime())) {
      if (date.getTime() > Date.now()) {
        return { label: 'upcoming', tone: 'pending' }
      }

      const hasRealScore =
        match.homeScore != null &&
        match.awayScore != null &&
        !(match.homeScore === 0 && match.awayScore === 0)

      if (hasRealScore) {
        return { label: 'played', tone: 'success' }
      }

      return { label: 'in progress', tone: 'running' }
    }
  }

  return { label: 'upcoming', tone: 'pending' }
}

function formatMatchDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

type SortKey = 'matchDate' | 'sport'
type SortDir = 'asc' | 'desc'

function formatSlugLabel(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getCountryLabel(match: Match, catalog: LeagueCatalogItem[] = []) {
  const normalizedLeague = slugify(match.league ?? '')

  if (match.job.league) {
    const candidates = match.job.league
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    for (const candidate of candidates) {
      const parts = candidate.split('-')
      if (parts.length < 2) continue
      const country = parts[0]
      const leagueSlug = parts.slice(1).join('-')
      if (
        normalizedLeague &&
        (leagueSlug === normalizedLeague ||
          leagueSlug.endsWith(normalizedLeague) ||
          normalizedLeague.endsWith(leagueSlug))
      ) {
        return formatSlugLabel(country)
      }
    }
  }

  const normalizedLeagueName = (match.league ?? '').trim().toLowerCase()
  const catalogMatch = catalog.find((item) => {
    if (item.sport !== match.sport) return false
    return (
      item.leagueLabel.toLowerCase() === normalizedLeagueName ||
      item.league === normalizedLeague ||
      item.urlLeague === normalizedLeague
    )
  })
  if (catalogMatch) {
    return catalogMatch.countryLabel
  }

  if (match.matchUrl) {
    try {
      const pathname = new URL(match.matchUrl).pathname.split('/').filter(Boolean)
      const country = pathname[1]
      if (country && country !== 'h2h') {
        return formatSlugLabel(country)
      }
    } catch {
      // Ignore invalid URLs and fall back to league parsing.
    }
  }

  const league = match.league ?? ''
  if (league.includes('-')) {
    const country = league.split('-')[0]
    if (country) {
      return formatSlugLabel(country)
    }
  }

  return 'Other'
}

type LeagueGroup = {
  league: string
  rows: Match[]
}

type CountryGroup = {
  country: string
  leagues: LeagueGroup[]
}

type JobGroup = {
  jobId: number
  rows: Match[]
  countries: CountryGroup[]
}



export function MatchesTable({
  jobId,
  dateFrom,
  dateTo,
  onDateRangeChange,
}: {
  jobId?: number
  dateFrom?: string
  dateTo?: string
  onDateRangeChange?: (from: string, to: string) => void
}) {
  const [sortKey, setSortKey] = React.useState<SortKey>('matchDate')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')
  const [teamFilter, setTeamFilter] = React.useState('')
  const [expandedRows, setExpandedRows] = React.useState<Set<number>>(new Set())
  const [selectedLeagues, setSelectedLeagues] = React.useState<Set<string>>(new Set())
  const [selectedMatchIds, setSelectedMatchIds] = React.useState<Set<number>>(new Set())
  const [collapsedJobs, setCollapsedJobs] = React.useState<Set<number>>(new Set())
  const [collapsedCountries, setCollapsedCountries] = React.useState<Set<string>>(new Set())
  const [collapsedLeagueGroups, setCollapsedLeagueGroups] = React.useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = React.useState(false)

  const queryClient = useQueryClient()

  const { data: matches = [], isLoading } = useQuery<Match[]>({
    queryKey: ['matches', jobId, dateFrom, dateTo],
    queryFn: () => getMatches({ data: { jobId, dateFrom, dateTo } }),
    staleTime: 30_000,
  })

  const { data: leagueCatalog = [] } = useQuery<LeagueCatalogItem[]>({
    queryKey: ['leagueCatalog'],
    queryFn: () => getLeagueCatalog(),
    staleTime: 10 * 60_000,
  })

  // Auto-expand rows with odds when query key changes (not on arbitrary re-renders)
  const lastAutoExpandKey = React.useRef('')
  React.useEffect(() => {
    const key = `${jobId ?? ''}|${dateFrom ?? ''}|${dateTo ?? ''}`
    if (matches.length > 0 && key !== lastAutoExpandKey.current) {
      lastAutoExpandKey.current = key
      setExpandedRows(new Set(matches.filter((m) => m.odds.length > 0).map((m) => m.id)))
    }
  }, [matches, jobId, dateFrom, dateTo])

  // Build sorted unique league list from loaded data
  const leagues = React.useMemo(() => {
    const s = new Set(matches.map((m) => m.league ?? '—'))
    return Array.from(s).sort()
  }, [matches])

  // Reset league selection when query changes
  React.useEffect(() => {
    setSelectedLeagues(new Set())
    setTeamFilter('')
    setSelectedMatchIds(new Set())
    setExpandedRows(new Set())
    setCollapsedJobs(new Set())
    setCollapsedCountries(new Set())
    setCollapsedLeagueGroups(new Set())
  }, [dateFrom, dateTo, jobId])

  function toggleLeague(lg: string) {
    setSelectedLeagues((prev) => {
      const next = new Set(prev)
      if (next.has(lg)) next.delete(lg)
      else next.add(lg)
      return next
    })
  }

  function handleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('desc')
    }
  }

  function toggleRow(id: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleJobGroup(id: number) {
    setCollapsedJobs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCountryGroup(key: string) {
    setCollapsedCountries((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleLeagueGroup(key: string) {
    setCollapsedLeagueGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── Selection helpers ────────────────────────────────────────────────────
  function toggleMatch(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedMatchIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroupSelection(groupRows: Match[]) {
    const allSelected = groupRows.every((m) => selectedMatchIds.has(m.id))
    setSelectedMatchIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        groupRows.forEach((m) => next.delete(m.id))
      } else {
        groupRows.forEach((m) => next.add(m.id))
      }
      return next
    })
  }

  function toggleAllVisible() {
    const allSelected = displayRows.every((m) => selectedMatchIds.has(m.id))
    if (allSelected) {
      setSelectedMatchIds(new Set())
    } else {
      setSelectedMatchIds(new Set(displayRows.map((m) => m.id)))
    }
  }

  async function handleDeleteSelected() {
    if (selectedMatchIds.size === 0) return
    setIsDeleting(true)
    try {
      await deleteMatches({ data: [...selectedMatchIds] })
      setSelectedMatchIds(new Set())
      await queryClient.invalidateQueries({ queryKey: ['matches'] })
    } finally {
      setIsDeleting(false)
    }
  }

  // Apply league multi-filter, then text filter, then sort — all in plain useMemo
  const displayRows = React.useMemo(() => {
    let rows: Match[] = selectedLeagues.size > 0
      ? matches.filter((m) => selectedLeagues.has(m.league ?? '—'))
      : matches

    if (teamFilter.trim()) {
      const q = teamFilter.trim().toLowerCase()
      rows = rows.filter(
        (m) =>
          m.homeTeam.toLowerCase().includes(q) ||
          m.awayTeam.toLowerCase().includes(q) ||
          (m.league ?? '').toLowerCase().includes(q),
      )
    }

    rows = [...rows].sort((a, b) => {
      const da = a[sortKey] ?? ''
      const db = b[sortKey] ?? ''
      return sortDir === 'desc' ? db.localeCompare(da) : da.localeCompare(db)
    })

    return rows
  }, [matches, selectedLeagues, teamFilter, sortKey, sortDir])

  // Group display rows by jobId (most recent job first)
  const groupedRows = React.useMemo<JobGroup[]>(() => {
    const map = new Map<number, Match[]>()
    for (const row of displayRows) {
      const existing = map.get(row.jobId)
      if (existing) existing.push(row)
      else map.set(row.jobId, [row])
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b - a)
      .map(([jobId, rows]) => {
        const countryMap = new Map<string, Match[]>()
        for (const row of rows) {
          const country = getCountryLabel(row, leagueCatalog)
          const existing = countryMap.get(country)
          if (existing) existing.push(row)
          else countryMap.set(country, [row])
        }

        const countries = Array.from(countryMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([country, countryRows]) => {
            const leagueMap = new Map<string, Match[]>()
            for (const row of countryRows) {
              const league = row.league ?? 'Other'
              const existing = leagueMap.get(league)
              if (existing) existing.push(row)
              else leagueMap.set(league, [row])
            }

            const leagues = Array.from(leagueMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([league, leagueRows]) => ({ league, rows: leagueRows }))

            return { country, leagues }
          })

        return { jobId, rows, countries }
      })
  }, [displayRows, leagueCatalog])

  const totalFiltered = displayRows.length
  const allVisibleSelected = displayRows.length > 0 && displayRows.every((m) => selectedMatchIds.has(m.id))
  const someSelected = selectedMatchIds.size > 0

  return (
    <div className="space-y-3">
      {/* Selection action bar */}
      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/8 px-3 sm:px-4 py-2 text-sm">
          <span className="font-medium text-[var(--sea-ink)]">{selectedMatchIds.size} match{selectedMatchIds.size !== 1 ? 'es' : ''} selected</span>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDeleteSelected}
            className="ml-2 flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
          >
            {isDeleting ? <Spinner className="h-3 w-3" /> : null}
            Delete selected
          </button>
          <button
            type="button"
            onClick={() => setSelectedMatchIds(new Set())}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)] transition"
          >
            Clear selection
          </button>
        </div>
      )}
      {/* Date range row */}
      {!jobId && onDateRangeChange && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
            From
            <input
              type="date"
              value={dateFrom ?? ''}
              onChange={(e) => onDateRangeChange(e.target.value, dateTo ?? e.target.value)}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)]/40"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
            To
            <input
              type="date"
              value={dateTo ?? ''}
              onChange={(e) => onDateRangeChange(dateFrom ?? e.target.value, e.target.value)}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)]/40"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10)
              onDateRangeChange(today, today)
            }}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)] transition"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              const today = new Date()
              const from = new Date(today)
              from.setDate(today.getDate() - 6)
              onDateRangeChange(from.toISOString().slice(0, 10), today.toISOString().slice(0, 10))
            }}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)] transition"
          >
            Last 7 days
          </button>
          <button
            type="button"
            onClick={() => {
              const today = new Date()
              const from = new Date(today)
              from.setDate(today.getDate() - 29)
              onDateRangeChange(from.toISOString().slice(0, 10), today.toISOString().slice(0, 10))
            }}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)] transition"
          >
            Last 30 days
          </button>
        </div>
      )}

      {/* League filter chips — multi-select */}
      {!isLoading && leagues.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedLeagues(new Set())}
            className={
              selectedLeagues.size === 0
                ? 'rounded-full border border-[var(--lagoon-deep)] bg-[var(--lagoon)]/20 px-3 py-1 text-xs font-semibold text-[var(--lagoon-deep)]'
                : 'rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)] transition'
            }
          >
            All ({matches.length})
          </button>
          {leagues.map((lg) => {
            const active = selectedLeagues.has(lg)
            const count = matches.filter((m) => (m.league ?? '—') === lg).length
            return (
              <button
                key={lg}
                type="button"
                onClick={() => toggleLeague(lg)}
                className={
                  active
                    ? 'rounded-full border border-[var(--lagoon-deep)] bg-[var(--lagoon)]/20 px-3 py-1 text-xs font-semibold text-[var(--lagoon-deep)]'
                    : 'rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)] transition'
                }
              >
                {lg} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Search + count row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          placeholder="Filter by team…"
          className="max-w-xs"
        />
        <span className="text-xs text-[var(--sea-ink-soft)]">{totalFiltered} matches</span>
      </div>

      {isLoading ? (
        <Card className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
          <Spinner className="h-4 w-4" /> Loading matches…
        </Card>
      ) : matches.length === 0 ? (
        <Card className="text-center text-sm text-[var(--sea-ink-soft)]">
          No matches scraped yet.
        </Card>
      ) : (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <Card className="min-w-[700px] overflow-hidden p-0 sm:min-w-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--sand)]/50">
                <th className="w-10 p-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allVisibleSelected }}
                    onChange={toggleAllVisible}
                    className="h-4 w-4 cursor-pointer accent-[var(--lagoon-deep)]"
                    title="Select all visible"
                  />
                </th>
                <th className="w-8 p-3" />
                <SortHeader label="Date" colKey="matchDate" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} width={100} />
                <SortHeader label="Sport" colKey="sport" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} width={90} />
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">Match</th>
                <th className="whitespace-nowrap p-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]" style={{ width: 80 }}>Status</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">Markets</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]" style={{ width: 70 }}>URL</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map(({ jobId, rows: groupRows, countries }) => {
                const job = groupRows[0]?.job
                const jobLabel = job
                  ? `${job.command} · ${job.sport}${job.league ? ` · ${job.league}` : ''}`
                  : ''
                const jobCollapsed = collapsedJobs.has(jobId)
                return (
                <React.Fragment key={jobId}>
                  {/* Job group header */}
                  <tr className="bg-[var(--lagoon)]/8 border-b border-[var(--lagoon)]/20">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={groupRows.every((m) => selectedMatchIds.has(m.id))}
                        ref={(el) => {
                          if (el) el.indeterminate =
                            groupRows.some((m) => selectedMatchIds.has(m.id)) &&
                            !groupRows.every((m) => selectedMatchIds.has(m.id))
                        }}
                        onChange={() => toggleGroupSelection(groupRows)}
                        className="h-4 w-4 cursor-pointer accent-[var(--lagoon-deep)]"
                        title={`Select all in job #${jobId}`}
                      />
                    </td>
                    <td
                      colSpan={7}
                      className="py-2 pr-4 text-xs font-bold uppercase tracking-widest text-[var(--lagoon-deep)] cursor-pointer"
                      onClick={() => toggleJobGroup(jobId)}
                    >
                      <span className="mr-2 text-[var(--sea-ink-soft)]">{jobCollapsed ? '▸' : '▾'}</span>
                      <span className="font-mono">#{jobId}</span>
                      {jobLabel && (
                        <span className="ml-2 font-normal normal-case text-[var(--sea-ink-soft)] tracking-normal">{jobLabel}</span>
                      )}
                      <span className="ml-2 font-normal text-[var(--sea-ink-soft)]">
                        ({groupRows.length})
                      </span>
                    </td>
                  </tr>
                  {!jobCollapsed && countries.map(({ country, leagues }) => {
                    const countryKey = `${jobId}:${country}`
                    const countryCollapsed = collapsedCountries.has(countryKey)
                    const countryCount = leagues.reduce((sum, leagueGroup) => sum + leagueGroup.rows.length, 0)
                    return (
                      <React.Fragment key={countryKey}>
                        <tr className="bg-[var(--sand)]/35 border-b border-[var(--line)]/30">
                          <td className="px-3 py-2" />
                          <td colSpan={7} className="py-2 pr-4 text-xs font-semibold text-[var(--sea-ink)] cursor-pointer" onClick={() => toggleCountryGroup(countryKey)}>
                            <span className="mr-2 text-[var(--sea-ink-soft)]">{countryCollapsed ? '▸' : '▾'}</span>
                            <span className="uppercase tracking-wide">{country}</span>
                            <span className="ml-2 text-[var(--sea-ink-soft)]">({countryCount})</span>
                          </td>
                        </tr>
                        {!countryCollapsed && leagues.map(({ league, rows: leagueRows }) => {
                          const leagueKey = `${countryKey}:${league}`
                          const leagueCollapsed = collapsedLeagueGroups.has(leagueKey)
                          return (
                            <React.Fragment key={leagueKey}>
                              <tr className="border-b border-[var(--line)]/20 bg-[var(--surface)]/40">
                                <td className="px-3 py-2" />
                                <td className="px-2 py-2" />
                                <td colSpan={6} className="py-2 pr-4 text-xs text-[var(--sea-ink-soft)] cursor-pointer" onClick={() => toggleLeagueGroup(leagueKey)}>
                                  <span className="mr-2 text-[var(--sea-ink-soft)]">{leagueCollapsed ? '▸' : '▾'}</span>
                                  <span className="font-medium text-[var(--sea-ink)]">{league}</span>
                                  <span className="ml-2">({leagueRows.length})</span>
                                </td>
                              </tr>
                              {!leagueCollapsed && leagueRows.map((match) => (
                    <React.Fragment key={match.id}>
                      <tr
                        className={cn(
                          'border-b border-[var(--line)]/40 hover:bg-[var(--sand)]/30 cursor-pointer transition-colors',
                          selectedMatchIds.has(match.id) && 'bg-[var(--lagoon)]/5',
                        )}
                        onClick={() => toggleRow(match.id)}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedMatchIds.has(match.id)}
                            onChange={(e) => toggleMatch(match.id, e as unknown as React.MouseEvent)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 cursor-pointer accent-[var(--lagoon-deep)]"
                          />
                        </td>
                        <td className="px-2 py-2 text-center text-[var(--sea-ink-soft)]/50 text-xs">
                          {expandedRows.has(match.id) ? '▾' : '▸'}
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums text-[var(--sea-ink)]">{formatMatchDate(match.matchDate)}</td>
                        <td className="px-3 py-2 text-xs capitalize text-[var(--sea-ink-soft)]">{match.sport}</td>
                        <td className="px-3 py-2 text-[var(--sea-ink)]">
                          <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
                            <span className="font-semibold">{match.homeTeam}</span>
                            <span className="text-[var(--sea-ink-soft)]">vs</span>
                            <span className="font-semibold">{match.awayTeam}</span>
                          </span>
                          {getMatchStatus(match).label === 'played' && match.homeScore != null && (
                            <span className="ml-2 rounded-full bg-[var(--lagoon)]/10 px-2 text-xs font-bold tabular-nums text-[var(--lagoon-deep)]">
                              {match.homeScore}–{match.awayScore}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-[var(--sea-ink)]">
                          <Badge status={getMatchStatus(match).tone} label={getMatchStatus(match).label} />
                        </td>
                        <td className="px-3 py-2 text-[var(--sea-ink)]">
                          {match.odds.length === 0 ? (
                            <span className="text-xs text-[var(--sea-ink-soft)]">—</span>
                          ) : (
                            <MarketSummary odds={match.odds} />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {match.matchUrl ? (
                            <a href={match.matchUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--lagoon-deep)] underline-offset-2 hover:underline text-xs whitespace-nowrap">
                              link ↗
                            </a>
                          ) : '—'}
                        </td>
                      </tr>
                      {expandedRows.has(match.id) && match.odds.length > 0 && (
                        <tr className="bg-[var(--foam)]">
                          <td colSpan={8} className="px-6 py-3">
                            <OddsDetail odds={match.odds} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                              ))}
                            </React.Fragment>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>
      )}
    </div>
  )
}

// ─── Sort header helper ───────────────────────────────────────────────────────

// ─── Market summary (compact grouped tags for table row) ──────────────────────

const MARKET_GROUP_LABELS: Record<string, string> = {
  over_under: 'O/U',
  european_handicap: 'EH',
  asian_handicap: 'AH',
  '1x2': '1X2',
  btts: 'BTTS',
  double_chance: 'DC',
  dnb: 'DNB',
}

function MarketSummary({ odds }: { odds: OddsEntry[] }) {
  const uniqueMarkets = [...new Set(odds.map((o) => o.market))]

  // Group markets by prefix
  const groups = new Map<string, string[]>()
  for (const m of uniqueMarkets) {
    const g = marketGroup(m)
    const key = g === '_singles' ? m : g
    const existing = groups.get(key)
    if (existing) existing.push(m)
    else groups.set(key, [m])
  }

  return (
    <div className="flex flex-wrap gap-1">
      {Array.from(groups.entries()).map(([key, markets]) => {
        const label = MARKET_GROUP_LABELS[key] ?? marketLabel(key)
        const count = markets.length
        return (
          <span
            key={key}
            className="rounded-full bg-[var(--lagoon)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--lagoon-deep)]"
            title={markets.map(marketLabel).join(', ')}
          >
            {label}{count > 1 ? ` ×${count}` : ''}
          </span>
        )
      })}
      <span className="text-[10px] text-[var(--sea-ink-soft)] tabular-nums self-center">
        {odds.length}
      </span>
    </div>
  )
}

// ─── Sort header helper ──────────────────────────────────────────────────────

function SortHeader({
  label,
  colKey,
  sortKey,
  sortDir,
  onSort,
  width,
}: {
  label: string
  colKey: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
  width?: number
}) {
  const active = colKey === sortKey
  return (
    <th
      className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)] cursor-pointer select-none hover:text-[var(--sea-ink)]"
      style={width ? { width } : undefined}
      onClick={() => onSort(colKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && sortDir === 'asc' && <ChevronUpIcon className="h-3 w-3" />}
        {active && sortDir === 'desc' && <ChevronDownIcon className="h-3 w-3" />}
      </span>
    </th>
  )
}

// ─── Odds detail expanded row ─────────────────────────────────────────────────

const PERIOD_ORDER = ['FullTime', 'FirstHalf', 'SecondHalf']
const PERIOD_LABELS: Record<string, string> = {
  FullTime: 'Full Time',
  FirstHalf: '1st Half',
  SecondHalf: '2nd Half',
}

// Pretty market label: "over_under_2_5" → "O/U 2.5", "asian_handicap_-1_5" → "AH -1.5"
function marketLabel(m: string): string {
  if (m === '1x2') return '1X2'
  if (m === 'btts') return 'BTTS'
  if (m === 'double_chance') return 'DOUBLE CHANCE'
  if (m === 'dnb') return 'DRAW NO BET'
  if (m.startsWith('over_under_')) {
    const v = m.replace('over_under_', '').replace(/_/g, '.')
    return `O/U ${v}`
  }
  if (m.startsWith('european_handicap_')) {
    const v = m.replace('european_handicap_', '').replace(/_/g, '.')
    return `EH ${v}`
  }
  if (m.startsWith('asian_handicap_')) {
    const v = m.replace('asian_handicap_', '').replace(/_/g, '.')
    return `AH ${v}`
  }
  return m.toUpperCase().replace(/_/g, ' ')
}

// Group similar markets for visual clustering (e.g. all over_under_* together)
function marketGroup(m: string): string {
  if (m.startsWith('over_under_')) return 'over_under'
  if (m.startsWith('european_handicap_')) return 'european_handicap'
  if (m.startsWith('asian_handicap_')) return 'asian_handicap'
  return '_singles'
}

// Average of non-null values
function avg(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v != null)
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}

// Best (highest) of non-null values
function best(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v != null)
  return nums.length > 0 ? Math.max(...nums) : null
}

// Implied probability from decimal odds
function impliedProb(odds: number | null): number | null {
  return odds != null && odds > 0 ? 100 / odds : null
}

// Probability bar color based on value
function probColor(pct: number | null): string {
  if (pct == null) return 'bg-[var(--sand)]'
  if (pct >= 80) return 'bg-emerald-500/80'
  if (pct >= 60) return 'bg-emerald-400/60'
  if (pct >= 40) return 'bg-amber-400/60'
  if (pct >= 20) return 'bg-orange-400/60'
  return 'bg-red-400/50'
}

type OutcomeSlot = { label: string; avg: number | null; best: number | null; prob: number | null }

function getMarketOutcomes(market: string, entries: OddsEntry[]): OutcomeSlot[] {
  const isDoubleChance = market === 'double_chance'
  const isDnb = market === 'dnb'
  const isHandicap = market.includes('handicap')
  const isOU = market.startsWith('over_under_')
  const isBtts = market === 'btts'

  const slots: OutcomeSlot[] = []

  // Home / 1X / team1
  const homeVals = entries.map((e) => e.oddsHome)
  if (homeVals.some((v) => v != null)) {
    const label = isDoubleChance ? '1X' : isDnb || isHandicap ? 'Home' : 'Home'
    const a = avg(homeVals)
    slots.push({ label, avg: a, best: best(homeVals), prob: impliedProb(a) })
  }

  // Draw / 12
  const drawVals = entries.map((e) => e.oddsDraw)
  if (drawVals.some((v) => v != null)) {
    const label = isDoubleChance ? '12' : 'Draw'
    const a = avg(drawVals)
    slots.push({ label, avg: a, best: best(drawVals), prob: impliedProb(a) })
  }

  // Away / X2 / team2
  const awayVals = entries.map((e) => e.oddsAway)
  if (awayVals.some((v) => v != null)) {
    const label = isDoubleChance ? 'X2' : isDnb || isHandicap ? 'Away' : 'Away'
    const a = avg(awayVals)
    slots.push({ label, avg: a, best: best(awayVals), prob: impliedProb(a) })
  }

  // Over
  const overVals = entries.map((e) => e.oddsOver)
  if (overVals.some((v) => v != null)) {
    const label = isOU ? 'Over' : 'Over'
    const a = avg(overVals)
    slots.push({ label, avg: a, best: best(overVals), prob: impliedProb(a) })
  }

  // Under
  const underVals = entries.map((e) => e.oddsUnder)
  if (underVals.some((v) => v != null)) {
    const a = avg(underVals)
    slots.push({ label: 'Under', avg: a, best: best(underVals), prob: impliedProb(a) })
  }

  // Yes
  const yesVals = entries.map((e) => e.oddsYes)
  if (yesVals.some((v) => v != null)) {
    const a = avg(yesVals)
    slots.push({ label: 'Yes', avg: a, best: best(yesVals), prob: impliedProb(a) })
  }

  // No
  const noVals = entries.map((e) => e.oddsNo)
  if (noVals.some((v) => v != null)) {
    const a = avg(noVals)
    slots.push({ label: 'No', avg: a, best: best(noVals), prob: impliedProb(a) })
  }

  return slots
}

function OddsDetail({ odds }: { odds: OddsEntry[] }) {
  const [activePeriod, setActivePeriod] = React.useState<string | null>(null)
  const [expandedMarket, setExpandedMarket] = React.useState<string | null>(null)

  // Group: period → market → entries
  const byPeriod = odds.reduce<Record<string, Record<string, OddsEntry[]>>>((acc, o) => {
    const period = o.submarket ?? 'FullTime'
    ;(acc[period] = acc[period] ?? {})
    ;(acc[period][o.market] = acc[period][o.market] ?? []).push(o)
    return acc
  }, {})

  const periods = Object.keys(byPeriod).sort((a, b) => {
    const ia = PERIOD_ORDER.indexOf(a)
    const ib = PERIOD_ORDER.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  const currentPeriod = activePeriod ?? periods[0] ?? 'FullTime'
  const markets = byPeriod[currentPeriod] ?? {}

  // Group markets visually
  const marketEntries = Object.entries(markets)
  const grouped: { group: string; items: [string, OddsEntry[]][] }[] = []
  let lastGroup = ''
  for (const [m, entries] of marketEntries) {
    const g = marketGroup(m)
    if (g !== lastGroup) {
      grouped.push({ group: g, items: [] })
      lastGroup = g
    }
    grouped[grouped.length - 1].items.push([m, entries])
  }

  return (
    <div className="space-y-3">
      {/* Period tabs */}
      {periods.length > 1 && (
        <div className="flex gap-1">
          {periods.map((p) => (
            <button
              key={p}
              onClick={(e) => { e.stopPropagation(); setActivePeriod(p); setExpandedMarket(null) }}
              className={cn(
                'rounded-md px-3 py-1 text-[11px] font-semibold transition-colors',
                currentPeriod === p
                  ? 'bg-[var(--lagoon)] text-white'
                  : 'bg-[var(--sand)]/60 text-[var(--sea-ink-soft)] hover:bg-[var(--sand)]',
              )}
            >
              {PERIOD_LABELS[p] ?? p}
            </button>
          ))}
        </div>
      )}

      {/* Market cards */}
      {grouped.map(({ group, items }) => {
        // Check if group has any items with outcomes
        const hasData = items.some(([m, entries]) => getMarketOutcomes(m, entries).length > 0)
        if (!hasData) return null
        return (
        <div key={group}>
          {/* Group header for multi-market groups */}
          {items.length > 1 && group !== '_singles' && (
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--sea-ink-soft)]/60">
              {group === 'over_under' ? 'Over / Under' : group === 'european_handicap' ? 'European Handicap' : 'Asian Handicap'}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mb-2">
            {items.map(([market, entries]) => {
              const outcomes = getMarketOutcomes(market, entries)
              if (outcomes.length === 0) return null
              const isExpanded = expandedMarket === `${currentPeriod}:${market}`

              return (
                <div key={market} className="flex flex-col">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedMarket(isExpanded ? null : `${currentPeriod}:${market}`)
                    }}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left transition-all hover:shadow-sm',
                      isExpanded
                        ? 'border-[var(--lagoon)]/40 bg-[var(--lagoon)]/5'
                        : 'border-[var(--line)] bg-[var(--card)]/80 hover:border-[var(--lagoon)]/30',
                    )}
                  >
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--lagoon-deep)]">
                      {marketLabel(market)}
                    </p>
                    <div className="flex gap-3">
                      {outcomes.map((o) => (
                        <div key={o.label} className="flex flex-col items-center gap-0.5 min-w-[44px]">
                          <span className="text-[9px] font-medium text-[var(--sea-ink-soft)]">{o.label}</span>
                          <span className={cn(
                            'rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                            probColor(o.prob),
                            (o.prob ?? 0) >= 60 ? 'text-white' : 'text-[var(--sea-ink)]',
                          )}>
                            {o.prob != null ? `${o.prob.toFixed(1)}%` : '—'}
                          </span>
                          <span className="text-[10px] tabular-nums text-[var(--sea-ink-soft)]">
                            {o.avg != null ? o.avg.toFixed(2) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </button>

                  {/* Expanded bookmaker detail */}
                  {isExpanded && (
                    <div className="mt-1 overflow-x-auto rounded-lg border border-[var(--lagoon)]/20 bg-[var(--card)]">
                      <table className="w-full text-[11px]">
                        <thead className="bg-[var(--sand)]/60">
                          <tr>
                            <th className="px-2 py-1 text-left font-semibold text-[var(--sea-ink-soft)]">Bookmaker</th>
                            {outcomes.map((o) => (
                              <th key={o.label} className="px-2 py-1 text-right font-semibold text-[var(--sea-ink-soft)]">{o.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((e) => (
                            <tr key={e.id} className="border-t border-[var(--line)]/20 hover:bg-[var(--sand)]/30">
                              <td className="px-2 py-1 font-medium text-[var(--sea-ink)]">{e.bookmaker}</td>
                              {outcomes.map((o) => {
                                const val =
                                  o.label === 'Home' || o.label === '1X' ? e.oddsHome :
                                  o.label === 'Draw' || o.label === '12' ? e.oddsDraw :
                                  o.label === 'Away' || o.label === 'X2' ? e.oddsAway :
                                  o.label === 'Over' ? e.oddsOver :
                                  o.label === 'Under' ? e.oddsUnder :
                                  o.label === 'Yes' ? e.oddsYes :
                                  o.label === 'No' ? e.oddsNo : null
                                return (
                                  <td key={o.label} className="px-2 py-1 text-right tabular-nums text-[var(--sea-ink)]">
                                    {val?.toFixed(2) ?? '—'}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                          {/* Best row */}
                          <tr className="border-t border-[var(--lagoon)]/20 bg-[var(--lagoon)]/5 font-semibold">
                            <td className="px-2 py-1 text-[var(--lagoon-deep)]">Best</td>
                            {outcomes.map((o) => (
                              <td key={o.label} className="px-2 py-1 text-right tabular-nums text-[var(--lagoon-deep)]">
                                {o.best?.toFixed(2) ?? '—'}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        )
      })}
    </div>
  )
}
