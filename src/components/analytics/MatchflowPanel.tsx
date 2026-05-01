import * as React from 'react'
import { useMutation } from '#/lib/query'
import {
  Button,
  Card,
  Input,
  Label,
  Select,
} from '#/components/ui'
import { runPenaltyblogOperation } from '#/lib/client-actions/penaltyblog'

// ─── Types ────────────────────────────────────────────────────────────────────

type BridgeResult = { result: unknown; operation: string }

type StepDef = {
  type: string
  // filter
  query?: string
  // select / drop / dropna
  fields?: string
  // rename
  from?: string
  to?: string
  // sort
  by?: string
  descending?: boolean
  // limit / sample_n
  n?: string
  // sample_fraction
  fraction?: string
  // group_summary
  groupBy?: string
  aggregations?: string // JSON
  // opta_filter
  eventTypeIds?: string
  qualifierIds?: string
}

const STEP_TYPES = [
  { label: 'Filter (query expression)', value: 'filter' },
  { label: 'Select columns', value: 'select' },
  { label: 'Drop columns', value: 'drop' },
  { label: 'Drop NA rows', value: 'dropna' },
  { label: 'Rename column', value: 'rename' },
  { label: 'Sort', value: 'sort' },
  { label: 'Limit rows', value: 'limit' },
  { label: 'Distinct', value: 'distinct' },
  { label: 'Sample N', value: 'sample_n' },
  { label: 'Sample Fraction', value: 'sample_fraction' },
  { label: 'Flatten nested', value: 'flatten' },
  { label: 'Group Summary', value: 'group_summary' },
  { label: 'Opta Event Filter', value: 'opta_filter' },
]

const SOURCE_TYPES = [
  { label: 'JSON file', value: 'json' },
  { label: 'JSONL file', value: 'jsonl' },
  { label: 'Inline list', value: 'list' },
  { label: 'Folder (multi-JSON)', value: 'folder' },
  { label: 'Glob pattern', value: 'glob' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stepToPayload(step: StepDef): Record<string, unknown> {
  const s: Record<string, unknown> = { op: step.type }
  switch (step.type) {
    case 'filter':
      s.query = step.query ?? ''
      break
    case 'select':
    case 'drop':
    case 'dropna':
      s.fields = (step.fields ?? '').split(',').map((f) => f.trim()).filter(Boolean)
      break
    case 'rename':
      s.mapping = { [step.from ?? '']: step.to ?? '' }
      break
    case 'sort':
      s.keys = (step.by ?? '').split(',').map((f) => f.trim()).filter(Boolean)
      s.ascending = !(step.descending ?? false)
      break
    case 'limit':
      s.count = parseInt(step.n ?? '100', 10)
      break
    case 'sample_n':
      s.n = parseInt(step.n ?? '100', 10)
      break
    case 'sample_fraction':
      s.p = parseFloat(step.fraction ?? '0.1')
      break
    case 'distinct':
    case 'flatten':
      break
    case 'group_summary':
      s.keys = (step.groupBy ?? '').split(',').map((f) => f.trim()).filter(Boolean)
      try {
        s.aggregations = JSON.parse(step.aggregations ?? '{}')
      } catch {
        s.aggregations = {}
      }
      break
    case 'opta_filter':
      s.event_type_ids = (step.eventTypeIds ?? '').split(',').map((x) => x.trim()).filter(Boolean).map(Number)
      s.qualifier_ids = (step.qualifierIds ?? '').split(',').map((x) => x.trim()).filter(Boolean).map(Number)
      break
  }
  return s
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MatchflowPanel() {
  // Source
  const [sourceType, setSourceType] = React.useState('json')
  const [sourcePath, setSourcePath] = React.useState('')
  const [sourceData, setSourceData] = React.useState('') // for inline list

  // Steps
  const [steps, setSteps] = React.useState<StepDef[]>([])

  // Results
  const [results, setResults] = React.useState<Record<string, unknown>[] | null>(null)
  const [schema, setSchema] = React.useState<Record<string, string> | null>(null)
  const [plan, setPlan] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const buildPipeline = () => {
    const source: Record<string, unknown> = { type: sourceType }
    if (sourceType === 'list') {
      try {
        source.records = JSON.parse(sourceData)
      } catch {
        source.records = []
      }
    } else if (sourceType === 'glob') {
      source.pattern = sourcePath
    } else {
      source.path = sourcePath
    }
    return {
      source,
      steps: steps.map(stepToPayload),
    }
  }

  const executeMut = useMutation({
    mutationFn: async () => {
      setError(null)
      const res = await runPenaltyblogOperation({
        data: {
          operation: 'matchflow_execute',
          payload: { pipeline: buildPipeline() },
        },
      })
      return (res as BridgeResult).result
    },
    onSuccess: (data) => {
      const d = data as { rows?: Record<string, unknown>[] }
      setResults(d.rows ?? (Array.isArray(data) ? data as Record<string, unknown>[] : null))
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  const schemaMut = useMutation({
    mutationFn: async () => {
      setError(null)
      const res = await runPenaltyblogOperation({
        data: {
          operation: 'matchflow_schema',
          payload: { pipeline: buildPipeline() },
        },
      })
      return (res as BridgeResult).result
    },
    onSuccess: (data) => setSchema(data as Record<string, string>),
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  const explainMut = useMutation({
    mutationFn: async () => {
      setError(null)
      const res = await runPenaltyblogOperation({
        data: {
          operation: 'matchflow_explain',
          payload: { pipeline: buildPipeline() },
        },
      })
      return (res as BridgeResult).result
    },
    onSuccess: (data) => {
      const d = data as { plan?: string }
      setPlan(d.plan ?? JSON.stringify(data, null, 2))
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  const addStep = () => setSteps([...steps, { type: 'filter' }])
  const removeStep = (idx: number) => setSteps(steps.filter((_, i) => i !== idx))
  const updateStep = (idx: number, patch: Partial<StepDef>) => {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  const isPending = executeMut.isPending || schemaMut.isPending || explainMut.isPending

  return (
    <Card className="space-y-5">
      <h2 className="text-lg font-bold text-[var(--sea-ink)]">🔀 Matchflow Pipeline</h2>
      <p className="text-xs text-[var(--sea-ink-soft)]">
        Build data transformation pipelines on JSON/JSONL files using Matchflow's lazy evaluation engine.
      </p>

      {/* Source */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--sea-ink)]">Data Source</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Source Type</Label>
            <Select
              value={sourceType}
              onValueChange={setSourceType}
              placeholder="Source type"
              options={SOURCE_TYPES}
            />
          </div>
          {sourceType !== 'list' ? (
            <div className="space-y-1">
              <Label>File / Folder Path</Label>
              <Input
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                placeholder="/path/to/data.json"
              />
            </div>
          ) : (
            <div className="space-y-1 sm:col-span-2">
              <Label>Inline JSON Data (array of objects)</Label>
              <textarea
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-mono text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon)] focus:outline-none focus:ring-1 focus:ring-[var(--lagoon)]"
                rows={4}
                value={sourceData}
                onChange={(e) => setSourceData(e.target.value)}
                placeholder='[{"team": "Arsenal", "goals": 3}, {"team": "Chelsea", "goals": 1}]'
              />
            </div>
          )}
        </div>
      </div>

      {/* Pipeline Steps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--sea-ink)]">
            Transform Steps ({steps.length})
          </h3>
          <Button variant="secondary" onClick={addStep}>
            + Add Step
          </Button>
        </div>

        {steps.map((step, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-[var(--line)] bg-[var(--sand)]/50 p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[var(--lagoon-deep)] w-6">#{idx + 1}</span>
              <div className="flex-1">
                <Select
                  value={step.type}
                  onValueChange={(v) => updateStep(idx, { type: v })}
                  placeholder="Step type"
                  options={STEP_TYPES}
                />
              </div>
              <Button variant="ghost" onClick={() => removeStep(idx)}>
                ✕
              </Button>
            </div>

            {/* Step-specific fields */}
            {step.type === 'filter' && (
              <Input
                value={step.query ?? ''}
                onChange={(e) => updateStep(idx, { query: e.target.value })}
                placeholder="goals > 2 and team == 'Arsenal'"
              />
            )}
            {(step.type === 'select' || step.type === 'drop' || step.type === 'dropna') && (
              <Input
                value={step.fields ?? ''}
                onChange={(e) => updateStep(idx, { fields: e.target.value })}
                placeholder="field1, field2, field3"
              />
            )}
            {step.type === 'rename' && (
              <div className="grid gap-2 grid-cols-2">
                <Input
                  value={step.from ?? ''}
                  onChange={(e) => updateStep(idx, { from: e.target.value })}
                  placeholder="old_name"
                />
                <Input
                  value={step.to ?? ''}
                  onChange={(e) => updateStep(idx, { to: e.target.value })}
                  placeholder="new_name"
                />
              </div>
            )}
            {step.type === 'sort' && (
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  value={step.by ?? ''}
                  onChange={(e) => updateStep(idx, { by: e.target.value })}
                  placeholder="field_name"
                />
                <label className="flex items-center gap-1 text-xs text-[var(--sea-ink)]">
                  <input
                    type="checkbox"
                    checked={step.descending ?? false}
                    onChange={(e) => updateStep(idx, { descending: e.target.checked })}
                    className="accent-[var(--lagoon-deep)]"
                  />
                  Desc
                </label>
              </div>
            )}
            {(step.type === 'limit' || step.type === 'sample_n') && (
              <Input
                type="number"
                value={step.n ?? '100'}
                onChange={(e) => updateStep(idx, { n: e.target.value })}
                placeholder="100"
              />
            )}
            {step.type === 'sample_fraction' && (
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={step.fraction ?? '0.1'}
                onChange={(e) => updateStep(idx, { fraction: e.target.value })}
                placeholder="0.1"
              />
            )}
            {step.type === 'group_summary' && (
              <>
                <Input
                  value={step.groupBy ?? ''}
                  onChange={(e) => updateStep(idx, { groupBy: e.target.value })}
                  placeholder="group_field1, group_field2"
                />
                <textarea
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-mono text-[var(--sea-ink)] focus:border-[var(--lagoon)] focus:outline-none focus:ring-1 focus:ring-[var(--lagoon)]"
                  rows={2}
                  value={step.aggregations ?? ''}
                  onChange={(e) => updateStep(idx, { aggregations: e.target.value })}
                  placeholder='{"goals": "mean", "assists": "sum"}'
                />
              </>
            )}
            {step.type === 'opta_filter' && (
              <div className="space-y-2">
                <Input
                  value={step.eventTypeIds ?? ''}
                  onChange={(e) => updateStep(idx, { eventTypeIds: e.target.value })}
                  placeholder="Event type IDs (comma-sep): 1,2,16"
                />
                <Input
                  value={step.qualifierIds ?? ''}
                  onChange={(e) => updateStep(idx, { qualifierIds: e.target.value })}
                  placeholder="Qualifier IDs (comma-sep): 15,72"
                />
                <p className="text-[10px] text-[var(--sea-ink-soft)]">
                  Filter rows by Opta event type and/or qualifier IDs. See Opta tab for ID reference.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => executeMut.mutate()} disabled={isPending}>
          {executeMut.isPending ? 'Running…' : '▶ Execute Pipeline'}
        </Button>
        <Button variant="secondary" onClick={() => schemaMut.mutate()} disabled={isPending}>
          {schemaMut.isPending ? 'Loading…' : '📋 Infer Schema'}
        </Button>
        <Button variant="secondary" onClick={() => explainMut.mutate()} disabled={isPending}>
          {explainMut.isPending ? 'Loading…' : '🔍 Explain Plan'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Plan */}
      {plan && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--sea-ink)]">Execution Plan</h3>
          <pre className="overflow-auto rounded-lg border border-[var(--line)] bg-[var(--sand)] p-3 text-xs font-mono text-[var(--sea-ink)]">
            {plan}
          </pre>
        </div>
      )}

      {/* Schema */}
      {schema && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--sea-ink)]">Inferred Schema</h3>
          <div className="overflow-auto rounded-lg border border-[var(--line)] bg-[var(--sand)] p-3">
            <dl className="grid gap-1 sm:grid-cols-3">
              {Object.entries(schema).map(([field, type]) => (
                <div key={field} className="flex gap-2 text-xs">
                  <span className="font-semibold text-[var(--lagoon-deep)]">{field}</span>
                  <span className="text-[var(--sea-ink-soft)]">{type}</span>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {/* Results Table */}
      {results != null && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--sea-ink)]">Results</h3>
          <div className="max-h-[500px] overflow-auto rounded-lg border border-[var(--line)] bg-[var(--sand)] p-3">
            <ResultsTable data={results} />
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Results Table ────────────────────────────────────────────────────────────

function ResultsTable({ data }: { data: unknown }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <p className="text-xs text-[var(--sea-ink-soft)]">No data returned.</p>
  }

  const cols = Object.keys(data[0] as Record<string, unknown>)
  return (
    <>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-[var(--sand)]">
          <tr className="border-b border-[var(--line)]">
            {cols.map((c) => (
              <th key={c} className="px-2 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)] whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data as Record<string, unknown>[]).slice(0, 200).map((row, i) => (
            <tr key={i} className={`border-b border-[var(--line)]/50 ${i % 2 === 0 ? '' : 'bg-[var(--surface)]/50'}`}>
              {cols.map((c) => (
                <td key={c} className="px-2 py-1 text-[var(--sea-ink)] whitespace-nowrap">
                  {row[c] == null ? '—' : typeof row[c] === 'number' ? (row[c] as number).toFixed(4) : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 200 && (
        <p className="mt-2 rounded-lg bg-[var(--lagoon)]/10 px-3 py-1.5 text-[10px] font-medium text-[var(--lagoon-deep)]">
          Showing 200 of {data.length} rows
        </p>
      )}
    </>
  )
}
