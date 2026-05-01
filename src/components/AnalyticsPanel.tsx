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
import { MatchflowPanel } from '#/components/analytics/MatchflowPanel'
import { PitchVizPanel } from '#/components/analytics/PitchVizPanel'
import { OptaMappingsPanel, BayesianDiagnosticsPanel } from '#/components/analytics/OptaBayesianPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

type BridgeResult = { result: unknown; operation: string }

// ─── Utilities ────────────────────────────────────────────────────────────────

function ResultsView({ data }: { data: unknown }) {
  if (data == null) return null

  // Array of objects → table
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    const cols = Object.keys(data[0] as Record<string, unknown>)
    return (
      <div className="overflow-x-auto">
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
      </div>
    )
  }

  // Plain object → key/value
  if (typeof data === 'object' && !Array.isArray(data)) {
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

function ResultsContainer({ label, data, error }: { label: string; data: unknown; error: string | null }) {
  return (
    <>
      {data != null && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--sea-ink)]">{label}</h3>
          <div className="max-h-[500px] overflow-auto rounded-lg border border-[var(--line)] bg-[var(--sand)] p-3">
            <ResultsView data={data} />
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AnalyticsPanel() {
  const [section, setSection] = React.useState('betting')

  return (
    <Card className="space-y-5">
      <h2 className="text-lg font-bold text-[var(--sea-ink)]">📐 Analytics Toolkit</h2>

      <Tabs value={section} onValueChange={setSection}>
        <TabsList>
          <TabsTrigger value="betting">💰 Betting</TabsTrigger>
          <TabsTrigger value="ratings">⭐ Ratings</TabsTrigger>
          <TabsTrigger value="backtest">📈 Backtest</TabsTrigger>
          <TabsTrigger value="fpl">⚽ FPL</TabsTrigger>
          <TabsTrigger value="matchflow">🔀 Matchflow</TabsTrigger>
          <TabsTrigger value="pitch">⚽ Pitch</TabsTrigger>
          <TabsTrigger value="opta">📖 Opta</TabsTrigger>
          <TabsTrigger value="bayesian">📊 Bayesian</TabsTrigger>
        </TabsList>

        <TabsContent value="betting"><BettingSection /></TabsContent>
        <TabsContent value="ratings"><RatingsSection /></TabsContent>
        <TabsContent value="backtest"><BacktestSection /></TabsContent>
        <TabsContent value="fpl"><FPLSection /></TabsContent>
        <TabsContent value="matchflow"><MatchflowPanel /></TabsContent>
        <TabsContent value="pitch"><PitchVizPanel /></TabsContent>
        <TabsContent value="opta"><OptaMappingsPanel /></TabsContent>
        <TabsContent value="bayesian"><BayesianDiagnosticsPanel /></TabsContent>
      </Tabs>
    </Card>
  )
}

// ─── Betting Section ──────────────────────────────────────────────────────────

function BettingSection() {
  const [tool, setTool] = React.useState('implied')

  return (
    <div className="mt-4 space-y-5">
      <div className="space-y-1">
        <Label>Tool</Label>
        <Select
          value={tool}
          onValueChange={setTool}
          placeholder="Select tool"
          options={[
            { label: 'Implied Probabilities', value: 'implied' },
            { label: 'Kelly Criterion', value: 'kelly' },
            { label: 'Multiple Kelly', value: 'multi_kelly' },
            { label: 'Value Bet Finder', value: 'value' },
            { label: 'Arbitrage Finder', value: 'arbitrage' },
            { label: 'Arbitrage Hedge', value: 'hedge' },
            { label: 'Odds Converter', value: 'convert' },
          ]}
        />
      </div>

      {tool === 'implied' && <ImpliedTool />}
      {tool === 'kelly' && <KellyTool />}
      {tool === 'multi_kelly' && <MultiKellyTool />}
      {tool === 'value' && <ValueBetTool />}
      {tool === 'arbitrage' && <ArbitrageTool />}
      {tool === 'hedge' && <HedgeTool />}
      {tool === 'convert' && <ConvertOddsTool />}
    </div>
  )
}

function ImpliedTool() {
  const [odds, setOdds] = React.useState('2.10, 3.40, 3.50')
  const [method, setMethod] = React.useState('multiplicative')
  const [oddsFormat, setOddsFormat] = React.useState('decimal')
  const [names, setNames] = React.useState('Home, Draw, Away')
  const [results, setResults] = React.useState<unknown>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: async () => {
      setError(null)
      const res = await runPenaltyblogOperation({
        data: {
          operation: 'calculate_implied',
          payload: {
            odds: odds.split(',').map((o) => parseFloat(o.trim())),
            method,
            odds_format: oddsFormat,
            market_names: names ? names.split(',').map((n) => n.trim()) : undefined,
          },
        },
      })
      return (res as BridgeResult).result
    },
    onSuccess: setResults,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Odds (comma-separated)</Label>
          <Input value={odds} onChange={(e) => setOdds(e.target.value)} placeholder="2.10, 3.40, 3.50" />
        </div>
        <div className="space-y-1">
          <Label>Market Names (optional)</Label>
          <Input value={names} onChange={(e) => setNames(e.target.value)} placeholder="Home, Draw, Away" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Method</Label>
          <Select value={method} onValueChange={setMethod} placeholder="Method" options={[
            { label: 'Multiplicative', value: 'multiplicative' },
            { label: 'Additive', value: 'additive' },
            { label: 'Power', value: 'power' },
            { label: 'Shin', value: 'shin' },
            { label: 'Differential Margin', value: 'differential_margin' },
            { label: 'Or/c', value: 'or_c' },
            { label: 'Weighted', value: 'wpo' },
          ]} />
        </div>
        <div className="space-y-1">
          <Label>Odds Format</Label>
          <Select value={oddsFormat} onValueChange={setOddsFormat} placeholder="Format" options={[
            { label: 'Decimal', value: 'decimal' },
            { label: 'American', value: 'american' },
            { label: 'Fractional', value: 'fractional' },
          ]} />
        </div>
      </div>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <><Spinner className="h-4 w-4" /> Calculating…</> : 'Calculate Implied Probabilities'}
      </Button>
      <ResultsContainer label="Implied Probabilities" data={results} error={error} />
    </div>
  )
}

function KellyTool() {
  const [decimalOdds, setDecimalOdds] = React.useState('2.50')
  const [trueProb, setTrueProb] = React.useState('0.45')
  const [fraction, setFraction] = React.useState('1.0')
  const [results, setResults] = React.useState<unknown>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: async () => {
      setError(null)
      const res = await runPenaltyblogOperation({
        data: {
          operation: 'kelly_criterion',
          payload: {
            decimal_odds: parseFloat(decimalOdds),
            true_prob: parseFloat(trueProb),
            fraction: parseFloat(fraction),
          },
        },
      })
      return (res as BridgeResult).result
    },
    onSuccess: setResults,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Decimal Odds</Label>
          <Input type="number" step="0.01" value={decimalOdds} onChange={(e) => setDecimalOdds(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>True Probability</Label>
          <Input type="number" step="0.01" min="0" max="1" value={trueProb} onChange={(e) => setTrueProb(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Kelly Fraction</Label>
          <Input type="number" step="0.1" min="0" max="1" value={fraction} onChange={(e) => setFraction(e.target.value)} />
        </div>
      </div>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <><Spinner className="h-4 w-4" /> Calculating…</> : 'Calculate Kelly Stake'}
      </Button>
      <ResultsContainer label="Kelly Criterion" data={results} error={error} />
    </div>
  )
}

function MultiKellyTool() {
  const [decimalOdds, setDecimalOdds] = React.useState('2.50, 3.10, 1.80')
  const [trueProbs, setTrueProbs] = React.useState('0.45, 0.30, 0.60')
  const [fraction, setFraction] = React.useState('1.0')
  const [maxStake, setMaxStake] = React.useState('1.0')
  const [method, setMethod] = React.useState('simultaneous')
  const [results, setResults] = React.useState<unknown>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: async () => {
      setError(null)
      const res = await runPenaltyblogOperation({
        data: {
          operation: 'multiple_kelly_criterion',
          payload: {
            decimal_odds: decimalOdds.split(',').map((o) => parseFloat(o.trim())),
            true_probs: trueProbs.split(',').map((p) => parseFloat(p.trim())),
            fraction: parseFloat(fraction),
            max_total_stake: parseFloat(maxStake),
            method,
          },
        },
      })
      return (res as BridgeResult).result
    },
    onSuccess: setResults,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Decimal Odds (comma-separated)</Label>
          <Input value={decimalOdds} onChange={(e) => setDecimalOdds(e.target.value)} placeholder="2.50, 3.10, 1.80" />
        </div>
        <div className="space-y-1">
          <Label>True Probabilities (comma-separated)</Label>
          <Input value={trueProbs} onChange={(e) => setTrueProbs(e.target.value)} placeholder="0.45, 0.30, 0.60" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Kelly Fraction</Label>
          <Input type="number" step="0.1" min="0" max="1" value={fraction} onChange={(e) => setFraction(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Max Total Stake</Label>
          <Input type="number" step="0.1" min="0" value={maxStake} onChange={(e) => setMaxStake(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Method</Label>
          <Select value={method} onValueChange={setMethod} placeholder="Method" options={[
            { label: 'Simultaneous', value: 'simultaneous' },
            { label: 'Sequential', value: 'sequential' },
          ]} />
        </div>
      </div>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <><Spinner className="h-4 w-4" /> Calculating…</> : 'Calculate Multiple Kelly'}
      </Button>
      <ResultsContainer label="Multiple Kelly Criterion" data={results} error={error} />
    </div>
  )
}

function ValueBetTool() {
  const [bookmakerOdds, setBookmakerOdds] = React.useState('2.10, 3.40, 3.50')
  const [estimatedProb, setEstimatedProb] = React.useState('0.50, 0.28, 0.22')
  const [kellyFraction, setKellyFraction] = React.useState('0.25')
  const [minEdge, setMinEdge] = React.useState('0.0')
  const [results, setResults] = React.useState<unknown>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: async () => {
      setError(null)
      const res = await runPenaltyblogOperation({
        data: {
          operation: 'identify_value_bet',
          payload: {
            bookmaker_odds: bookmakerOdds.split(',').map((o) => parseFloat(o.trim())),
            estimated_probability: estimatedProb.split(',').map((p) => parseFloat(p.trim())),
            kelly_fraction: parseFloat(kellyFraction),
            min_edge_threshold: parseFloat(minEdge),
          },
        },
      })
      return (res as BridgeResult).result
    },
    onSuccess: setResults,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Bookmaker Odds (comma-separated)</Label>
          <Input value={bookmakerOdds} onChange={(e) => setBookmakerOdds(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Estimated Probabilities (comma-separated)</Label>
          <Input value={estimatedProb} onChange={(e) => setEstimatedProb(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Kelly Fraction</Label>
          <Input type="number" step="0.05" min="0" max="1" value={kellyFraction} onChange={(e) => setKellyFraction(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Min Edge Threshold</Label>
          <Input type="number" step="0.01" min="0" value={minEdge} onChange={(e) => setMinEdge(e.target.value)} />
        </div>
      </div>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <><Spinner className="h-4 w-4" /> Scanning…</> : 'Find Value Bets'}
      </Button>
      <ResultsContainer label="Value Bets" data={results} error={error} />
    </div>
  )
}

function ArbitrageTool() {
  const [oddsInput, setOddsInput] = React.useState('1.90, 4.00, 4.50\n2.10, 3.40, 3.50\n1.95, 3.80, 3.80')
  const [labels, setLabels] = React.useState('Home, Draw, Away')
  const [results, setResults] = React.useState<unknown>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: async () => {
      setError(null)
      const bookmakerOddsList = oddsInput
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(',').map((o) => parseFloat(o.trim())))
      const res = await runPenaltyblogOperation({
        data: {
          operation: 'find_arbitrage_opportunities',
          payload: {
            bookmaker_odds_list: bookmakerOddsList,
            outcome_labels: labels ? labels.split(',').map((l) => l.trim()) : undefined,
          },
        },
      })
      return (res as BridgeResult).result
    },
    onSuccess: setResults,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Bookmaker Odds (one bookmaker per line, comma-separated outcomes)</Label>
        <textarea
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon)] focus:outline-none focus:ring-1 focus:ring-[var(--lagoon)]"
          rows={4}
          value={oddsInput}
          onChange={(e) => setOddsInput(e.target.value)}
          placeholder={'1.90, 4.00, 4.50\n2.10, 3.40, 3.50'}
        />
      </div>
      <div className="space-y-1">
        <Label>Outcome Labels (optional)</Label>
        <Input value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="Home, Draw, Away" />
      </div>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <><Spinner className="h-4 w-4" /> Scanning…</> : 'Find Arbitrage'}
      </Button>
      <ResultsContainer label="Arbitrage Opportunities" data={results} error={error} />
    </div>
  )
}

function HedgeTool() {
  const [existingStakes, setExistingStakes] = React.useState('100')
  const [existingOdds, setExistingOdds] = React.useState('2.50')
  const [hedgeOdds, setHedgeOdds] = React.useState('1.80')
  const [targetProfit, setTargetProfit] = React.useState('')
  const [hedgeAll, setHedgeAll] = React.useState(true)
  const [allowLay, setAllowLay] = React.useState(false)
  const [results, setResults] = React.useState<unknown>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: async () => {
      setError(null)
      const res = await runPenaltyblogOperation({
        data: {
          operation: 'arbitrage_hedge',
          payload: {
            existing_stakes: existingStakes.split(',').map((s) => parseFloat(s.trim())),
            existing_odds: existingOdds.split(',').map((o) => parseFloat(o.trim())),
            hedge_odds: hedgeOdds.split(',').map((o) => parseFloat(o.trim())),
            target_profit: targetProfit ? parseFloat(targetProfit) : undefined,
            hedge_all: hedgeAll,
            allow_lay: allowLay,
          },
        },
      })
      return (res as BridgeResult).result
    },
    onSuccess: setResults,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Existing Stakes (comma-sep)</Label>
          <Input value={existingStakes} onChange={(e) => setExistingStakes(e.target.value)} placeholder="100" />
        </div>
        <div className="space-y-1">
          <Label>Existing Odds (comma-sep)</Label>
          <Input value={existingOdds} onChange={(e) => setExistingOdds(e.target.value)} placeholder="2.50" />
        </div>
        <div className="space-y-1">
          <Label>Hedge Odds (comma-sep)</Label>
          <Input value={hedgeOdds} onChange={(e) => setHedgeOdds(e.target.value)} placeholder="1.80" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Target Profit (optional)</Label>
          <Input type="number" step="1" value={targetProfit} onChange={(e) => setTargetProfit(e.target.value)} placeholder="Auto" />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--sea-ink)]">
          <input type="checkbox" checked={hedgeAll} onChange={(e) => setHedgeAll(e.target.checked)} className="accent-[var(--lagoon-deep)]" />
          Hedge all outcomes
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--sea-ink)]">
          <input type="checkbox" checked={allowLay} onChange={(e) => setAllowLay(e.target.checked)} className="accent-[var(--lagoon-deep)]" />
          Allow lay bets
        </label>
      </div>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <><Spinner className="h-4 w-4" /> Calculating…</> : 'Calculate Hedge'}
      </Button>
      <ResultsContainer label="Hedge Calculation" data={results} error={error} />
    </div>
  )
}

function ConvertOddsTool() {
  const [odds, setOdds] = React.useState('2.10, 3.40, 3.50')
  const [oddsFormat, setOddsFormat] = React.useState('decimal')
  const [names, setNames] = React.useState('Home, Draw, Away')
  const [results, setResults] = React.useState<unknown>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: async () => {
      setError(null)
      const res = await runPenaltyblogOperation({
        data: {
          operation: 'convert_odds',
          payload: {
            odds: odds.split(',').map((o) => parseFloat(o.trim())),
            odds_format: oddsFormat,
            market_names: names ? names.split(',').map((n) => n.trim()) : undefined,
          },
        },
      })
      return (res as BridgeResult).result
    },
    onSuccess: setResults,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Odds (comma-separated)</Label>
          <Input value={odds} onChange={(e) => setOdds(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Input Format</Label>
          <Select value={oddsFormat} onValueChange={setOddsFormat} placeholder="Format" options={[
            { label: 'Decimal', value: 'decimal' },
            { label: 'American', value: 'american' },
            { label: 'Fractional', value: 'fractional' },
          ]} />
        </div>
        <div className="space-y-1">
          <Label>Market Names (optional)</Label>
          <Input value={names} onChange={(e) => setNames(e.target.value)} />
        </div>
      </div>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <><Spinner className="h-4 w-4" /> Converting…</> : 'Convert Odds'}
      </Button>
      <ResultsContainer label="Converted Odds" data={results} error={error} />
    </div>
  )
}

// ─── Ratings Section ──────────────────────────────────────────────────────────

function RatingsSection() {
  const [system, setSystem] = React.useState('elo')

  return (
    <div className="mt-4 space-y-5">
      <div className="space-y-1">
        <Label>Rating System</Label>
        <Select
          value={system}
          onValueChange={setSystem}
          placeholder="Select system"
          options={[
            { label: 'Elo Ratings', value: 'elo' },
            { label: 'Pi Ratings', value: 'pi' },
            { label: 'Colley Ratings', value: 'colley' },
            { label: 'Massey Ratings', value: 'massey' },
          ]}
        />
      </div>

      {system === 'elo' && <EloTool />}
      {system === 'pi' && <PiTool />}
      {system === 'colley' && <ColleyMasseyTool system="colley" />}
      {system === 'massey' && <ColleyMasseyTool system="massey" />}
    </div>
  )
}

function EloTool() {
  const [matchesInput, setMatchesInput] = React.useState('TeamA, TeamB, 1\nTeamB, TeamC, 0\nTeamA, TeamC, 1')
  const [k, setK] = React.useState('20')
  const [hfa, setHfa] = React.useState('100')
  const [predHome, setPredHome] = React.useState('')
  const [predAway, setPredAway] = React.useState('')
  const [results, setResults] = React.useState<unknown>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: async () => {
      setError(null)
      const matches = matchesInput
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const [home, away, result] = line.split(',').map((s) => s.trim())
          return { home, away, result: parseInt(result, 10) }
        })
      const payload: Record<string, unknown> = {
        matches,
        k: parseFloat(k),
        home_field_advantage: parseFloat(hfa),
      }
      if (predHome && predAway) {
        payload.prediction = { home: predHome, away: predAway }
      }
      const res = await runPenaltyblogOperation({ data: { operation: 'elo_ratings', payload } })
      return (res as BridgeResult).result
    },
    onSuccess: setResults,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Match Results (Home, Away, Result — 1=Home win, 0=Draw/Loss per line)</Label>
        <textarea
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon)] focus:outline-none focus:ring-1 focus:ring-[var(--lagoon)]"
          rows={5}
          value={matchesInput}
          onChange={(e) => setMatchesInput(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>K-factor</Label>
          <Input type="number" step="1" value={k} onChange={(e) => setK(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Home Field Advantage</Label>
          <Input type="number" step="10" value={hfa} onChange={(e) => setHfa(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Predict — Home Team (optional)</Label>
          <Input value={predHome} onChange={(e) => setPredHome(e.target.value)} placeholder="e.g. TeamA" />
        </div>
        <div className="space-y-1">
          <Label>Predict — Away Team (optional)</Label>
          <Input value={predAway} onChange={(e) => setPredAway(e.target.value)} placeholder="e.g. TeamB" />
        </div>
      </div>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <><Spinner className="h-4 w-4" /> Computing…</> : 'Compute Elo Ratings'}
      </Button>
      <ResultsContainer label="Elo Ratings" data={results} error={error} />
    </div>
  )
}

function PiTool() {
  const [matchesInput, setMatchesInput] = React.useState('TeamA, TeamB, 2, 1\nTeamB, TeamC, 0, 0\nTeamA, TeamC, 3, 1')
  const [alpha, setAlpha] = React.useState('0.15')
  const [beta, setBeta] = React.useState('0.10')
  const [piK, setPiK] = React.useState('0.75')
  const [predHome, setPredHome] = React.useState('')
  const [predAway, setPredAway] = React.useState('')
  const [results, setResults] = React.useState<unknown>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: async () => {
      setError(null)
      const matches = matchesInput
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(',').map((s) => s.trim())
          return {
            home: parts[0],
            away: parts[1],
            goals_home: parseInt(parts[2], 10),
            goals_away: parseInt(parts[3], 10),
          }
        })
      const payload: Record<string, unknown> = {
        matches,
        alpha: parseFloat(alpha),
        beta: parseFloat(beta),
        k: parseFloat(piK),
      }
      if (predHome && predAway) {
        payload.prediction = { home: predHome, away: predAway }
      }
      const res = await runPenaltyblogOperation({ data: { operation: 'pi_ratings', payload } })
      return (res as BridgeResult).result
    },
    onSuccess: setResults,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Match Results (Home, Away, GoalsHome, GoalsAway per line)</Label>
        <textarea
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon)] focus:outline-none focus:ring-1 focus:ring-[var(--lagoon)]"
          rows={5}
          value={matchesInput}
          onChange={(e) => setMatchesInput(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Alpha</Label>
          <Input type="number" step="0.01" value={alpha} onChange={(e) => setAlpha(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Beta</Label>
          <Input type="number" step="0.01" value={beta} onChange={(e) => setBeta(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>K</Label>
          <Input type="number" step="0.05" value={piK} onChange={(e) => setPiK(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Predict — Home Team (optional)</Label>
          <Input value={predHome} onChange={(e) => setPredHome(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Predict — Away Team (optional)</Label>
          <Input value={predAway} onChange={(e) => setPredAway(e.target.value)} />
        </div>
      </div>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <><Spinner className="h-4 w-4" /> Computing…</> : 'Compute Pi Ratings'}
      </Button>
      <ResultsContainer label="Pi Ratings" data={results} error={error} />
    </div>
  )
}

function ColleyMasseyTool({ system }: { system: 'colley' | 'massey' }) {
  const [matchesInput, setMatchesInput] = React.useState('TeamA, TeamB, 2, 1\nTeamB, TeamC, 0, 0\nTeamA, TeamC, 3, 1')
  const [includeDraw, setIncludeDraw] = React.useState(true)
  const [results, setResults] = React.useState<unknown>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: async () => {
      setError(null)
      const lines = matchesInput.split('\n').map((l) => l.trim()).filter(Boolean)
      const goalsHome: number[] = []
      const goalsAway: number[] = []
      const teamsHome: string[] = []
      const teamsAway: string[] = []
      for (const line of lines) {
        const [h, a, gh, ga] = line.split(',').map((s) => s.trim())
        teamsHome.push(h)
        teamsAway.push(a)
        goalsHome.push(parseInt(gh, 10))
        goalsAway.push(parseInt(ga, 10))
      }
      const payload: Record<string, unknown> = {
        goals_home: goalsHome,
        goals_away: goalsAway,
        teams_home: teamsHome,
        teams_away: teamsAway,
      }
      if (system === 'colley') payload.include_draws = includeDraw
      const operation = system === 'colley' ? 'colley_ratings' : 'massey_ratings'
      const res = await runPenaltyblogOperation({ data: { operation, payload } })
      return (res as BridgeResult).result
    },
    onSuccess: setResults,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Match Results (Home, Away, GoalsHome, GoalsAway per line)</Label>
        <textarea
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon)] focus:outline-none focus:ring-1 focus:ring-[var(--lagoon)]"
          rows={5}
          value={matchesInput}
          onChange={(e) => setMatchesInput(e.target.value)}
        />
      </div>
      {system === 'colley' && (
        <label className="flex items-center gap-2 text-sm text-[var(--sea-ink)]">
          <input type="checkbox" checked={includeDraw} onChange={(e) => setIncludeDraw(e.target.checked)} className="accent-[var(--lagoon-deep)]" />
          Include draws
        </label>
      )}
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <><Spinner className="h-4 w-4" /> Computing…</> : `Compute ${system === 'colley' ? 'Colley' : 'Massey'} Ratings`}
      </Button>
      <ResultsContainer label={`${system === 'colley' ? 'Colley' : 'Massey'} Ratings`} data={results} error={error} />
    </div>
  )
}

// ─── Backtest Section ─────────────────────────────────────────────────────────

function BacktestSection() {
  const [matchesInput, setMatchesInput] = React.useState('')
  const [model, setModel] = React.useState('PoissonGoalsModel')
  const [market, setMarket] = React.useState('home_win')
  const [threshold, setThreshold] = React.useState('0.45')
  const [bankroll, setBankroll] = React.useState('1000')
  const [stake, setStake] = React.useState('50')
  const [timeDecay, setTimeDecay] = React.useState(false)
  const [xi, setXi] = React.useState('0.0018')
  const [results, setResults] = React.useState<unknown>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: async () => {
      setError(null)
      const lines = matchesInput.split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length < 2) throw new Error('Need at least 2 matches (CSV: date,team_home,team_away,goals_home,goals_away,home_odds,draw_odds,away_odds)')
      const headers = lines[0].split(',').map((h) => h.trim())
      const matches = lines.slice(1).map((line) => {
        const vals = line.split(',').map((v) => v.trim())
        const row: Record<string, unknown> = {}
        headers.forEach((h, i) => {
          const val = vals[i]
          if (['goals_home', 'goals_away'].includes(h)) row[h] = parseInt(val, 10)
          else if (['home_odds', 'draw_odds', 'away_odds'].includes(h)) row[h] = parseFloat(val)
          else row[h] = val
        })
        return row
      })
      const res = await runPenaltyblogOperation({
        data: {
          operation: 'backtest_run',
          payload: {
            matches,
            model,
            market,
            threshold: parseFloat(threshold),
            bankroll: parseFloat(bankroll),
            stake: parseFloat(stake),
            use_time_decay: timeDecay,
            xi: parseFloat(xi),
          },
        },
      })
      return (res as BridgeResult).result
    },
    onSuccess: setResults,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div className="mt-4 space-y-5">
      <p className="text-xs text-[var(--sea-ink-soft)]">
        Paste CSV data with headers: date, team_home, team_away, goals_home, goals_away, home_odds, draw_odds, away_odds
      </p>
      <div className="space-y-1">
        <Label>Match Data (CSV with headers)</Label>
        <textarea
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-mono text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon)] focus:outline-none focus:ring-1 focus:ring-[var(--lagoon)]"
          rows={8}
          value={matchesInput}
          onChange={(e) => setMatchesInput(e.target.value)}
          placeholder={'date,team_home,team_away,goals_home,goals_away,home_odds,draw_odds,away_odds\n2024-01-01,TeamA,TeamB,2,1,1.80,3.50,4.50'}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Model</Label>
          <Select value={model} onValueChange={setModel} placeholder="Model" options={[
            { label: 'Poisson', value: 'PoissonGoalsModel' },
            { label: 'Dixon-Coles', value: 'DixonColesGoalModel' },
            { label: 'Bivariate', value: 'BivariateGoalsModel' },
            { label: 'Negative Binomial', value: 'NegativeBinomialGoalsModel' },
            { label: 'Zero-Inflated Poisson', value: 'ZeroInflatedPoissonGoalsModel' },
            { label: 'Weibull Count', value: 'WeibullCountGoalsModel' },
          ]} />
        </div>
        <div className="space-y-1">
          <Label>Market</Label>
          <Select value={market} onValueChange={setMarket} placeholder="Market" options={[
            { label: 'Home Win', value: 'home_win' },
            { label: 'Draw', value: 'draw' },
            { label: 'Away Win', value: 'away_win' },
            { label: 'Over 2.5', value: 'over_25' },
            { label: 'Under 2.5', value: 'under_25' },
            { label: 'BTTS Yes', value: 'btts_yes' },
            { label: 'BTTS No', value: 'btts_no' },
          ]} />
        </div>
        <div className="space-y-1">
          <Label>Probability Threshold</Label>
          <Input type="number" step="0.05" min="0" max="1" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Starting Bankroll</Label>
          <Input type="number" step="100" min="1" value={bankroll} onChange={(e) => setBankroll(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Stake per Bet</Label>
          <Input type="number" step="10" min="1" value={stake} onChange={(e) => setStake(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Time Decay ξ</Label>
          <Input type="number" step="0.0001" value={xi} onChange={(e) => setXi(e.target.value)} disabled={!timeDecay} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--sea-ink)]">
        <input type="checkbox" checked={timeDecay} onChange={(e) => setTimeDecay(e.target.checked)} className="accent-[var(--lagoon-deep)]" />
        Use Dixon-Coles time decay weighting
      </label>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <><Spinner className="h-4 w-4" /> Running backtest…</> : '📈 Run Backtest'}
      </Button>
      <ResultsContainer label="Backtest Results" data={results} error={error} />
    </div>
  )
}

// ─── FPL Section ──────────────────────────────────────────────────────────────

function FPLSection() {
  const [tool, setTool] = React.useState('current_gameweek')
  const [entryId, setEntryId] = React.useState('')
  const [gameweek, setGameweek] = React.useState('1')
  const [playerId, setPlayerId] = React.useState('')
  const [page, setPage] = React.useState('1')
  const [results, setResults] = React.useState<unknown>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mut = useMutation({
    mutationFn: async () => {
      setError(null)
      const opMap: Record<string, string> = {
        current_gameweek: 'fpl_current_gameweek',
        gameweek_info: 'fpl_gameweek_info',
        player_mappings: 'fpl_player_id_mappings',
        player_data: 'fpl_player_data',
        player_history: 'fpl_player_history',
        rankings: 'fpl_rankings',
        entry_picks: 'fpl_entry_picks',
      }
      const payloadMap: Record<string, Record<string, unknown>> = {
        current_gameweek: {},
        gameweek_info: {},
        player_mappings: {},
        player_data: {},
        player_history: { player_id: parseInt(playerId, 10) },
        rankings: { page: parseInt(page, 10) },
        entry_picks: { entry_id: parseInt(entryId, 10), gameweek: parseInt(gameweek, 10) },
      }
      const res = await runPenaltyblogOperation({
        data: { operation: opMap[tool], payload: payloadMap[tool] },
      })
      return (res as BridgeResult).result
    },
    onSuccess: setResults,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div className="mt-4 space-y-5">
      <div className="space-y-1">
        <Label>FPL Tool</Label>
        <Select value={tool} onValueChange={setTool} placeholder="Select tool" options={[
          { label: 'Current Gameweek', value: 'current_gameweek' },
          { label: 'Gameweek Info', value: 'gameweek_info' },
          { label: 'Player ID Mappings', value: 'player_mappings' },
          { label: 'Player Data', value: 'player_data' },
          { label: 'Player History', value: 'player_history' },
          { label: 'Rankings', value: 'rankings' },
          { label: 'Entry Picks', value: 'entry_picks' },
        ]} />
      </div>

      {tool === 'player_history' && (
        <div className="space-y-1">
          <Label>Player ID</Label>
          <Input type="number" value={playerId} onChange={(e) => setPlayerId(e.target.value)} placeholder="e.g. 427" />
        </div>
      )}

      {tool === 'rankings' && (
        <div className="space-y-1">
          <Label>Page</Label>
          <Input type="number" min="1" value={page} onChange={(e) => setPage(e.target.value)} />
        </div>
      )}

      {tool === 'entry_picks' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Entry ID (Manager ID)</Label>
            <Input type="number" value={entryId} onChange={(e) => setEntryId(e.target.value)} placeholder="e.g. 12345" />
          </div>
          <div className="space-y-1">
            <Label>Gameweek</Label>
            <Input type="number" min="1" max="38" value={gameweek} onChange={(e) => setGameweek(e.target.value)} />
          </div>
        </div>
      )}

      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <><Spinner className="h-4 w-4" /> Fetching…</> : '⚽ Fetch FPL Data'}
      </Button>
      <ResultsContainer label="FPL Data" data={results} error={error} />
    </div>
  )
}
