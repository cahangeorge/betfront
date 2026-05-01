import * as React from 'react'
import { useMutation, useQuery } from '#/lib/query'
import {
  Button,
  Card,
  Input,
  Label,
  MultiSelect,
  Select,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
} from '#/components/ui'
import { JobsList } from '#/components/JobsList'
import { OddsHarvesterFilters } from '#/components/OddsHarvesterFilters'
import {
  getLeagueCatalog,
  runUpcoming,
  runHistoric,
  type LeagueCatalogItem,
} from '#/lib/client-actions/scraper'
import {
  getEspnSchedule,
  getEspnMatchsheet,
  getEspnLineup,
  getMatchHistoryGames,
  getFBrefSchedule,
  getFBrefTeamStats,
  getFBrefShotEvents,
  getFBrefPlayerSeasonStats,
  getFBrefTeamMatchStats,
  getFBrefTeamSeasonStats,
  getFBrefPlayerMatchStats,
  getFBrefLineup,
  getFBrefEvents,
  getClubEloRatings,
  getClubEloTeamHistory,
  getSofascoreSchedule,
  getSofascoreStandings,
  getUnderstatSchedule,
  getUnderstatTeamMatchStats,
  getUnderstatPlayerSeasonStats,
  getUnderstatShotEvents,
  getUnderstatPlayerMatchStats,
  getWhoScoredSchedule,
  getWhoScoredSeasonStages,
  getWhoScoredMissingPlayers,
  getWhoScoredEvents,
  getSoFIFALeagues,
  getSoFIFAVersions,
  getSoFIFATeams,
  getSoFIFAPlayers,
  getSoFIFATeamRatings,
  getSoFIFAPlayerRatings,
  getSofascoreLeagues,
  getSofascoreSeasons,
  getUnderstatLeagues,
  getUnderstatSeasons,
  getWhoScoredLeagues,
  getWhoScoredSeasons,
  getFBrefLeagues,
  getFBrefSeasons,
  getSoccerDataCatalog,
  getTeamMapping,
  setTeamMapping,
  type SoccerDataCatalog,
} from '#/lib/client-actions/soccerdata'
import { saveScrapedDataset } from '#/lib/client-actions/datasets'
import {
  currentSeasonStartYear,
  seasonOptions,
  formatDateInput,
  getCountryOptions,
  getLeagueGroupedOptions,
  type MarketPeriod,
  type MarketEntry,
} from '#/lib/oddsHarvesterShared'

// ─── Constants ────────────────────────────────────────────────────────────────

type DataSource = 'oddsharvester' | 'soccerdata'

const SOCCERDATA_SOURCES = [
  { label: '📺 ESPN — Schedules & Lineups', value: 'espn' },
  { label: '📊 FBref — Stats & Schedules', value: 'fbref' },
  { label: '🏆 Sofascore — Standings & Schedules', value: 'sofascore' },
  { label: '📈 Understat — xG & Advanced Stats', value: 'understat' },
  { label: '⚽ WhoScored — Events & Match Data', value: 'whoscored' },
  { label: '🎮 SoFIFA — FIFA Ratings & Teams', value: 'sofifa' },
  { label: '📜 MatchHistory — Historical Results + Odds', value: 'matchhistory' },
  { label: '📉 ClubElo — ELO Ratings', value: 'clubelo' },
]

const SOCCERDATA_OPERATIONS: Record<string, { label: string; value: string }[]> = {
  espn: [
    { label: 'Schedule', value: 'schedule' },
    { label: 'Matchsheet', value: 'matchsheet' },
    { label: 'Lineup', value: 'lineup' },
  ],
  fbref: [
    { label: 'Schedule', value: 'schedule' },
    { label: 'Team Season Stats', value: 'team_stats' },
    { label: 'Team Match Stats', value: 'team_match_stats' },
    { label: 'Team Season Aggregate', value: 'team_season_stats' },
    { label: 'Player Season Stats', value: 'player_season_stats' },
    { label: 'Player Match Stats', value: 'player_match_stats' },
    { label: 'Shot Events', value: 'shot_events' },
    { label: 'Lineup', value: 'lineup' },
    { label: 'Events', value: 'events' },
    { label: 'Leagues Catalog', value: 'leagues' },
    { label: 'Seasons Catalog', value: 'seasons' },
  ],
  sofascore: [
    { label: 'Schedule', value: 'schedule' },
    { label: 'Standings', value: 'standings' },
    { label: 'Leagues Catalog', value: 'leagues' },
    { label: 'Seasons Catalog', value: 'seasons' },
  ],
  understat: [
    { label: 'Schedule', value: 'schedule' },
    { label: 'Team Match Stats', value: 'team_match_stats' },
    { label: 'Player Season Stats', value: 'player_season_stats' },
    { label: 'Player Match Stats', value: 'player_match_stats' },
    { label: 'Shot Events', value: 'shot_events' },
    { label: 'Leagues Catalog', value: 'leagues' },
    { label: 'Seasons Catalog', value: 'seasons' },
  ],
  whoscored: [
    { label: 'Schedule', value: 'schedule' },
    { label: 'Season Stages', value: 'season_stages' },
    { label: 'Missing Players', value: 'missing_players' },
    { label: 'Events', value: 'events' },
    { label: 'Leagues Catalog', value: 'leagues' },
    { label: 'Seasons Catalog', value: 'seasons' },
  ],
  sofifa: [
    { label: 'Teams', value: 'teams' },
    { label: 'Players', value: 'players' },
    { label: 'Team Ratings', value: 'team_ratings' },
    { label: 'Player Ratings', value: 'player_ratings' },
    { label: 'Leagues Catalog', value: 'leagues' },
    { label: 'FIFA Versions', value: 'versions' },
  ],
  matchhistory: [{ label: 'Games', value: 'games' }],
  clubelo: [
    { label: 'Ratings by Date', value: 'ratings' },
    { label: 'Team History', value: 'team_history' },
  ],
}

const FBREF_STAT_TYPES = [
  { label: 'Standard', value: 'standard' },
  { label: 'Shooting', value: 'shooting' },
  { label: 'Passing', value: 'passing' },
  { label: 'Possession', value: 'possession' },
  { label: 'Defense', value: 'defense' },
  { label: 'Keeper', value: 'keeper' },
  { label: 'Misc', value: 'misc' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchHistorySeasonOptions(count = 9) {
  const y = currentSeasonStartYear() - 1
  return Array.from({ length: count }, (_, i) => {
    const start = y - (count - 1 - i)
    return {
      label: `${start}/${start + 1}`,
      value: `${String(start).slice(-2)}${String(start + 1).slice(-2)}`,
    }
  })
}

function espnSeasonOptions(count = 9) {
  const y = currentSeasonStartYear()
  return Array.from({ length: count }, (_, i) => {
    const year = y - (count - 1 - i)
    return { label: String(year), value: String(year) }
  })
}

function formatDateParam(date: string) {
  return date.replaceAll('-', '')
}

function getSoccerdataLeagueOptions(catalog: SoccerDataCatalog, source: string) {
  switch (source) {
    case 'espn':
      return catalog.espnLeagues
    case 'fbref':
      return catalog.fbrefLeagues
    case 'sofascore':
      return catalog.sofascoreLeagues
    case 'understat':
      return catalog.understatLeagues
    case 'whoscored':
      return catalog.whoscoredLeagues
    case 'sofifa':
      return catalog.sofifaLeagues
    case 'matchhistory':
      return catalog.matchHistoryLeagues
    case 'clubelo':
      return catalog.clubEloLeagues
    default:
      return []
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataHubPanel() {
  const [source, setSource] = React.useState<DataSource>('oddsharvester')

  return (
    <div className="space-y-6">
      {/* Source Selector */}
      <Card className="space-y-4">
        <div className="space-y-2">
          <Label>Data Source</Label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSource('oddsharvester')}
              className={
                source === 'oddsharvester'
                  ? 'flex-1 rounded-xl border-2 border-[var(--lagoon-deep)] bg-[var(--lagoon)]/10 p-4 text-left transition'
                  : 'flex-1 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--lagoon)]/40'
              }
            >
              <p className="text-sm font-bold text-[var(--sea-ink)]">🕷 OddsHarvester</p>
              <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                Scrape live &amp; historical odds from OddsPortal. Football, tennis, basketball, rugby, hockey, baseball.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setSource('soccerdata')}
              className={
                source === 'soccerdata'
                  ? 'flex-1 rounded-xl border-2 border-[var(--lagoon-deep)] bg-[var(--lagoon)]/10 p-4 text-left transition'
                  : 'flex-1 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--lagoon)]/40'
              }
            >
              <p className="text-sm font-bold text-[var(--sea-ink)]">⚽ SoccerData</p>
              <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                ESPN, FBref, Sofascore, Understat, MatchHistory & ClubElo. Schedules, stats, standings, xG.
              </p>
            </button>
          </div>
        </div>
      </Card>

      {source === 'oddsharvester' ? (
        <>
          <OddsHarvesterForm />
          <JobsList />
        </>
      ) : <SoccerDataForm />}
    </div>
  )
}

// ─── OddsHarvester Form ───────────────────────────────────────────────────────

function OddsHarvesterForm() {
  const catalogQ = useQuery({
    queryKey: ['league-catalog'],
    queryFn: () => getLeagueCatalog(),
    staleTime: 10 * 60_000,
  })
  const catalog = catalogQ.data ?? []

  const [mode, setMode] = React.useState<'upcoming' | 'historic'>('upcoming')
  const [sports, setSports] = React.useState<string[]>(['football'])
  const [countries, setCountries] = React.useState<string[]>([])
  const [leagues, setLeagues] = React.useState<string[]>([])
  const [marketEntries, setMarketEntries] = React.useState<Array<{ value: string; period: MarketPeriod }>>([
    { value: '1x2', period: 'all' },
  ])
  const [dateStart, setDateStart] = React.useState(formatDateInput(new Date()))
  const [dateEnd, setDateEnd] = React.useState(formatDateInput(new Date()))
  const [season, setSeason] = React.useState(`${currentSeasonStartYear()}-${currentSeasonStartYear() + 1}`)
  const [headless, setHeadless] = React.useState(true)
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  // Advanced options
  const [concurrency, setConcurrency] = React.useState(3)
  const [requestDelay, setRequestDelay] = React.useState(1)
  const [bookiesFilter, setBookiesFilter] = React.useState<'all' | 'classic' | 'crypto'>('all')
  const [oddsFormat, setOddsFormat] = React.useState('Decimal Odds')
  const [oddsHistory, setOddsHistory] = React.useState(false)
  const [proxyUrl, setProxyUrl] = React.useState('')
  const [previewOnly, setPreviewOnly] = React.useState(false)
  const [targetBookmaker, setTargetBookmaker] = React.useState('')
  const [matchLinks, setMatchLinks] = React.useState('')
  const [outputFormat, setOutputFormat] = React.useState<'json' | 'csv'>('json')

  const [results, setResults] = React.useState<Array<{ sport: string; league: string; jobId: number }>>([])
  const [error, setError] = React.useState<string | null>(null)

  const countryOptions = getCountryOptions(sports, catalog)
  const leagueGroups = getLeagueGroupedOptions(sports, countries, catalog)

  const scrapeMut = useMutation({
    mutationFn: async () => {
      setError(null)
      setResults([])
      const jobs: Array<{ sport: string; league: string; jobId: number }> = []

      for (const sport of sports) {
        const sportLeagues = leagues
          .filter((v) => v.startsWith(`${sport}:`))
          .map((v) => v.slice(sport.length + 1))

        const leagueStr = sportLeagues.length > 0 ? sportLeagues.join(',') : undefined

        // Build period-grouped calls: markets with period='all' go without explicit period
        // (server auto-runs extra periods for football); specific periods get explicit calls
        const allPeriodMkts = marketEntries.filter((e) => e.period === 'all').map((e) => e.value)
        const specificMap = new Map<string, string[]>()
        for (const e of marketEntries.filter((e) => e.period !== 'all')) {
          const arr = specificMap.get(e.period) ?? []
          arr.push(e.value)
          specificMap.set(e.period, arr)
        }
        type PeriodCall = { markets: string | undefined; period: string | undefined }
        const periodCalls: PeriodCall[] = []
        if (allPeriodMkts.length > 0) {
          periodCalls.push({ markets: allPeriodMkts.join(','), period: undefined })
        }
        for (const [per, perMkts] of specificMap) {
          periodCalls.push({ markets: perMkts.join(','), period: per })
        }
        if (periodCalls.length === 0) {
          periodCalls.push({ markets: undefined, period: undefined })
        }

        for (const call of periodCalls) {
          if (mode === 'upcoming') {
            const dates = getDateRange(dateStart, dateEnd)
            for (const d of dates.length > 0 ? dates : [undefined]) {
              const res = await runUpcoming({
                data: {
                  sport,
                  markets: call.markets,
                  league: leagueStr,
                  date: d ? formatDateParam(d) : undefined,
                  headless,
                  concurrency,
                  requestDelay,
                  previewOnly,
                  bookiesFilter,
                  oddsFormat,
                  oddsHistory,
                  period: call.period,
                  proxyUrl: proxyUrl || undefined,
                  targetBookmaker: targetBookmaker || undefined,
                  matchLinks: matchLinks ? matchLinks.split('\n').map((l) => l.trim()).filter(Boolean) : undefined,
                  outputFormat,
                },
              })
              jobs.push({ sport, league: leagueStr ?? 'all', jobId: res.jobId })
            }
          } else {
            const res = await runHistoric({
              data: {
                sport,
                season: season.replace('-', ''),
                markets: call.markets,
                league: leagueStr,
                headless,
                concurrency,
                requestDelay,
                previewOnly,
                bookiesFilter,
                oddsFormat,
                oddsHistory,
                period: call.period,
                proxyUrl: proxyUrl || undefined,
                targetBookmaker: targetBookmaker || undefined,
                matchLinks: matchLinks ? matchLinks.split('\n').map((l) => l.trim()).filter(Boolean) : undefined,
                outputFormat,
              },
            })
            jobs.push({ sport, league: leagueStr ?? 'all', jobId: res.jobId })
          }
        }
      }

      return jobs
    },
    onSuccess: (jobs) => setResults(jobs),
    onError: (err) => setError(err instanceof Error ? err.message : 'Scrape failed'),
  })

  return (
    <Card className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--sea-ink)]">🕷 OddsHarvester</h2>
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'upcoming' | 'historic')}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="historic">Historic</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <OddsHarvesterFilters
        sports={sports}
        onSportsChange={setSports}
        countries={countries}
        onCountriesChange={setCountries}
        countryOptions={countryOptions}
        leagues={leagues}
        onLeaguesChange={setLeagues}
        leagueOptionGroups={leagueGroups}
        marketEntries={marketEntries}
        onMarketEntriesChange={setMarketEntries}
      />

      {/* Time Period */}
      {mode === 'upcoming' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Start Date</Label>
            <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>End Date</Label>
            <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <Label>Season</Label>
          <Select
            value={season}
            onValueChange={setSeason}
            placeholder="Select season"
            options={seasonOptions()}
          />
        </div>
      )}

      {/* Options */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-[var(--sea-ink)]">
          <input
            type="checkbox"
            checked={headless}
            onChange={(e) => setHeadless(e.target.checked)}
            className="accent-[var(--lagoon-deep)]"
          />
          Headless mode
        </label>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[var(--lagoon-deep)] transition hover:text-[var(--lagoon-deep)]/80"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          Advanced Options
        </button>
      </div>

      {/* Advanced Options (collapsible) */}
      {showAdvanced && (
        <div className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--sand)] p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Concurrency</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label>Request Delay (s)</Label>
              <Input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={requestDelay}
                onChange={(e) => setRequestDelay(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label>Bookies Filter</Label>
              <Select
                value={bookiesFilter}
                onValueChange={(v) => setBookiesFilter(v as 'all' | 'classic' | 'crypto')}
                placeholder="Select filter"
                options={[
                  { label: 'All', value: 'all' },
                  { label: 'Classic only', value: 'classic' },
                  { label: 'Crypto only', value: 'crypto' },
                ]}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Odds Format</Label>
              <Select
                value={oddsFormat}
                onValueChange={setOddsFormat}
                placeholder="Select format"
                options={[
                  { label: 'Decimal', value: 'Decimal Odds' },
                  { label: 'Fractional', value: 'Fractional Odds' },
                  { label: 'American', value: 'American Odds' },
                  { label: 'Hong Kong', value: 'Hong Kong Odds' },
                  { label: 'Malay', value: 'Malay Odds' },
                  { label: 'Indonesian', value: 'Indonesian Odds' },
                ]}
              />
            </div>
            <div className="space-y-1">
              <Label>Target Bookmaker</Label>
              <Input
                type="text"
                placeholder="e.g. bet365"
                value={targetBookmaker}
                onChange={(e) => setTargetBookmaker(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Output Format</Label>
              <Select
                value={outputFormat}
                onValueChange={(v) => setOutputFormat(v as 'json' | 'csv')}
                placeholder="JSON"
                options={[
                  { label: 'JSON', value: 'json' },
                  { label: 'CSV', value: 'csv' },
                ]}
              />
            </div>
            <div className="space-y-1">
              <Label>Proxy URL</Label>
              <Input
                type="text"
                placeholder="socks5://host:port"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-[var(--sea-ink)]">
              <input
                type="checkbox"
                checked={oddsHistory}
                onChange={(e) => setOddsHistory(e.target.checked)}
                className="accent-[var(--lagoon-deep)]"
              />
              Collect odds movement history
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--sea-ink)]">
              <input
                type="checkbox"
                checked={previewOnly}
                onChange={(e) => setPreviewOnly(e.target.checked)}
                className="accent-[var(--lagoon-deep)]"
              />
              Preview only (average odds, faster)
            </label>
          </div>
          <div className="space-y-1">
            <Label>Match Links (one per line)</Label>
            <textarea
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon)] focus:outline-none focus:ring-1 focus:ring-[var(--lagoon)]"
              rows={3}
              placeholder="https://www.oddsportal.com/football/...&#10;https://www.oddsportal.com/football/..."
              value={matchLinks}
              onChange={(e) => setMatchLinks(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Run Button */}
      <Button
        onClick={() => scrapeMut.mutate()}
        disabled={scrapeMut.isPending || sports.length === 0}
      >
        {scrapeMut.isPending ? (
          <>
            <Spinner className="h-4 w-4" /> Scraping…
          </>
        ) : (
          `🕷 Scrape ${mode === 'upcoming' ? 'Upcoming' : 'Historic'}`
        )}
      </Button>

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-700/50 dark:bg-green-900/20 dark:text-green-300">
          <p className="font-semibold mb-2">
            {results.length} job{results.length > 1 ? 's' : ''} started successfully
          </p>
          <ul className="list-disc list-inside space-y-1">
            {results.map((r) => (
              <li key={r.jobId}>
                Job #{r.jobId} — {r.sport} / {r.league}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <a href={`/data?tab=history`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white no-underline transition hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
            >
              📊 View Matches
            </a>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}
    </Card>
  )
}

function getDateRange(start: string, end: string) {
  if (!start || !end) return []
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return []
  const dates: string[] = []
  const cursor = new Date(s)
  while (cursor <= e) {
    dates.push(formatDateInput(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

// ─── SoccerData Form ──────────────────────────────────────────────────────────

function SoccerDataForm() {
  const catalogQ = useQuery({
    queryKey: ['soccerdata-catalog'],
    queryFn: () => getSoccerDataCatalog(),
    staleTime: 10 * 60_000,
  })
  const catalog = catalogQ.data

  const [sdSource, setSdSource] = React.useState('espn')
  const [sdOperation, setSdOperation] = React.useState('schedule')
  const [sdLeagues, setSdLeagues] = React.useState<string[]>([])
  const [sdSeason, setSdSeason] = React.useState(String(currentSeasonStartYear()))
  const [sdDate, setSdDate] = React.useState(formatDateInput(new Date()))
  const [sdStatType, setSdStatType] = React.useState('standard')
  const [sdRefresh, setSdRefresh] = React.useState(false)
  const [sdNoStore, setSdNoStore] = React.useState(false)
  const [sdTeam, setSdTeam] = React.useState('')
  const [sdMatchId, setSdMatchId] = React.useState('')
  const [sdOpponentStats, setSdOpponentStats] = React.useState(false)

  const [results, setResults] = React.useState<unknown>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Local stub: proxyUrl input lives only in OddsHarvesterForm; SoccerDataForm
  // has no proxy input, so we always pass undefined down to the action.
  const proxyUrl = ''

  const leagueOptions = catalog ? getSoccerdataLeagueOptions(catalog, sdSource) : []

  // Reset operation, leagues & season format when source changes
  React.useEffect(() => {
    const ops = SOCCERDATA_OPERATIONS[sdSource]
    if (ops && ops.length > 0) {
      setSdOperation(ops[0].value)
    }
    setSdLeagues([])
    setSdTeam('')
    setSdMatchId('')
    setSdOpponentStats(false)
    // Reset season to correct format for new source
    if (sdSource === 'espn') {
      setSdSeason(String(currentSeasonStartYear()))
    } else if (sdSource === 'matchhistory') {
      const y = currentSeasonStartYear() - 1
      setSdSeason(`${String(y).slice(-2)}${String(y + 1).slice(-2)}`)
    } else if (sdSource !== 'clubelo' && sdSource !== 'sofifa') {
      setSdSeason(`${currentSeasonStartYear()}-${currentSeasonStartYear() + 1}`)
    }
  }, [sdSource])

  const fetchMut = useMutation({
    mutationFn: async () => {
      setError(null)
      setResults(null)

      const allResults: unknown[] = []
      const targetLeagues = sdLeagues.length > 0 ? sdLeagues : leagueOptions.map((l) => l.value)

      for (const league of targetLeagues.slice(0, 5)) {
        // Cap at 5 parallel to avoid overload
        const result = await fetchSoccerDataOperation(
          sdSource,
          sdOperation,
          league,
          sdSeason,
          sdDate,
          sdStatType,
          sdRefresh,
          sdTeam,
          sdMatchId,
          sdOpponentStats,
          proxyUrl || undefined,
          sdNoStore || undefined,
        )
        allResults.push({ league, ...result })

        // Auto-save to SQLite
        const r = result as { rows?: unknown[]; summary?: Record<string, unknown> }
        if (Array.isArray(r.rows) && r.rows.length > 0) {
          const sourceMap: Record<string, string> = {
            espn: 'ESPN', fbref: 'FBref', sofascore: 'Sofascore',
            understat: 'Understat', matchhistory: 'MatchHistory', clubelo: 'ClubElo',
          }
          saveScrapedDataset({
            data: {
              source: sourceMap[sdSource] ?? sdSource,
              operation: sdOperation,
              league,
              season: sdSource !== 'clubelo' ? sdSeason : undefined,
              date: sdSource === 'clubelo' ? sdDate : undefined,
              statType: sdStatType !== 'standard' ? sdStatType : undefined,
              rows: r.rows as Record<string, unknown>[],
              summary: r.summary as Record<string, unknown> | undefined,
            },
          }).catch(() => { /* save failure is non-critical */ })
        }
      }

      return allResults
    },
    onSuccess: (data) => setResults(data),
    onError: (err) => setError(err instanceof Error ? err.message : 'Fetch failed'),
  })

  return (
    <Card className="space-y-5">
      <h2 className="text-lg font-bold text-[var(--sea-ink)]">⚽ SoccerData</h2>

      {/* Source: chip selector */}
      <div className="space-y-1">
        <Label>Provider</Label>
        <div className="flex flex-wrap gap-2">
          {SOCCERDATA_SOURCES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSdSource(s.value)}
              className={
                sdSource === s.value
                  ? 'rounded-full border border-[var(--lagoon-deep)] bg-[var(--lagoon)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--lagoon-deep)]'
                  : 'rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)] transition'
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Operation */}
      {(SOCCERDATA_OPERATIONS[sdSource]?.length ?? 0) > 1 && (
        <div className="space-y-1">
          <Label>Operation</Label>
          <Select
            value={sdOperation}
            onValueChange={setSdOperation}
            placeholder="Select operation"
            options={SOCCERDATA_OPERATIONS[sdSource] ?? []}
          />
        </div>
      )}

      {/* League multi-select */}
      <div className="space-y-1">
        <Label>Leagues</Label>
        {catalogQ.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
            <Spinner /> Loading catalog…
          </div>
        ) : (
          <MultiSelect
            values={sdLeagues}
            onValuesChange={setSdLeagues}
            placeholder="All available leagues"
            options={leagueOptions}
            searchable
            searchPlaceholder="Search leagues..."
            maxVisibleLabels={3}
            testId="sd-leagues"
          />
        )}
      </div>

      {/* Season / Date */}
      {sdSource === 'clubelo' && sdOperation === 'ratings' && (
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={sdDate} onChange={(e) => setSdDate(e.target.value)} />
        </div>
      )}
      {sdSource === 'matchhistory' && (
        <div className="space-y-1">
          <Label>Season</Label>
          <Select
            value={sdSeason}
            onValueChange={setSdSeason}
            placeholder="Select season"
            options={matchHistorySeasonOptions()}
          />
        </div>
      )}
      {sdSource !== 'clubelo' && sdSource !== 'matchhistory' && sdSource !== 'sofifa' && (
        <div className="space-y-1">
          <Label>Season</Label>
          <Select
            value={sdSeason}
            onValueChange={setSdSeason}
            placeholder="Select season"
            options={sdSource === 'espn' ? espnSeasonOptions() : seasonOptions()}
          />
        </div>
      )}

      {/* FBref stat type */}
      {sdSource === 'fbref' && ['team_stats', 'team_match_stats', 'team_season_stats', 'player_season_stats', 'player_match_stats'].includes(sdOperation) && (
        <div className="space-y-1">
          <Label>Stat Type</Label>
          <Select
            value={sdStatType}
            onValueChange={setSdStatType}
            placeholder="Select stat type"
            options={FBREF_STAT_TYPES}
          />
        </div>
      )}

      {/* Team input — FBref team_match_stats, SoFIFA players/player_ratings, ClubElo team_history */}
      {((sdSource === 'fbref' && sdOperation === 'team_match_stats') ||
        (sdSource === 'sofifa' && ['players', 'player_ratings'].includes(sdOperation)) ||
        (sdSource === 'clubelo' && sdOperation === 'team_history')) && (
        <div className="space-y-1">
          <Label>{sdSource === 'clubelo' ? 'Team *' : 'Team (optional filter)'}</Label>
          <Input
            type="text"
            placeholder={sdSource === 'clubelo' ? 'e.g. Barcelona' : 'e.g. Manchester United'}
            value={sdTeam}
            onChange={(e) => setSdTeam(e.target.value)}
          />
        </div>
      )}

      {/* Match ID — for ESPN matchsheet/lineup, FBref shot_events/player_match_stats/lineup/events, Understat shot_events/player_match_stats, WhoScored missing_players/events */}
      {((sdSource === 'espn' && ['matchsheet', 'lineup'].includes(sdOperation)) ||
        (sdSource === 'fbref' && ['shot_events', 'player_match_stats', 'lineup', 'events'].includes(sdOperation)) ||
        (sdSource === 'understat' && ['shot_events', 'player_match_stats'].includes(sdOperation)) ||
        (sdSource === 'whoscored' && ['missing_players', 'events'].includes(sdOperation))) && (
        <div className="space-y-1">
          <Label>Match ID (optional — filter to a single match)</Label>
          <Input
            type="text"
            placeholder="Leave empty for all matches"
            value={sdMatchId}
            onChange={(e) => setSdMatchId(e.target.value)}
          />
        </div>
      )}

      {/* Opponent stats toggle — FBref team_season_stats */}
      {sdSource === 'fbref' && sdOperation === 'team_season_stats' && (
        <label className="flex items-center gap-2 text-sm text-[var(--sea-ink)]">
          <input
            type="checkbox"
            checked={sdOpponentStats}
            onChange={(e) => setSdOpponentStats(e.target.checked)}
            className="accent-[var(--lagoon-deep)]"
          />
          Show opponent stats (against)
        </label>
      )}

      {/* Options */}
      <label className="flex items-center gap-2 text-sm text-[var(--sea-ink)]">
        <input
          type="checkbox"
          checked={sdRefresh}
          onChange={(e) => setSdRefresh(e.target.checked)}
          className="accent-[var(--lagoon-deep)]"
        />
        Force refresh (bypass cache)
      </label>

      <label className="flex items-center gap-2 text-sm text-[var(--sea-ink)]">
        <input
          type="checkbox"
          checked={sdNoStore}
          onChange={(e) => setSdNoStore(e.target.checked)}
          className="accent-[var(--lagoon-deep)]"
        />
        No store (don't save to cache)
      </label>

      {/* Run */}
      <Button
        onClick={() => fetchMut.mutate()}
        disabled={fetchMut.isPending}
      >
        {fetchMut.isPending ? (
          <>
            <Spinner className="h-4 w-4" /> Fetching…
          </>
        ) : (
          '⚽ Fetch Data'
        )}
      </Button>

      {/* Results */}
      {results != null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--sea-ink)]">Results</h3>
            {Array.isArray(results) && (
              <span className="rounded-full bg-[var(--lagoon)]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--lagoon-deep)]">
                {(results as unknown[]).length} league{(results as unknown[]).length !== 1 ? 's' : ''}
                {' · '}
                {(results as Array<{ rows?: unknown[] }>).reduce(
                  (sum, r) => sum + (Array.isArray(r.rows) ? r.rows.length : 0),
                  0,
                )}{' '}
                rows
              </span>
            )}
          </div>
          <div className="max-h-[500px] overflow-auto rounded-lg border border-[var(--line)] bg-[var(--sand)] p-3">
            <SoccerDataResults data={results} />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <TeamMappingSection />
    </Card>
  )
}

// ─── Team Name Mapping ────────────────────────────────────────────────────────

function TeamMappingSection() {
  const [showMapping, setShowMapping] = React.useState(false)
  const [mappings, setMappings] = React.useState<Record<string, string[]>>({})
  const [newStandard, setNewStandard] = React.useState('')
  const [newAliases, setNewAliases] = React.useState('')
  const [status, setStatus] = React.useState<string | null>(null)

  const loadQ = useQuery({
    queryKey: ['team-mapping'],
    queryFn: () => getTeamMapping(),
    enabled: showMapping,
  })

  React.useEffect(() => {
    if (loadQ.data) setMappings(loadQ.data.mappings)
  }, [loadQ.data])

  const saveMut = useMutation({
    mutationFn: async () => {
      await setTeamMapping({ data: { mappings } })
    },
    onSuccess: () => setStatus('Saved!'),
    onError: (e) => setStatus(e instanceof Error ? e.message : 'Save failed'),
  })

  const addEntry = () => {
    if (!newStandard.trim()) return
    const aliases = newAliases.split(',').map((s) => s.trim()).filter(Boolean)
    if (aliases.length === 0) return
    setMappings({ ...mappings, [newStandard.trim()]: [...(mappings[newStandard.trim()] ?? []), ...aliases] })
    setNewStandard('')
    setNewAliases('')
  }

  const removeEntry = (key: string) => {
    const next = { ...mappings }
    delete next[key]
    setMappings(next)
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setShowMapping(!showMapping)}
        className="text-xs font-semibold text-[var(--lagoon-deep)] hover:underline"
      >
        {showMapping ? '▾ Hide Team Name Mappings' : '▸ Team Name Mappings'}
      </button>

      {showMapping && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
          <p className="text-xs text-[var(--sea-ink-soft)]">
            Map alternative team names to a standard name. These are saved to soccerdata's config and applied globally.
          </p>

          {loadQ.isLoading && (
            <div className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
              <Spinner /> Loading…
            </div>
          )}

          {/* Existing mappings */}
          {Object.entries(mappings).length > 0 && (
            <div className="space-y-1">
              {Object.entries(mappings).map(([standard, aliases]) => (
                <div key={standard} className="flex items-center gap-2 rounded border border-[var(--line)] bg-[var(--sand)]/50 px-3 py-1.5 text-xs">
                  <span className="font-semibold text-[var(--sea-ink)]">{standard}</span>
                  <span className="text-[var(--sea-ink-soft)]">←</span>
                  <span className="flex-1 text-[var(--sea-ink-soft)]">{aliases.join(', ')}</span>
                  <button
                    type="button"
                    onClick={() => removeEntry(standard)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new */}
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              value={newStandard}
              onChange={(e) => setNewStandard(e.target.value)}
              placeholder="Standard name (e.g. Arsenal)"
            />
            <Input
              value={newAliases}
              onChange={(e) => setNewAliases(e.target.value)}
              placeholder="Aliases (comma-sep): AFC Arsenal, Ars"
            />
            <Button variant="secondary" onClick={addEntry}>
              + Add
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? 'Saving…' : '💾 Save Mappings'}
            </Button>
            {status && <span className="text-xs text-[var(--sea-ink-soft)]">{status}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

async function fetchSoccerDataOperation(
  source: string,
  operation: string,
  league: string,
  season: string,
  date: string,
  statType: string,
  refresh: boolean,
  team: string,
  matchId: string,
  opponentStats: boolean,
  proxy?: string,
  noStore?: boolean,
): Promise<{ summary?: unknown; rows?: unknown[] }> {
  const px: Record<string, unknown> = {}
  if (proxy) px.proxy = proxy
  if (noStore) px.no_store = true
  switch (source) {
    case 'espn':
      if (operation === 'matchsheet') {
        return getEspnMatchsheet({ data: { league, season, match_id: matchId || undefined, limit: 100, refresh, ...px } })
      }
      if (operation === 'lineup') {
        return getEspnLineup({ data: { league, season, match_id: matchId || undefined, limit: 200, refresh, ...px } })
      }
      return getEspnSchedule({ data: { league, season, limit: 100, refresh, ...px } })
    case 'fbref':
      if (operation === 'team_stats') {
        return getFBrefTeamStats({
          data: { league, season, stat_type: statType as any, limit: 40, refresh, ...px },
        })
      }
      if (operation === 'team_match_stats') {
        return getFBrefTeamMatchStats({
          data: { league, season, stat_type: statType as any, team: team || undefined, refresh, ...px },
        })
      }
      if (operation === 'team_season_stats') {
        return getFBrefTeamSeasonStats({
          data: { league, season, stat_type: statType as any, opponent_stats: opponentStats, limit: 40, refresh, ...px },
        })
      }
      if (operation === 'player_season_stats') {
        return getFBrefPlayerSeasonStats({
          data: { league, season, stat_type: statType as any, refresh, ...px },
        })
      }
      if (operation === 'player_match_stats') {
        return getFBrefPlayerMatchStats({
          data: { league, season, stat_type: statType as any, match_id: matchId || undefined, limit: 200, refresh, ...px },
        })
      }
      if (operation === 'shot_events') {
        return getFBrefShotEvents({
          data: { league, season, game_id: matchId || undefined, limit: 100, refresh, ...px },
        })
      }
      if (operation === 'lineup') {
        return getFBrefLineup({
          data: { league, season, match_id: matchId || undefined, limit: 200, refresh, ...px },
        })
      }
      if (operation === 'events') {
        return getFBrefEvents({
          data: { league, season, match_id: matchId || undefined, limit: 200, refresh, ...px },
        })
      }
      if (operation === 'leagues') {
        return getFBrefLeagues({ data: { league: league || undefined, refresh, ...px } })
      }
      if (operation === 'seasons') {
        return getFBrefSeasons({ data: { league: league || undefined, refresh, ...px } })
      }
      return getFBrefSchedule({ data: { league, season, limit: 100, refresh, ...px } })
    case 'sofascore':
      if (operation === 'standings') {
        return getSofascoreStandings({ data: { league, season, refresh, ...px } })
      }
      if (operation === 'leagues') {
        return getSofascoreLeagues({ data: { league: league || undefined, refresh, ...px } })
      }
      if (operation === 'seasons') {
        return getSofascoreSeasons({ data: { league: league || undefined, refresh, ...px } })
      }
      return getSofascoreSchedule({ data: { league, season, refresh, ...px } })
    case 'understat':
      if (operation === 'team_match_stats') {
        return getUnderstatTeamMatchStats({ data: { league, season, refresh, ...px } })
      }
      if (operation === 'player_season_stats') {
        return getUnderstatPlayerSeasonStats({ data: { league, season, refresh, ...px } })
      }
      if (operation === 'player_match_stats') {
        return getUnderstatPlayerMatchStats({
          data: { league, season, match_id: matchId || undefined, limit: 200, refresh, ...px },
        })
      }
      if (operation === 'shot_events') {
        return getUnderstatShotEvents({
          data: { league, season, match_id: matchId || undefined, limit: 200, refresh, ...px },
        })
      }
      if (operation === 'leagues') {
        return getUnderstatLeagues({ data: { league: league || undefined, refresh, ...px } })
      }
      if (operation === 'seasons') {
        return getUnderstatSeasons({ data: { league: league || undefined, refresh, ...px } })
      }
      return getUnderstatSchedule({ data: { league, season, refresh, ...px } })
    case 'whoscored':
      if (operation === 'season_stages') {
        return getWhoScoredSeasonStages({ data: { league, season, refresh, ...px } })
      }
      if (operation === 'missing_players') {
        return getWhoScoredMissingPlayers({ data: { league, season, match_id: matchId || undefined, refresh, ...px } })
      }
      if (operation === 'events') {
        return getWhoScoredEvents({ data: { league, season, match_id: matchId || undefined, limit: 500, refresh, ...px } })
      }
      if (operation === 'leagues') {
        return getWhoScoredLeagues({ data: { league: league || undefined, refresh, ...px } })
      }
      if (operation === 'seasons') {
        return getWhoScoredSeasons({ data: { league: league || undefined, refresh, ...px } })
      }
      return getWhoScoredSchedule({ data: { league, season, limit: 100, refresh, ...px } })
    case 'sofifa':
      if (operation === 'players') {
        return getSoFIFAPlayers({ data: { league: league || undefined, team: team || undefined, refresh, ...px } })
      }
      if (operation === 'team_ratings') {
        return getSoFIFATeamRatings({ data: { league: league || undefined, refresh, ...px } })
      }
      if (operation === 'player_ratings') {
        return getSoFIFAPlayerRatings({ data: { league: league || undefined, team: team || undefined, refresh, ...px } })
      }
      if (operation === 'leagues') {
        return getSoFIFALeagues({ data: { refresh, ...px } })
      }
      if (operation === 'versions') {
        return getSoFIFAVersions({ data: { refresh, ...px } })
      }
      return getSoFIFATeams({ data: { league: league || undefined, refresh, ...px } })
    case 'matchhistory':
      return getMatchHistoryGames({ data: { league, season, limit: 100, refresh, ...px } })
    case 'clubelo':
      if (operation === 'team_history') {
        return getClubEloTeamHistory({ data: { team: team || league, limit: 50, refresh, ...px } })
      }
      return getClubEloRatings({ data: { league, date, limit: 100, refresh, ...px } })
    default:
      throw new Error(`Unknown source: ${source}`)
  }
}

function SoccerDataResults({ data }: { data: unknown }) {
  if (!data) return null

  if (Array.isArray(data)) {
    return (
      <div className="space-y-4">
        {data.map((item, i) => (
          <div key={i} className="space-y-2">
            {item.league && (
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
                {item.league}
              </p>
            )}
            {item.summary && (
              <p className="text-xs text-[var(--sea-ink-soft)]">
                {typeof item.summary === 'object'
                  ? Object.entries(item.summary as Record<string, unknown>)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')
                  : String(item.summary)}
              </p>
            )}
            {Array.isArray(item.rows) && item.rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[var(--sand)]">
                    <tr className="border-b border-[var(--line)]">
                      {Object.keys(item.rows[0] as Record<string, unknown>).map((col) => (
                        <th
                          key={col}
                          className="px-2 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)] whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(item.rows as Record<string, unknown>[]).slice(0, 100).map((row, j) => (
                      <tr key={j} className={`border-b border-[var(--line)]/50 ${j % 2 === 0 ? '' : 'bg-[var(--surface)]/50'}`}>
                        {Object.values(row).map((v, k) => (
                          <td key={k} className="px-2 py-1 text-[var(--sea-ink)] whitespace-nowrap">
                            {v == null ? '—' : String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(item.rows as unknown[]).length > 100 && (
                  <p className="mt-2 rounded-lg bg-[var(--lagoon)]/10 px-3 py-1.5 text-[10px] font-medium text-[var(--lagoon-deep)]">
                    Showing 100 of {(item.rows as unknown[]).length} rows
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <pre className="whitespace-pre-wrap text-xs text-[var(--sea-ink)]">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}
