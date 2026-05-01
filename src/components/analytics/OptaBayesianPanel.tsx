import * as React from 'react'
import { useMutation } from '#/lib/query'
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '#/components/ui'
import { runPenaltyblogOperation } from '#/lib/client-actions/penaltyblog'

// ─── Types ────────────────────────────────────────────────────────────────────

type BridgeResult = { result: unknown; operation: string }

// ═══════════════════════════════════════════════════════════════════════════════
// Opta Mappings Browser
// ═══════════════════════════════════════════════════════════════════════════════

export function OptaMappingsPanel() {
  const [filter, setFilter] = React.useState('')
  const [mappings, setMappings] = React.useState<{
    events?: Record<string, { name: string; description: string }>
    qualifiers?: Record<string, { name: string; description: string }>
  } | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const loadMut = useMutation({
    mutationFn: async () => {
      setError(null)
      const res = await runPenaltyblogOperation({
        data: { operation: 'opta_mappings', payload: {} },
      })
      return (res as BridgeResult).result
    },
    onSuccess: (data) => setMappings(data as typeof mappings),
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  const filterLower = filter.toLowerCase()

  const filteredEvents = mappings?.events
    ? Object.entries(mappings.events).filter(
        ([id, ev]) =>
          !filterLower ||
          id.includes(filterLower) ||
          ev.name.toLowerCase().includes(filterLower) ||
          ev.description.toLowerCase().includes(filterLower),
      )
    : []

  const filteredQualifiers = mappings?.qualifiers
    ? Object.entries(mappings.qualifiers).filter(
        ([id, q]) =>
          !filterLower ||
          id.includes(filterLower) ||
          q.name.toLowerCase().includes(filterLower) ||
          q.description.toLowerCase().includes(filterLower),
      )
    : []

  return (
    <Card className="space-y-5">
      <h2 className="text-lg font-bold text-[var(--sea-ink)]">📖 Opta Event Mappings</h2>
      <p className="text-xs text-[var(--sea-ink-soft)]">
        Browse Opta event type and qualifier definitions used in match event data.
      </p>

      <div className="flex gap-2">
        <Button onClick={() => loadMut.mutate()} disabled={loadMut.isPending}>
          {loadMut.isPending ? <><Spinner className="h-4 w-4" /> Loading…</> : '📖 Load Mappings'}
        </Button>
        {mappings && (
          <Input
            className="max-w-xs"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by ID, name, or description…"
          />
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {mappings && (
        <div className="space-y-5">
          {/* Events */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--sea-ink)]">
              Event Types ({filteredEvents.length})
            </h3>
            <div className="max-h-[400px] overflow-auto rounded-lg border border-[var(--line)] bg-[var(--sand)]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--sand)]">
                  <tr className="border-b border-[var(--line)]">
                    <th className="px-3 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)] w-20">ID</th>
                    <th className="px-3 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)] w-40">Name</th>
                    <th className="px-3 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)]">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map(([id, ev]) => (
                    <tr key={id} className="border-b border-[var(--line)]/50">
                      <td className="px-3 py-1 font-mono text-[var(--lagoon-deep)]">{id}</td>
                      <td className="px-3 py-1 font-semibold text-[var(--sea-ink)]">{ev.name}</td>
                      <td className="px-3 py-1 text-[var(--sea-ink-soft)]">{ev.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Qualifiers */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--sea-ink)]">
              Qualifier Types ({filteredQualifiers.length})
            </h3>
            <div className="max-h-[400px] overflow-auto rounded-lg border border-[var(--line)] bg-[var(--sand)]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--sand)]">
                  <tr className="border-b border-[var(--line)]">
                    <th className="px-3 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)] w-20">ID</th>
                    <th className="px-3 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)] w-40">Name</th>
                    <th className="px-3 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)]">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQualifiers.map(([id, q]) => (
                    <tr key={id} className="border-b border-[var(--line)]/50">
                      <td className="px-3 py-1 font-mono text-[var(--lagoon-deep)]">{id}</td>
                      <td className="px-3 py-1 font-semibold text-[var(--sea-ink)]">{q.name}</td>
                      <td className="px-3 py-1 text-[var(--sea-ink-soft)]">{q.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Bayesian Diagnostics Panel
// ═══════════════════════════════════════════════════════════════════════════════

const PLOT_TYPES = [
  { label: 'Trace Plot', value: 'trace' },
  { label: 'Autocorrelation', value: 'autocorr' },
  { label: 'Posterior Distribution', value: 'posterior' },
  { label: 'Convergence', value: 'convergence' },
  { label: 'Full Diagnostics', value: 'diagnostics' },
]

export function BayesianDiagnosticsPanel() {
  const [section, setSection] = React.useState('diagnostics')

  return (
    <Card className="space-y-5">
      <h2 className="text-lg font-bold text-[var(--sea-ink)]">📊 Bayesian Model Diagnostics</h2>
      <p className="text-xs text-[var(--sea-ink-soft)]">
        Fit a Bayesian goal model (custom MCMC) and inspect convergence diagnostics and parameter posteriors.
      </p>

      <Tabs value={section} onValueChange={setSection}>
        <TabsList>
          <TabsTrigger value="diagnostics">📋 Numerical</TabsTrigger>
          <TabsTrigger value="plots">📈 Visual</TabsTrigger>
        </TabsList>
        <TabsContent value="diagnostics"><NumericalDiagnostics /></TabsContent>
        <TabsContent value="plots"><VisualDiagnostics /></TabsContent>
      </Tabs>
    </Card>
  )
}

// ─── Shared Data Input ────────────────────────────────────────────────────────

function useMatchData() {
  const [goalsHome, setGoalsHome] = React.useState('1, 2, 0, 3, 1, 2, 0, 1, 4, 2')
  const [goalsAway, setGoalsAway] = React.useState('0, 1, 1, 2, 0, 0, 2, 1, 1, 3')
  const [teamsHome, setTeamsHome] = React.useState('Arsenal, Chelsea, Liverpool, Man City, Tottenham, Arsenal, Chelsea, Liverpool, Man City, Tottenham')
  const [teamsAway, setTeamsAway] = React.useState('Chelsea, Liverpool, Man City, Tottenham, Arsenal, Liverpool, Man City, Tottenham, Arsenal, Chelsea')

  const getPayload = () => ({
    goals_home: goalsHome.split(',').map((g) => parseInt(g.trim(), 10)),
    goals_away: goalsAway.split(',').map((g) => parseInt(g.trim(), 10)),
    teams_home: teamsHome.split(',').map((t) => t.trim()),
    teams_away: teamsAway.split(',').map((t) => t.trim()),
  })

  const InputFields = (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--sea-ink)]">Match Data</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Home Goals (comma-separated)</Label>
          <Input value={goalsHome} onChange={(e) => setGoalsHome(e.target.value)} placeholder="1, 2, 0, 3, 1" />
        </div>
        <div className="space-y-1">
          <Label>Away Goals (comma-separated)</Label>
          <Input value={goalsAway} onChange={(e) => setGoalsAway(e.target.value)} placeholder="0, 1, 1, 2, 0" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Home Teams (comma-separated)</Label>
          <Input value={teamsHome} onChange={(e) => setTeamsHome(e.target.value)} placeholder="Arsenal, Chelsea, Liverpool" />
        </div>
        <div className="space-y-1">
          <Label>Away Teams (comma-separated)</Label>
          <Input value={teamsAway} onChange={(e) => setTeamsAway(e.target.value)} placeholder="Chelsea, Liverpool, Man City" />
        </div>
      </div>
    </div>
  )

  return { getPayload, InputFields }
}

// ─── Numerical Diagnostics ────────────────────────────────────────────────────

function NumericalDiagnostics() {
  const { getPayload, InputFields } = useMatchData()
  const [results, setResults] = React.useState<unknown>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: async () => {
      setError(null)
      const res = await runPenaltyblogOperation({
        data: {
          operation: 'bayesian_diagnostics',
          payload: getPayload(),
        },
      })
      return (res as BridgeResult).result
    },
    onSuccess: setResults,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div className="mt-4 space-y-5">
      {InputFields}

      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <><Spinner className="h-4 w-4" /> Fitting model…</> : '📋 Run Diagnostics'}
      </Button>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {results != null && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--sea-ink)]">Diagnostics</h3>
          <div className="max-h-[500px] overflow-auto rounded-lg border border-[var(--line)] bg-[var(--sand)] p-3">
            <DiagnosticsTable data={results} />
          </div>
        </div>
      )}
    </div>
  )
}

function DiagnosticsTable({ data }: { data: unknown }) {
  if (!Array.isArray(data) || data.length === 0) {
    if (typeof data === 'object' && data !== null) {
      // Key-value diagnostics
      return (
        <dl className="grid gap-2 sm:grid-cols-2">
          {Object.entries(data as Record<string, unknown>).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">{k}</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--sea-ink)]">
                {v == null ? '—' : typeof v === 'number' ? v.toFixed(6) : typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      )
    }
    return <pre className="whitespace-pre-wrap text-xs text-[var(--sea-ink)]">{JSON.stringify(data, null, 2)}</pre>
  }

  const cols = Object.keys(data[0] as Record<string, unknown>)
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-[var(--sand)]">
        <tr className="border-b border-[var(--line)]">
          {cols.map((c) => (
            <th key={c} className="px-2 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)] whitespace-nowrap">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(data as Record<string, unknown>[]).map((row, i) => (
          <tr key={i} className={`border-b border-[var(--line)]/50 ${i % 2 === 0 ? '' : 'bg-[var(--surface)]/50'}`}>
            {cols.map((c) => (
              <td key={c} className="px-2 py-1 text-[var(--sea-ink)] whitespace-nowrap">
                {row[c] == null ? '—' : typeof row[c] === 'number' ? (row[c] as number).toFixed(6) : String(row[c])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Visual Diagnostics ───────────────────────────────────────────────────────

function VisualDiagnostics() {
  const { getPayload, InputFields } = useMatchData()
  const [plotType, setPlotType] = React.useState('trace')
  const [html, setHtml] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: async () => {
      setError(null)
      const res = await runPenaltyblogOperation({
        data: {
          operation: 'bayesian_diagnostic_plots',
          payload: {
            ...getPayload(),
            plot_type: plotType,
          },
        },
      })
      return (res as BridgeResult).result
    },
    onSuccess: (data) => {
      const d = data as { html?: string }
      setHtml(d.html ?? null)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div className="mt-4 space-y-5">
      {InputFields}

      <div className="space-y-1">
        <Label>Plot Type</Label>
        <Select value={plotType} onValueChange={setPlotType} placeholder="Plot type" options={PLOT_TYPES} />
      </div>

      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <><Spinner className="h-4 w-4" /> Generating plot…</> : '📈 Generate Plot'}
      </Button>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {html && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--sea-ink)]">
            {PLOT_TYPES.find((p) => p.value === plotType)?.label ?? 'Plot'}
          </h3>
          <div
            className="overflow-auto rounded-lg border border-[var(--line)] bg-white"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  )
}
