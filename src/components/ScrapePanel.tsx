import * as React from 'react'

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '#/components/ui'
import { JobsList } from '#/components/JobsList'
import { useMutation, useQuery, useQueryClient } from '#/lib/query'
import {
  getHistorySources,
  getLeagueCatalog,
  runHistoryScrape,
  runUpcoming,
} from '#/lib/client-actions/scraper'

// ─── Future tab (OddsHarvester upcoming) ──────────────────────────────────

function FutureTab() {
  const qc = useQueryClient()
  const [sport, setSport] = React.useState('football')
  const [league, setLeague] = React.useState('')
  const [date, setDate] = React.useState('')
  const [markets, setMarkets] = React.useState('1x2,btts,over_under_2_5')

  const { data: catalog } = useQuery({
    queryKey: ['league-catalog'],
    queryFn: () => getLeagueCatalog(),
    staleTime: 60 * 60 * 1000,
  })

  const sportOptions = React.useMemo(() => {
    const sports = new Set((catalog ?? []).map((c) => c.sport))
    return Array.from(sports).map((s) => ({ value: s, label: s }))
  }, [catalog])

  const leagueOptions = React.useMemo(() => {
    return (catalog ?? [])
      .filter((c) => c.sport === sport)
      .map((c) => ({ value: c.league, label: `${c.countryLabel} · ${c.leagueLabel}` }))
  }, [catalog, sport])

  const run = useMutation({
    mutationFn: () =>
      runUpcoming({
        data: {
          sport,
          league: league && league !== '__any__' ? league : undefined,
          date: date || undefined,
          markets: markets || undefined,
        } as any,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--sea-ink)]">
              📅 Future scrape (OddsHarvester)
            </h3>
            <p className="text-sm text-[var(--sea-ink-soft)]">
              Pulls upcoming fixtures + bookmaker odds. Match data feeds the prediction & ticket
              pillars.
            </p>
          </div>
          <Badge status="info" label="OddsHarvester" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
              Sport
            </label>
            <Select
              value={sport}
              onValueChange={(v) => {
                setSport(v)
                setLeague('')
              }}
              options={sportOptions.length ? sportOptions : [{ value: 'football', label: 'football' }]}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
              League (optional)
            </label>
            <Select
              value={league}
              onValueChange={(v) => setLeague(v)}
              options={[{ value: '__any__', label: 'Any' }, ...leagueOptions]}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
              Date YYYYMMDD (optional)
            </label>
            <Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="20260501" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
              Markets
            </label>
            <Input value={markets} onChange={(e) => setMarkets(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={() => run.mutate()}
            disabled={run.isPending || !sport}
          >
            {run.isPending ? <Spinner className="mr-2" /> : null}
            Run upcoming scrape
          </Button>
          <span className="text-xs text-[var(--sea-ink-soft)]">
            For full historic + advanced filters, use the <a className="underline" href="/data">Data Hub</a>.
          </span>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-[var(--sea-ink)]">OddsHarvester jobs</h3>
        <JobsList source="OddsHarvester" />
      </Card>
    </div>
  )
}

// ─── History tab (soccerdata wrapped as ScrapeJob) ────────────────────────

function HistoryTab() {
  const qc = useQueryClient()
  const [source, setSource] = React.useState<string>('FBref')
  const [league, setLeague] = React.useState('ENG-Premier League')
  const [season, setSeason] = React.useState('2425')
  const [filterSource, setFilterSource] = React.useState<string>('') // '' = all history sources

  const { data: sources } = useQuery({
    queryKey: ['history-sources'],
    queryFn: () => getHistorySources(),
    staleTime: 60 * 60 * 1000,
  })

  const sourceOptions = (sources ?? []).map((s) => ({ value: s.value, label: s.label }))

  const run = useMutation({
    mutationFn: () =>
      runHistoryScrape({
        data: { source: source as any, league, season, sport: 'football' },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (e: any) => {
      // surfaces in the cell below via run.error
      console.error('[history scrape]', e)
    },
  })

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--sea-ink)]">
              📜 History scrape (soccerdata)
            </h3>
            <p className="text-sm text-[var(--sea-ink-soft)]">
              Pulls historical schedules + xG / stats from FBref, ESPN, Sofascore, MatchHistory or
              Understat. Results land in the same Match table used by predictions.
            </p>
          </div>
          <Badge status="info" label="soccerdata" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
              Source
            </label>
            <Select
              value={source}
              onValueChange={(v) => setSource(v)}
              options={sourceOptions.length ? sourceOptions : [{ value: 'FBref', label: 'FBref' }]}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
              League
            </label>
            <Input
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              placeholder="ENG-Premier League"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
              Season
            </label>
            <Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2425" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={() => run.mutate()}
            disabled={run.isPending || !source || !league || !season}
          >
            {run.isPending ? <Spinner className="mr-2" /> : null}
            Run history scrape
          </Button>
          {run.error ? (
            <span className="text-xs text-red-600">{(run.error as Error).message}</span>
          ) : null}
        </div>

        <div className="mt-3 text-xs text-[var(--sea-ink-soft)]">
          Tip: FBref schedules carry xG which is written to <code>MatchStat</code> for downstream
          ensemble models. Standard league IDs follow the soccerdata convention (e.g.{' '}
          <code>ENG-Premier League</code>, <code>ITA-Serie A</code>).
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--sea-ink)]">History jobs</h3>
          <div className="w-48">
            <Select
              value={filterSource || '__all__'}
              onValueChange={(v) => setFilterSource(v === '__all__' ? '' : v)}
              options={[{ value: '__all__', label: 'All history sources' }, ...sourceOptions]}
            />
          </div>
        </div>
        {filterSource ? (
          <JobsList source={filterSource} />
        ) : (
          // Show all non-OddsHarvester jobs by stacking each source's list
          <div className="space-y-3">
            {(sources ?? []).map((s) => (
              <div key={s.value}>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                  {s.label}
                </div>
                <JobsList source={s.value} />
              </div>
            ))}
            {!sources?.length ? (
              <EmptyState
                title="No history sources loaded"
                description="The bridge to soccerdata has not been initialised yet."
              />
            ) : null}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Root ────────────────────────────────────────────────────────────────

export default function ScrapePanel() {
  const [tab, setTab] = React.useState('future')

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList scrollable>
        <TabsTrigger value="future">📅 Future</TabsTrigger>
        <TabsTrigger value="history">📜 History</TabsTrigger>
      </TabsList>

      <div className="mt-4">
        <TabsContent value="future">
          <FutureTab />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </div>
    </Tabs>
  )
}
