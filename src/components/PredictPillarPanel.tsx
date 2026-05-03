import { useEffect, useState } from 'react'
import {
  runSingleModelPrediction,
  runEnsemblePrediction,
  listPredictionRuns,
  getPredictionRun,
  deletePredictionRun,
  getPredictCatalog,
} from '#/lib/client-actions/predictions'
import { useMutation, useQuery, useQueryClient } from '#/lib/query'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '#/components/ui'
import {
  SportCountryLeaguePicker,
  useSportCountryLeagues,
} from '#/components/SportCountryLeaguePicker'
import {
  buildEnsemblePredictionRunInput,
  buildPredictionRunIdInput,
  buildSinglePredictionRunInput,
} from '#/components/predictPillarPanel.helpers'
import { useUrlSearchParam } from '#/lib/router'

const PILLAR_TABS = ['single', 'ensemble', 'runs'] as const

function isPillarTab(value: string): value is (typeof PILLAR_TABS)[number] {
  return PILLAR_TABS.includes(value as (typeof PILLAR_TABS)[number])
}

const TARGET_OPTIONS = [
  { value: 'future', label: 'Future fixtures' },
  { value: 'history', label: 'History backtest' },
]

const MARKET_OPTIONS: { value: string; label: string }[] = [
  { value: '1x2', label: '1×2' },
  { value: 'btts', label: 'BTTS' },
  { value: 'ou_2_5', label: 'Over/Under 2.5' },
]

function MarketsPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (m: string) => {
    if (value.includes(m)) onChange(value.filter((v) => v !== m))
    else onChange([...value, m])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {MARKET_OPTIONS.map((opt) => {
        const active = value.includes(opt.value)
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={
              'rounded-full border px-3 py-1 text-xs font-medium transition ' +
              (active
                ? 'border-[var(--sea-accent)] bg-[var(--sea-accent)]/15 text-[var(--sea-accent)]'
                : 'border-[var(--sea-border)] text-[var(--sea-ink-soft)] hover:border-[var(--sea-accent)]/60')
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

const TRAINING_OPTIONS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'season', label: 'Season window' },
]

const WEIGHTING_OPTIONS = [
  { value: 'uniform', label: 'Uniform' },
  { value: 'brier', label: 'Brier-weighted' },
]

function summary(run: any): string {
  if (!run?.error) return ''
  try {
    const parsed = JSON.parse(run.error)
    if (run.status === 'success') {
      if (parsed.weights) {
        const w = Object.entries(parsed.weights as Record<string, number>)
          .map(([k, v]) => `${k.replace('GoalsModel', '')}=${(v as number).toFixed(2)}`)
          .join(', ')
        return `${parsed.ensembleRows} ensemble rows • weights ${w}`
      }
      return `${parsed.written} rows / ${parsed.targetMatches} matches • train=${parsed.trainingMatches}`
    }
  } catch {
    // not JSON — fall through
  }
  return run.error
}

function SingleTab({ catalog }: { catalog: any }) {
  const qc = useQueryClient()
  const picker = useSportCountryLeagues()
  const [modelKey, setModelKey] = useState('PoissonGoalsModel')
  const [markets, setMarkets] = useState<string[]>(['1x2', 'btts', 'ou_2_5'])
  const [targetMode, setTargetMode] = useState('future')
  const [trainingMode, setTrainingMode] = useState('recent')
  const [trainingLimit, setTrainingLimit] = useState('380')
  const [targetLimit, setTargetLimit] = useState('20')

  const run = useMutation({
    mutationFn: () =>
      runSingleModelPrediction(buildSinglePredictionRunInput({
        modelKey,
        league: picker.primaryLeague,
        markets,
        targetMode,
        trainingMode,
        trainingLimit: Number(trainingLimit),
        targetLimit: Number(targetLimit),
      }) as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prediction-runs'] }),
  })

  const modelOptions = (catalog?.models ?? []).map((m: any) => ({ value: m.key, label: m.label }))

  return (
    <Card>
      <div className="mb-3 text-base font-semibold">Run a single penaltyblog model</div>
      <div className="mb-4 flex items-center gap-2">
        <Badge status="info" label="single model" />
        <span className="text-xs text-[var(--sea-ink-soft)]">
          Fits one penaltyblog model and writes ModelPrediction rows for {targetMode === 'future' ? 'upcoming' : 'historical'} fixtures.
        </span>
      </div>
      <div className="mb-4">
        <SportCountryLeaguePicker state={picker} />
        {picker.leagues.length > 1 && (
          <p className="mt-2 text-[11px] text-[var(--sea-ink-soft)]">
            Pillar 3 trains on one league at a time — only the first selected league (<code>{picker.primaryLeague || '—'}</code>) will be used.
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Model</label>
          <Select value={modelKey} onValueChange={setModelKey} options={modelOptions.length ? modelOptions : [{ value: 'PoissonGoalsModel', label: 'Poisson' }]} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Target</label>
          <Select value={targetMode} onValueChange={setTargetMode} options={TARGET_OPTIONS} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Training</label>
          <Select value={trainingMode} onValueChange={setTrainingMode} options={TRAINING_OPTIONS} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Train limit</label>
          <Input value={trainingLimit} onChange={(e) => setTrainingLimit(e.target.value)} type="number" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Target limit</label>
          <Input value={targetLimit} onChange={(e) => setTargetLimit(e.target.value)} type="number" />
        </div>
        <div className="md:col-span-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Markets</label>
          <MarketsPicker value={markets} onChange={setMarkets} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button variant="primary" onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? 'Starting…' : 'Run prediction'}
        </Button>
        {run.isError && <span className="text-sm text-red-500">{(run.error as Error).message}</span>}
        {run.isSuccess && <span className="text-sm text-emerald-600">Started run #{(run.data as any)?.runId}</span>}
      </div>
    </Card>
  )
}

function EnsembleTab({ catalog }: { catalog: any }) {
  const qc = useQueryClient()
  const picker = useSportCountryLeagues()
  const allModels: string[] = (catalog?.models ?? []).map((m: any) => m.key)
  const [selected, setSelected] = useState<Set<string>>(new Set(allModels.slice(0, 3)))
  const [weighting, setWeighting] = useState('uniform')
  const [targetMode, setTargetMode] = useState('future')
  const [markets, setMarkets] = useState<string[]>(['1x2', 'btts', 'ou_2_5'])
  const [targetLimit, setTargetLimit] = useState('20')

  const run = useMutation({
    mutationFn: () =>
      runEnsemblePrediction(buildEnsemblePredictionRunInput({
        modelKeys: [...selected],
        league: picker.primaryLeague,
        weighting,
        targetMode,
        markets,
        targetLimit: Number(targetLimit),
      }) as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prediction-runs'] }),
  })

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    if (allModels.length === 0 || selected.size > 0) return
    setSelected(new Set(allModels.slice(0, 3)))
  }, [allModels, selected.size])

  return (
    <Card>
      <div className="mb-3 text-base font-semibold">Run an ensemble of models</div>
      <div className="mb-4 flex items-center gap-2">
        <Badge status="info" label="ensemble" />
        <span className="text-xs text-[var(--sea-ink-soft)]">
          Runs each selected model and combines outputs into EnsemblePrediction rows.
        </span>
      </div>
      <div className="mb-4">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Models (≥2)</label>
        <div className="flex flex-wrap gap-2">
          {(catalog?.models ?? []).map((m: any) => {
            const isOn = selected.has(m.key)
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => toggle(m.key)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  isOn
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-[var(--sea-line)] bg-transparent text-[var(--sea-ink)]'
                }`}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mb-4">
        <SportCountryLeaguePicker state={picker} />
        {picker.leagues.length > 1 && (
          <p className="mt-2 text-[11px] text-[var(--sea-ink-soft)]">
            Pillar 3 trains on one league at a time — only the first selected league (<code>{picker.primaryLeague || '—'}</code>) will be used.
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Target</label>
          <Select value={targetMode} onValueChange={setTargetMode} options={TARGET_OPTIONS} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Weighting</label>
          <Select value={weighting} onValueChange={setWeighting} options={WEIGHTING_OPTIONS} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Target limit</label>
          <Input value={targetLimit} onChange={(e) => setTargetLimit(e.target.value)} type="number" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Markets</label>
          <MarketsPicker value={markets} onChange={setMarkets} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="primary"
          onClick={() => run.mutate()}
          disabled={run.isPending || selected.size < 2}
        >
          {run.isPending ? 'Starting…' : `Run ensemble (${selected.size})`}
        </Button>
        {run.isError && <span className="text-sm text-red-500">{(run.error as Error).message}</span>}
        {run.isSuccess && <span className="text-sm text-emerald-600">Started run #{(run.data as any)?.runId}</span>}
      </div>
    </Card>
  )
}

function RunDetail({ runId, onClose }: { runId: number; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['prediction-run', runId],
    queryFn: () => getPredictionRun(buildPredictionRunIdInput(runId) as any),
  })

  const data = detail.data as any
  if (detail.isLoading) return <div className="p-4 text-sm text-[var(--sea-ink-soft)]">Loading…</div>
  if (detail.isError) return <div className="p-4 text-sm text-red-500">{(detail.error as Error).message}</div>
  if (!data) return null

  const ensembleRows = data.ensemblePredictions ?? []
  const modelRows = data.modelPredictions ?? []
  const useEnsemble = ensembleRows.length > 0
  const rows = useEnsemble ? ensembleRows : modelRows

  // Group by match for display
  const byMatch = new Map<number, { match: any; outcomes: Array<{ market: string; outcome: string; probability: number; modelKey?: string }> }>()
  for (const r of rows) {
    const existing = byMatch.get(r.matchId) ?? { match: r.match, outcomes: [] }
    existing.outcomes.push(r)
    byMatch.set(r.matchId, existing)
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-base font-semibold">
          Run #{data.run.id} • {data.run.source}
          {data.run.modelKey ? ` (${data.run.modelKey})` : ''}
        </div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="mb-3 text-sm text-[var(--sea-ink-soft)]">
        {summary(data.run)} • {byMatch.size} matches • {rows.length} predictions
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-[var(--sea-ink-soft)]">
            <tr>
              <th className="py-2 pr-3">Match</th>
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Market</th>
              <th className="py-2 pr-3">Outcome</th>
              <th className="py-2 pr-3">Probability</th>
            </tr>
          </thead>
          <tbody>
            {[...byMatch.values()].slice(0, 200).flatMap((entry) =>
              entry.outcomes.map((o, i) => (
                <tr key={`${entry.match.id}-${o.market}-${o.outcome}-${i}`} className="border-t border-[var(--sea-line)]">
                  <td className="py-2 pr-3">{i === 0 ? `${entry.match.homeTeam} vs ${entry.match.awayTeam}` : ''}</td>
                  <td className="py-2 pr-3">{i === 0 ? entry.match.matchDate ?? '—' : ''}</td>
                  <td className="py-2 pr-3">{o.market}</td>
                  <td className="py-2 pr-3">{o.outcome}</td>
                  <td className="py-2 pr-3 font-mono">{(o.probability * 100).toFixed(1)}%</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function RunsTab() {
  const qc = useQueryClient()
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const runs = useQuery({
    queryKey: ['prediction-runs'],
    queryFn: () => listPredictionRuns(),
    refetchInterval: (q: any) => document.hidden ? false : 4000,
  })

  const del = useMutation({
    mutationFn: (runId: number) => deletePredictionRun(buildPredictionRunIdInput(runId) as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prediction-runs'] }),
  })

  const list = (runs.data as any[]) ?? []

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 text-base font-semibold">Prediction runs</div>
        {list.length === 0 ? (
          <EmptyState
            title="No runs yet"
            description="Trigger a single model or ensemble run from the tabs above."
          />
        ) : (
          <div className="space-y-2">
            {list.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-[var(--sea-line)] bg-[var(--sea-surface)] px-3 py-2"
              >
                <div className="flex flex-1 items-center gap-3">
                  <Badge
                    status={
                      r.status === 'success'
                        ? 'success'
                        : r.status === 'failed'
                          ? 'danger'
                          : r.status === 'running'
                            ? 'info'
                            : 'neutral'
                    }
                    label={r.status}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      #{r.id} • {r.source}
                      {r.modelKey ? ` • ${r.modelKey}` : ''} • {r.league ?? '—'}
                    </div>
                    <div className="text-xs text-[var(--sea-ink-soft)]">{summary(r)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => setSelectedRunId(r.id)}>
                    View
                  </Button>
                  <Button variant="danger" onClick={() => del.mutate(r.id)} disabled={del.isPending}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {selectedRunId != null && (
        <RunDetail runId={selectedRunId} onClose={() => setSelectedRunId(null)} />
      )}
    </div>
  )
}

export default function PredictPillarPanel() {
  const catalogQuery = useQuery({
    queryKey: ['predict-catalog'],
    queryFn: () => getPredictCatalog(),
  })
  const catalog = catalogQuery.data as any
  const [tabParam, setTabParam] = useUrlSearchParam('pillarTab', 'single')
  const tab = isPillarTab(tabParam) ? tabParam : 'single'

  return (
    <Tabs value={tab} onValueChange={setTabParam}>
      <TabsList>
        <TabsTrigger value="single">🎯 Single Model</TabsTrigger>
        <TabsTrigger value="ensemble">🧬 Ensemble</TabsTrigger>
        <TabsTrigger value="runs">📋 Runs</TabsTrigger>
      </TabsList>
      <TabsContent value="single">
        <SingleTab catalog={catalog} />
      </TabsContent>
      <TabsContent value="ensemble">
        <EnsembleTab catalog={catalog} />
      </TabsContent>
      <TabsContent value="runs">
        <RunsTab />
      </TabsContent>
    </Tabs>
  )
}
