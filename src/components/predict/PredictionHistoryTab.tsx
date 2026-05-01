import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '#/lib/query'
import { Button, Card, Spinner, Select, Label } from '#/components/ui'
import {
  getPredictionSessions,
  deletePredictionSession,
  type SessionWithStats,
} from '#/lib/client-actions/predictions'
import { cn } from '#/lib/cn'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// ─── Market display components ────────────────────────────────────────────────

function MarketGroup({ title, tooltip, children }: { title: string; tooltip: string; children: React.ReactNode }) {
  return (
    <div className="relative group/mg">
      <div className="flex items-center gap-0.5 mb-1.5 cursor-default select-none">
        <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sea-ink-soft)]/70">{title}</span>
        <span className="text-[9px] text-[var(--sea-ink-soft)]/40">ⓘ</span>
      </div>
      <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 hidden group-hover/mg:block">
        <div className="max-w-[220px] rounded bg-gray-900 px-2.5 py-1.5 text-[11px] leading-snug text-gray-100 shadow-lg ring-1 ring-white/10">
          {tooltip}
        </div>
        <div className="ml-3 h-1.5 w-1.5 rotate-45 bg-gray-900 -mt-1" />
      </div>
      <div className="flex gap-1.5">{children}</div>
    </div>
  )
}

function formatOdd(prob: number): string {
  const raw = 1 / prob
  if (raw > 99) return '99+'
  if (raw < 1.01) return '1.01'
  return raw.toFixed(2)
}

function ProbBadge({ value, highlight }: { value: number | null; highlight: boolean }) {
  if (value == null) return <span className="text-xs text-[var(--sea-ink-soft)]">—</span>
  const odd = formatOdd(value)
  const isExtreme = value < 0.02 || value > 0.98
  return (
    <span
      className={`inline-flex flex-col items-center rounded px-1.5 py-0.5 ${
        highlight ? 'bg-[var(--lagoon)]/15 text-[var(--lagoon-deep)]' : 'text-[var(--sea-ink)]'
      }`}
    >
      <span className="text-xs font-semibold">{(value * 100).toFixed(1)}%</span>
      <span className={`text-[10px] font-normal ${isExtreme ? 'opacity-30' : 'opacity-60'}`}>{odd}</span>
    </span>
  )
}

function MarketCell({ label, value, highlight }: { label: string; value: number | null; highlight: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-[var(--sea-ink-soft)]/60">{label}</span>
      <ProbBadge value={value} highlight={highlight} />
    </div>
  )
}

function isHighest(value: number | null, ...others: (number | null)[]) {
  if (value == null) return false
  return others.every((o) => o == null || value >= o)
}

function accuracyBadge(predictions: SessionWithStats['predictions']) {
  const resolved = predictions.filter((p) => p.isCorrect !== null)
  if (resolved.length === 0) return null
  const correct = resolved.filter((p) => p.isCorrect).length
  const pct = Math.round((correct / resolved.length) * 100)
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-semibold',
        pct >= 60
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          : pct >= 40
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      )}
    >
      {correct}/{resolved.length} ({pct}%)
    </span>
  )
}

export function PredictionHistoryTab() {
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = React.useState<number | null>(null)
  const [sourceFilter, setSourceFilter] = React.useState('__all__')
  const [modelFilter, setModelFilter] = React.useState('__all__')
  const [periodByPred, setPeriodByPred] = React.useState<Record<number, 'ft' | '1h' | '2h'>>({})

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['prediction-sessions'],
    queryFn: () => getPredictionSessions(),
    staleTime: 30_000,
  })

  const deleteMut = useMutation({
    mutationFn: (sessionId: number) => deletePredictionSession({ data: { sessionId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prediction-sessions'] }),
  })

  const sources = React.useMemo(
    () => [...new Set(sessions.map((s) => s.source))],
    [sessions],
  )
  const models = React.useMemo(
    () => [...new Set(sessions.map((s) => s.model))],
    [sessions],
  )

  const sourceOptions = React.useMemo(
    () => [{ label: 'All sources', value: '__all__' }, ...sources.map((s) => ({ label: s, value: s }))],
    [sources],
  )
  const modelOptions = React.useMemo(
    () => [{ label: 'All models', value: '__all__' }, ...models.map((m) => ({ label: m, value: m }))],
    [models],
  )

  const filtered = sessions.filter((s) => {
    if (sourceFilter !== '__all__' && s.source !== sourceFilter) return false
    if (modelFilter !== '__all__' && s.model !== modelFilter) return false
    return true
  })

  if (isLoading) {
    return (
      <Card className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
        <Spinner className="h-4 w-4" /> Loading prediction history…
      </Card>
    )
  }

  if (sessions.length === 0) {
    return (
      <Card className="text-center text-sm text-[var(--sea-ink-soft)]">
        <p className="mb-1 text-base font-semibold text-[var(--sea-ink)]">No predictions yet</p>
        <p>Run predictions from the Prediction tab and save them to see history here.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label>Source</Label>
          <Select value={sourceFilter} onValueChange={setSourceFilter} options={sourceOptions} />
        </div>
        <div className="space-y-1">
          <Label>Model</Label>
          <Select value={modelFilter} onValueChange={setModelFilter} options={modelOptions} />
        </div>
        <span className="pb-1 text-xs text-[var(--sea-ink-soft)]">
          {filtered.length} session{filtered.length !== 1 ? 's' : ''}
        </span>
      </Card>

      {/* Sessions list */}
      <div className="space-y-3">
        {filtered.map((session) => (
          <Card key={session.id} className="space-y-3 p-0">
            {/* Session header */}
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
              className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-[var(--sand)]/30"
            >
              <span className="text-xs text-[var(--sea-ink-soft)]/50">
                {expandedId === session.id ? '▾' : '▸'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[var(--sea-ink)]">
                    {session.league}
                  </span>
                  <span className="rounded-full bg-[var(--lagoon)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--lagoon-deep)]">
                    {session.source}
                  </span>
                  <span className="rounded-full bg-[var(--sand)] px-2 py-0.5 text-[10px] font-medium text-[var(--sea-ink-soft)]">
                    {session.model}
                  </span>
                  {accuracyBadge(session.predictions)}
                </div>
                <p className="mt-0.5 text-xs text-[var(--sea-ink-soft)]">
                  {session.matchCount} predictions · {formatDate(session.createdAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('Delete this prediction session?')) {
                    deleteMut.mutate(session.id)
                  }
                }}
                className="text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
              >
                🗑
              </Button>
            </button>

            {/* Expanded predictions — full market odds cards */}
            {expandedId === session.id && (
              <div className="border-t border-[var(--line)] px-4 pb-4 space-y-2 mt-2">
                {session.predictions.map((p) => {
                  const hasPeriods = p.htHomeWinProb != null || p.shHomeWinProb != null
                  const period = periodByPred[p.id] ?? 'ft'
                  const m = period === '1h'
                    ? { homeWinProb: p.htHomeWinProb, drawProb: p.htDrawProb, awayWinProb: p.htAwayWinProb, predictedGoalsHome: p.htGoalsHome, predictedGoalsAway: p.htGoalsAway, dc1X: p.htDc1X, dcX2: p.htDcX2, dc12: p.htDc12, dnbHome: p.htDnbHome, dnbAway: p.htDnbAway, over15: p.htOver15, under15: p.htUnder15, over25: p.htOver25, under25: p.htUnder25, over35: p.htOver35, under35: p.htUnder35, bttsYes: p.htBttsYes, bttsNo: p.htBttsNo, ahHome: p.htAhHome, ahAway: p.htAhAway }
                    : period === '2h'
                      ? { homeWinProb: p.shHomeWinProb, drawProb: p.shDrawProb, awayWinProb: p.shAwayWinProb, predictedGoalsHome: p.shGoalsHome, predictedGoalsAway: p.shGoalsAway, dc1X: p.shDc1X, dcX2: p.shDcX2, dc12: p.shDc12, dnbHome: p.shDnbHome, dnbAway: p.shDnbAway, over15: p.shOver15, under15: p.shUnder15, over25: p.shOver25, under25: p.shUnder25, over35: p.shOver35, under35: p.shUnder35, bttsYes: p.shBttsYes, bttsNo: p.shBttsNo, ahHome: p.shAhHome, ahAway: p.shAhAway }
                      : p
                  return (
                    <div
                      key={p.id}
                      className="rounded-lg border border-[var(--line)]/60 p-3 hover:bg-[var(--lagoon)]/5 transition-colors"
                    >
                      {/* Match header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)]/30 pb-2 mb-3">
                        <span className="font-semibold text-sm text-[var(--sea-ink)]">
                          {p.homeTeam} vs {p.awayTeam}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {p.matchDate && (
                            <span className="text-xs text-[var(--sea-ink-soft)]">
                              {new Date(p.matchDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                          {p.predictedOutcome && (
                            <span className="rounded-full bg-[var(--lagoon)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--lagoon-deep)]">
                              {p.predictedOutcome}
                            </span>
                          )}
                          {p.isValueBet && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              ✓ {p.valueBetMarket}
                            </span>
                          )}
                          {p.expectedValue != null && (
                            <span className={`text-[10px] font-semibold tabular-nums ${p.expectedValue > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--sea-ink-soft)]'}`}>
                              EV {p.expectedValue > 0 ? '+' : ''}{(p.expectedValue * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Period selector */}
                      {hasPeriods && (
                        <div className="flex gap-1 mb-3">
                          {(['ft', '1h', '2h'] as const).map((per) => {
                            const label = per === 'ft' ? 'Full Time' : per === '1h' ? '1st Half' : '2nd Half'
                            const active = period === per
                            return (
                              <button
                                key={per}
                                type="button"
                                onClick={() => setPeriodByPred((prev) => ({ ...prev, [p.id]: per }))}
                                className={cn(
                                  'rounded px-2 py-0.5 text-[10px] font-semibold transition-colors',
                                  active
                                    ? 'bg-[var(--lagoon)] text-white'
                                    : 'bg-[var(--sand)] text-[var(--sea-ink-soft)] hover:bg-[var(--lagoon)]/20',
                                )}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* Market groups */}
                      <div className="flex flex-wrap gap-x-5 gap-y-3">
                        <MarketGroup title="1X2" tooltip="Match result probability: Home win / Draw / Away win">
                          <MarketCell label="Home" value={m.homeWinProb} highlight={isHighest(m.homeWinProb, m.drawProb, m.awayWinProb)} />
                          <MarketCell label="Draw" value={m.drawProb} highlight={isHighest(m.drawProb, m.homeWinProb, m.awayWinProb)} />
                          <MarketCell label="Away" value={m.awayWinProb} highlight={isHighest(m.awayWinProb, m.homeWinProb, m.drawProb)} />
                        </MarketGroup>

                        <MarketGroup title="Double Chance" tooltip="Covers 2 of 3 outcomes — 1X: home or draw · X2: draw or away · 12: home or away">
                          <MarketCell label="1X" value={m.dc1X} highlight={isHighest(m.dc1X, m.dcX2, m.dc12)} />
                          <MarketCell label="X2" value={m.dcX2} highlight={isHighest(m.dcX2, m.dc1X, m.dc12)} />
                          <MarketCell label="12" value={m.dc12} highlight={isHighest(m.dc12, m.dc1X, m.dcX2)} />
                        </MarketGroup>

                        <MarketGroup title="Draw No Bet" tooltip="Removes the draw — stake refunded on draw.">
                          <MarketCell label="Home" value={m.dnbHome} highlight={isHighest(m.dnbHome, m.dnbAway)} />
                          <MarketCell label="Away" value={m.dnbAway} highlight={isHighest(m.dnbAway, m.dnbHome)} />
                        </MarketGroup>

                        <MarketGroup title="xG" tooltip="Expected Goals — predicted average goals per team">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] text-[var(--sea-ink-soft)]/60">Home</span>
                            <span className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold text-[var(--sea-ink)]">
                              {m.predictedGoalsHome != null ? m.predictedGoalsHome.toFixed(2) : '—'}
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] text-[var(--sea-ink-soft)]/60">Away</span>
                            <span className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold text-[var(--sea-ink)]">
                              {m.predictedGoalsAway != null ? m.predictedGoalsAway.toFixed(2) : '—'}
                            </span>
                          </div>
                        </MarketGroup>

                        <MarketGroup title="Totals" tooltip="Probability total goals will be Over/Under 1.5 / 2.5 / 3.5">
                          <MarketCell label="O1.5" value={m.over15} highlight={false} />
                          <MarketCell label="U1.5" value={m.under15} highlight={false} />
                          <MarketCell label="O2.5" value={m.over25} highlight={isHighest(m.over25, m.under25)} />
                          <MarketCell label="U2.5" value={m.under25} highlight={isHighest(m.under25, m.over25)} />
                          <MarketCell label="O3.5" value={m.over35} highlight={false} />
                          <MarketCell label="U3.5" value={m.under35} highlight={false} />
                        </MarketGroup>

                        <MarketGroup title="BTTS" tooltip="Both Teams To Score — both home and away score at least one goal">
                          <MarketCell label="Yes" value={m.bttsYes} highlight={isHighest(m.bttsYes, m.bttsNo)} />
                          <MarketCell label="No" value={m.bttsNo} highlight={isHighest(m.bttsNo, m.bttsYes)} />
                        </MarketGroup>

                        <MarketGroup title="Asian HCP" tooltip="Asian Handicap ±0.5 — home must win / away wins or draws">
                          <MarketCell label="-0.5" value={m.ahHome} highlight={isHighest(m.ahHome, m.ahAway)} />
                          <MarketCell label="+0.5" value={m.ahAway} highlight={isHighest(m.ahAway, m.ahHome)} />
                        </MarketGroup>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
