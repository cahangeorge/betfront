import * as React from 'react'
import { useQuery, useMutation } from '#/lib/query'
import { Button, Card, Input, Label, Select, Spinner } from '#/components/ui'
import {
  computeBrierScores,
  computeEnsembleWeights,
  getPredictCatalog,
} from '#/lib/client-actions/predictions'

const MARKETS = [
  { value: '1x2', label: '1X2 (3-way)' },
  { value: 'btts', label: 'BTTS (yes/no)' },
  { value: 'ou_2_5', label: 'Over/Under 2.5' },
] as const

export function BacktestTab() {
  const [league, setLeague] = React.useState('')
  const [market, setMarket] = React.useState<'1x2' | 'btts' | 'ou_2_5'>('1x2')
  const [lookbackDays, setLookbackDays] = React.useState(365)
  const [minSamples, setMinSamples] = React.useState(10)

  const catalogQ = useQuery({
    queryKey: ['predict-catalog'],
    queryFn: () => getPredictCatalog(),
  })

  const scoresQ = useQuery({
    queryKey: ['brier-scores', league, market, lookbackDays, minSamples],
    queryFn: () =>
      computeBrierScores({
        league: league || undefined,
        market,
        lookbackDays,
        minSamples,
      }),
  })

  const allModelKeys = React.useMemo(
    () => (catalogQ.data?.models ?? []).map((m) => m.key),
    [catalogQ.data],
  )

  const weightsM = useMutation({
    mutationFn: () =>
      computeEnsembleWeights({
        league: league || undefined,
        market,
        modelKeys: allModelKeys,
        lookbackDays,
        minSamples,
      }),
  })

  const scores = scoresQ.data ?? []
  const bestBrier = scores.length ? Math.min(...scores.map((s) => s.meanBrier)) : null
  const worstBrier = scores.length ? Math.max(...scores.map((s) => s.meanBrier)) : null

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-4 space-y-3">
          <div className="text-sm font-semibold text-[var(--sea-ink)]">
            Brier-score backtest
          </div>
          <p className="text-xs text-[var(--sea-ink-soft)]">
            Mean Brier score per model from settled matches. Lower is better
            (perfect = 0). Computed from <code>ModelPrediction</code> rows on
            successful single-model runs whose matches have final scores.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>League filter</Label>
              <Input
                value={league}
                onChange={(e) => setLeague(e.target.value)}
                placeholder="e.g. ENG-Premier"
              />
            </div>
            <div>
              <Label>Market</Label>
              <Select
                value={market}
                onValueChange={(v) => setMarket(v as typeof market)}
                options={MARKETS.map((m) => ({ value: m.value, label: m.label }))}
              />
            </div>
            <div>
              <Label>Lookback (days)</Label>
              <Input
                type="number"
                min={1}
                max={3650}
                value={lookbackDays}
                onChange={(e) => setLookbackDays(parseInt(e.target.value) || 365)}
              />
            </div>
            <div>
              <Label>Min samples</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={minSamples}
                onChange={(e) => setMinSamples(parseInt(e.target.value) || 10)}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-[var(--sea-ink)]">
              Per-model Brier scores
            </div>
            <Button
              variant="ghost"
              onClick={() => scoresQ.refetch()}
              disabled={scoresQ.isFetching}
            >
              {scoresQ.isFetching ? <Spinner /> : 'Refresh'}
            </Button>
          </div>
          {scoresQ.isLoading ? (
            <Spinner />
          ) : scoresQ.error ? (
            <div className="text-sm text-red-600">
              {(scoresQ.error as Error).message}
            </div>
          ) : scores.length === 0 ? (
            <div className="text-xs text-[var(--sea-ink-soft)]">
              No settled-match predictions found for these filters. Lower the
              minimum sample count or widen the lookback window.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[var(--sea-ink-soft)]">
                  <tr>
                    <th className="py-1 pr-4">Model</th>
                    <th className="py-1 pr-4">League</th>
                    <th className="py-1 pr-4 text-right">Mean Brier</th>
                    <th className="py-1 pr-4 text-right">Samples</th>
                    <th className="py-1 pr-4">Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s) => {
                    const range = (worstBrier ?? 0) - (bestBrier ?? 0)
                    const norm =
                      range > 0
                        ? 1 - (s.meanBrier - (bestBrier ?? 0)) / range
                        : 1
                    return (
                      <tr
                        key={`${s.modelKey}|${s.league ?? '*'}`}
                        className="border-t border-[var(--sea-line)]"
                      >
                        <td className="py-1.5 pr-4 font-mono text-xs">
                          {s.modelKey}
                        </td>
                        <td className="py-1.5 pr-4 text-xs">
                          {s.league ?? '—'}
                        </td>
                        <td className="py-1.5 pr-4 text-right font-mono">
                          {s.meanBrier.toFixed(4)}
                        </td>
                        <td className="py-1.5 pr-4 text-right">
                          {s.sampleCount}
                        </td>
                        <td className="py-1.5 pr-4">
                          <div className="h-2 w-32 rounded bg-[var(--sea-surface-2)]">
                            <div
                              className="h-2 rounded bg-emerald-500"
                              style={{ width: `${(norm * 100).toFixed(0)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--sea-ink)]">
                Ensemble weights
              </div>
              <div className="text-xs text-[var(--sea-ink-soft)]">
                Inverse-Brier weighting normalised to sum 1. Used by
                ensemble runs when <code>weighting=brier</code>.
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => weightsM.mutate()}
              disabled={weightsM.isPending || allModelKeys.length === 0}
            >
              {weightsM.isPending ? <Spinner /> : 'Compute'}
            </Button>
          </div>
          {weightsM.error ? (
            <div className="text-sm text-red-600">
              {(weightsM.error as Error).message}
            </div>
          ) : weightsM.data ? (
            <div className="space-y-2">
              {weightsM.data.fellBackToUniform && (
                <div className="text-xs text-amber-600">
                  Insufficient data — falling back to uniform weights.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[var(--sea-ink-soft)]">
                    <tr>
                      <th className="py-1 pr-4">Model</th>
                      <th className="py-1 pr-4 text-right">Weight</th>
                      <th className="py-1 pr-4 text-right">Brier</th>
                      <th className="py-1 pr-4 text-right">Samples</th>
                      <th className="py-1 pr-4">Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(weightsM.data.weights).map(([k, w]) => {
                      const sc = weightsM.data!.scores[k]
                      return (
                        <tr key={k} className="border-t border-[var(--sea-line)]">
                          <td className="py-1.5 pr-4 font-mono text-xs">{k}</td>
                          <td className="py-1.5 pr-4 text-right font-mono">
                            {(w * 100).toFixed(2)}%
                          </td>
                          <td className="py-1.5 pr-4 text-right font-mono text-xs">
                            {sc ? sc.meanBrier.toFixed(4) : '—'}
                          </td>
                          <td className="py-1.5 pr-4 text-right text-xs">
                            {sc ? sc.sampleCount : '—'}
                          </td>
                          <td className="py-1.5 pr-4">
                            <div className="h-2 w-32 rounded bg-[var(--sea-surface-2)]">
                              <div
                                className="h-2 rounded bg-sky-500"
                                style={{ width: `${(w * 100).toFixed(0)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[var(--sea-ink-soft)]">
              Click <strong>Compute</strong> to derive weights from current
              Brier scores.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

export default BacktestTab
