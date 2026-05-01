import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '#/lib/query'
import {
  getMatchesForTickets,
  getTicketSports,
  saveTicket,
  getTickets,
  deleteTicket,
} from '#/lib/client-actions/tickets'
import type { MatchForTicket, MatchMarket, TicketSelection, SavedTicket } from '#/server/tickets'
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Dialog,
  DialogContent,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from './ui'
import { cn } from '#/lib/cn'
import { getPredictionSessions } from '#/lib/client-actions/predictions'
import type { SessionWithStats } from '#/server/predictions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function calcStats(selections: TicketSelection[], stake: number) {
  if (selections.length === 0) {
    return { combinedOdds: 0, combinedProbability: 0, potentialReturn: 0, ev: 0 }
  }
  const combinedOdds = selections.reduce((acc, s) => acc * s.odds, 1)
  const combinedProbability = selections.reduce((acc, s) => acc * (s.modelProb ?? (1 / s.odds)), 1)
  return {
    combinedOdds: parseFloat(combinedOdds.toFixed(2)),
    combinedProbability: parseFloat((combinedProbability * 100).toFixed(1)),
    potentialReturn: parseFloat((stake * combinedOdds).toFixed(2)),
    ev: parseFloat(((combinedProbability * combinedOdds - 1) * 100).toFixed(2)),
  }
}

function ticketTypeName(n: number): string {
  if (n === 1) return 'Single'
  if (n === 2) return 'Double'
  if (n === 3) return 'Treble'
  return `${n}-Fold Accumulator`
}

// ─── AddSelectionDialog ───────────────────────────────────────────────────────

function AddSelectionDialog({
  match,
  existingMatchIds,
  onAdd,
  onClose,
}: {
  match: MatchForTicket | null
  existingMatchIds: Set<number>
  onAdd: (sel: TicketSelection) => void
  onClose: () => void
}) {
  const [chosenKey, setChosenKey] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (match) setChosenKey(null)
  }, [match?.id])

  // flat list of all selectable options from all markets
  type Option = {
    key: string
    market: MatchMarket
    outcome: string
    label: string
    odds: number
    bookmaker: string
  }

  const options: Option[] = React.useMemo(() => {
    if (!match) return []
    return match.markets.flatMap((mkt) =>
      mkt.selections.map((sel) => ({
        key: `${mkt.market}|${mkt.submarket ?? ''}|${sel.outcome}`,
        market: mkt,
        outcome: sel.outcome,
        label: sel.label,
        odds: sel.odds,
        bookmaker: sel.bookmaker,
      })),
    )
  }, [match])

  // group by market displayName
  const grouped = React.useMemo(() => {
    const map = new Map<string, Option[]>()
    for (const opt of options) {
      const key = opt.market.displayName
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(opt)
    }
    return [...map.entries()]
  }, [options])

  const chosen = options.find((o) => o.key === chosenKey) ?? null

  function handleAdd() {
    if (!match || !chosen) return
    onAdd({
      matchId: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      matchDate: match.matchDate,
      sport: match.sport,
      league: match.league,
      market: chosen.market.market,
      submarket: chosen.market.submarket,
      outcome: chosen.outcome,
      label: chosen.label,
      odds: chosen.odds,
      bookmaker: chosen.bookmaker,
    })
    onClose()
  }

  const isChanging = match ? existingMatchIds.has(match.id) : false

  return (
    <Dialog open={match != null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="max-w-xl"
        title={match ? `${match.homeTeam} vs ${match.awayTeam}` : ''}
      >
        {match && (
          <div className="space-y-4">
            <p className="text-xs text-[var(--sea-ink-soft)]">
              {[match.league, formatDate(match.matchDate), match.sport].filter(Boolean).join(' · ')}
              {isChanging && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  replacing current selection
                </span>
              )}
            </p>

            {options.length === 0 ? (
              <p className="text-sm text-[var(--sea-ink-soft)]">No odds available for this match.</p>
            ) : (
              <>
                <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
                  {grouped.map(([marketName, opts]) => (
                    <div key={marketName}>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                        {marketName}
                      </p>
                      <div className="space-y-1">
                        {opts.map((opt) => {
                          const isChosen = chosenKey === opt.key
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => setChosenKey(isChosen ? null : opt.key)}
                              className={cn(
                                'flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition',
                                isChosen
                                  ? 'border-[var(--lagoon-deep)] bg-[var(--lagoon)]/10 font-semibold text-[var(--lagoon-deep)]'
                                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--sea-ink)] hover:border-[var(--lagoon)]/40 hover:bg-[var(--lagoon)]/5',
                              )}
                            >
                              <span className="flex items-center gap-2.5">
                                <span
                                  className={cn(
                                    'flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border-2',
                                    isChosen
                                      ? 'border-[var(--lagoon-deep)] bg-[var(--lagoon-deep)]'
                                      : 'border-[var(--sea-ink-soft)]/40',
                                  )}
                                >
                                  {isChosen && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                                </span>
                                {opt.label}
                              </span>
                              <span className="flex items-center gap-2">
                                <span className="text-[10px] text-[var(--sea-ink-soft)]">{opt.bookmaker}</span>
                                <span className="min-w-[3rem] rounded-lg bg-[var(--lagoon-deep)] px-2 py-0.5 text-center text-sm font-bold text-white">
                                  {opt.odds.toFixed(2)}
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-3">
                  <Button variant="secondary" onClick={onClose}>Cancel</Button>
                  <Button onClick={handleAdd} disabled={!chosen}>
                    {isChanging ? 'Update Selection' : 'Add to Ticket'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── PredictionBrowser ────────────────────────────────────────────────────────

type PredRow = SessionWithStats['predictions'][0]

function outcomeLabel1x2(outcome: string, homeTeam: string, awayTeam: string): string {
  if (outcome === '1') return `${homeTeam} Win`
  if (outcome === 'X') return 'Draw'
  if (outcome === '2') return `${awayTeam} Win`
  return outcome
}

function outcomeToKey(outcome: string): string {
  if (outcome === '1') return 'home'
  if (outcome === 'X') return 'draw'
  if (outcome === '2') return 'away'
  return outcome
}

function predRowToSelection(
  pred: PredRow,
  liveOdds?: { odds: number; bookmaker: string } | null,
): TicketSelection | null {
  if (!pred.predictedOutcome) return null
  const bookmakerOdds = pred.bookmakerOdds ?? liveOdds?.odds ?? null
  if (bookmakerOdds == null) return null
  const bookmaker = pred.bookmakerOdds != null ? 'Best odds' : (liveOdds?.bookmaker ?? 'Best odds')
  const outcome = outcomeToKey(pred.predictedOutcome)
  const label = outcomeLabel1x2(pred.predictedOutcome, pred.homeTeam, pred.awayTeam)
  const modelProb =
    pred.predictedOutcome === '1'
      ? (pred.homeWinProb ?? undefined)
      : pred.predictedOutcome === 'X'
        ? (pred.drawProb ?? undefined)
        : (pred.awayWinProb ?? undefined)
  return {
    matchId: -pred.id, // negative id to distinguish from real match ids
    homeTeam: pred.homeTeam,
    awayTeam: pred.awayTeam,
    matchDate: pred.matchDate ?? null,
    sport: 'football',
    league: pred.league ?? null,
    market: '1x2',
    submarket: '1x2',
    outcome,
    label,
    odds: bookmakerOdds,
    bookmaker,
    modelProb,
  }
}

function PredictionBrowser({
  draftSelections,
  onAddSelection,
  onRemove,
}: {
  draftSelections: TicketSelection[]
  onAddSelection: (sel: TicketSelection) => void
  onRemove: (matchId: number) => void
}) {
  const [sessionId, setSessionId] = React.useState<number | null>(null)

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['prediction-sessions'],
    queryFn: () => getPredictionSessions(),
    staleTime: 30_000,
  })
  // Fetch live match odds to fill in when prediction session has no bookmakerOdds
  const { data: liveMatches } = useQuery({
    queryKey: ['matches-for-tickets', '__pred_browser__'],
    queryFn: () => getMatchesForTickets({ data: {} }),
    staleTime: 60_000,
  })

  // Build lookup: "hometeam|awayteam" (lowercased) → {odds, bookmaker} per outcome key
  const liveOddsMap = React.useMemo(() => {
    type OddsEntry = { odds: number; bookmaker: string }
    const map = new Map<string, Record<string, OddsEntry>>()
    if (!liveMatches) return map
    for (const m of liveMatches) {
      const key = `${m.homeTeam.toLowerCase()}|${m.awayTeam.toLowerCase()}`
      const x12 = m.markets.find((mkt) => (mkt.submarket ?? mkt.market) === '1x2')
      if (!x12) continue
      const entry: Record<string, OddsEntry> = {}
      for (const sel of x12.selections) {
        entry[sel.outcome] = { odds: sel.odds, bookmaker: sel.bookmaker }
      }
      map.set(key, entry)
    }
    return map
  }, [liveMatches])
  React.useEffect(() => {
    if (sessions && sessions.length > 0 && sessionId === null) {
      setSessionId(sessions[0].id)
    }
  }, [sessions, sessionId])

  const session = sessions?.find((s) => s.id === sessionId) ?? null
  const draftMatchIds = React.useMemo(
    () => new Set(draftSelections.map((s) => s.matchId)),
    [draftSelections],
  )

  function togglePred(pred: PredRow) {
    const fakeId = -pred.id
    if (draftMatchIds.has(fakeId)) {
      onRemove(fakeId)
    } else {
      const liveKey = `${pred.homeTeam.toLowerCase()}|${pred.awayTeam.toLowerCase()}`
      const liveEntry = liveOddsMap.get(liveKey)
      const outcomeKey = pred.predictedOutcome ? outcomeToKey(pred.predictedOutcome) : null
      const liveOdds = (outcomeKey && liveEntry) ? (liveEntry[outcomeKey] ?? null) : null
      const sel = predRowToSelection(pred, liveOdds)
      if (sel) onAddSelection(sel)
    }
  }

  function addAllValueBets() {
    if (!session) return
    for (const pred of session.predictions) {
      if (!pred.isValueBet) continue
      const fakeId = -pred.id
      if (draftMatchIds.has(fakeId)) continue
      const liveKey = `${pred.homeTeam.toLowerCase()}|${pred.awayTeam.toLowerCase()}`
      const liveEntry = liveOddsMap.get(liveKey)
      const outcomeKey = pred.predictedOutcome ? outcomeToKey(pred.predictedOutcome) : null
      const liveOdds = (outcomeKey && liveEntry) ? (liveEntry[outcomeKey] ?? null) : null
      const sel = predRowToSelection(pred, liveOdds)
      if (sel) onAddSelection(sel)
    }
  }

  const sessionOptions = (sessions ?? []).map((s) => ({
    label: `${s.league} — ${new Date(s.createdAt).toLocaleDateString()} (${s.model}, ${s.matchCount} matches)`,
    value: String(s.id),
  }))

  const valueBetCount = session?.predictions.filter((p) => p.isValueBet && p.bookmakerOdds != null).length ?? 0

  return (
    <div className="flex flex-col gap-3">
      {/* Session selector */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
          <Spinner className="h-4 w-4" /> Loading sessions…
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--line)] text-center text-sm text-[var(--sea-ink-soft)]">
          <div>
            <p className="font-medium">No prediction sessions yet</p>
            <p className="mt-1 text-xs">
              Go to the <strong>Predict</strong> page, run a model, and save a session first.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select
                value={sessionId != null ? String(sessionId) : ''}
                onValueChange={(v) => setSessionId(Number(v))}
                options={sessionOptions}
              />
            </div>
            {valueBetCount > 0 && (
              <Button variant="secondary" onClick={addAllValueBets} className="shrink-0 text-xs">
                + {valueBetCount} value bet{valueBetCount !== 1 ? 's' : ''}
              </Button>
            )}
          </div>

          {/* Prediction rows */}
          {!session ? null : session.predictions.length === 0 ? (
            <p className="text-center text-sm text-[var(--sea-ink-soft)]">No predictions in this session.</p>
          ) : (
            <div
              className="space-y-1.5 overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - 360px)', minHeight: 200 }}
            >
              {session.predictions.map((pred) => {
                const fakeId = -pred.id
                const inTicket = draftMatchIds.has(fakeId)
                const liveKey = `${pred.homeTeam.toLowerCase()}|${pred.awayTeam.toLowerCase()}`
                const liveEntry = liveOddsMap.get(liveKey)
                const outcomeKey = pred.predictedOutcome ? outcomeToKey(pred.predictedOutcome) : null
                const liveOdds = (outcomeKey && liveEntry) ? (liveEntry[outcomeKey] ?? null) : null
                const displayOdds = pred.bookmakerOdds ?? liveOdds?.odds ?? null
                const hasSel = pred.predictedOutcome != null && displayOdds != null
                const probHome = pred.homeWinProb != null ? (pred.homeWinProb * 100).toFixed(0) : '—'
                const probDraw = pred.drawProb != null ? (pred.drawProb * 100).toFixed(0) : '—'
                const probAway = pred.awayWinProb != null ? (pred.awayWinProb * 100).toFixed(0) : '—'
                const ev =
                  pred.expectedValue != null
                    ? pred.expectedValue * 100
                    : null

                return (
                  <div
                    key={pred.id}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition',
                      inTicket
                        ? 'border-emerald-300/60 bg-emerald-50 dark:border-emerald-700/40 dark:bg-emerald-900/10'
                        : 'border-[var(--line)] bg-[var(--surface)]',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-[var(--sea-ink)]">
                          {pred.homeTeam}
                          <span className="mx-1 font-normal text-[var(--sea-ink-soft)]">vs</span>
                          {pred.awayTeam}
                        </p>
                        {pred.isValueBet && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            VALUE
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[10px] text-[var(--sea-ink-soft)]">
                        {[pred.league, formatDate(pred.matchDate)].filter(Boolean).join(' · ')}
                      </p>
                      {/* Model probs */}
                      <div className="mt-1 flex gap-2 text-[10px]">
                        {(['1', 'X', '2'] as const).map((o) => {
                          const probVal = o === '1' ? probHome : o === 'X' ? probDraw : probAway
                          const isPredicted = pred.predictedOutcome === o
                          return (
                            <span
                              key={o}
                              className={cn(
                                'rounded px-1.5 py-0.5 font-medium',
                                isPredicted
                                  ? 'bg-[var(--lagoon-deep)] text-white'
                                  : 'bg-[var(--sand)] text-[var(--sea-ink-soft)]',
                              )}
                            >
                              {o}: {probVal}%
                            </span>
                          )
                        })}
                        {ev != null && (
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 font-semibold',
                              ev > 0
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-[var(--sand)] text-[var(--sea-ink-soft)]',
                            )}
                          >
                            EV {ev >= 0 ? '+' : ''}{ev.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Odds pill + toggle */}
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {displayOdds != null && (
                        <span
                          title={pred.bookmakerOdds == null ? 'Live odds from DB' : undefined}
                          className={cn(
                            'rounded-lg px-2.5 py-0.5 text-sm font-bold text-white',
                            pred.bookmakerOdds == null
                              ? 'bg-[var(--lagoon)]'
                              : 'bg-[var(--lagoon-deep)]',
                          )}
                        >
                          {displayOdds.toFixed(2)}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={!hasSel}
                        onClick={() => togglePred(pred)}
                        title={
                          !hasSel
                            ? 'No prediction or odds available'
                            : inTicket
                              ? 'Remove from ticket'
                              : 'Add to ticket'
                        }
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition',
                          !hasSel
                            ? 'cursor-not-allowed bg-[var(--sand)] text-[var(--sea-ink-soft)]'
                            : inTicket
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-[var(--lagoon-deep)] text-white hover:bg-[var(--lagoon)]',
                        )}
                      >
                        {inTicket ? '✓' : '+'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── MatchBrowser ─────────────────────────────────────────────────────────────

function MatchBrowser({
  ticketMatchIds,
  onPickMatch,
}: {
  ticketMatchIds: Set<number>
  onPickMatch: (match: MatchForTicket) => void
}) {
  const [search, setSearch] = React.useState('')
  const [sport, setSport] = React.useState('__all__')
  const [upcomingOnly, setUpcomingOnly] = React.useState(false)
  const [debouncedSearch, setDebouncedSearch] = React.useState('')

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: sports } = useQuery({
    queryKey: ['ticket-sports'],
    queryFn: () => getTicketSports(),
    staleTime: 60_000,
  })

  const { data: matches, isLoading } = useQuery({
    queryKey: ['matches-for-tickets', sport, debouncedSearch, upcomingOnly],
    queryFn: () =>
      getMatchesForTickets({
        data: {
          sport: sport === '__all__' ? undefined : sport,
          search: debouncedSearch || undefined,
          upcomingOnly,
        },
      }),
    staleTime: 30_000,
  })

  const sportOptions = [
    { label: 'All Sports', value: '__all__' },
    ...(sports ?? []).map((s) => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: s,
    })),
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex gap-2">
        <Input
          placeholder="Search teams or league…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="flex-1"
        />
        {sportOptions.length > 2 && (
          <div className="w-36">
            <Select value={sport} onValueChange={setSport} options={sportOptions} />
          </div>
        )}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--sea-ink-soft)]">
        <input
          type="checkbox"
          checked={upcomingOnly}
          onChange={(e) => setUpcomingOnly(e.currentTarget.checked)}
          className="rounded accent-[var(--lagoon-deep)]"
        />
        Upcoming matches only
      </label>

      {/* Match list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
          <Spinner className="h-4 w-4" /> Loading matches…
        </div>
      ) : !matches || matches.length === 0 ? (
        <p className="rounded-xl border border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--sea-ink-soft)]">
          {debouncedSearch || sport !== '__all__' || upcomingOnly
            ? 'No matches match your filters.'
            : 'No matches with odds in your database. Scrape some data from the Data Hub first.'}
        </p>
      ) : (
        <div
          className="space-y-1.5 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 340px)', minHeight: 200 }}
        >
          {matches.map((match) => {
            const inTicket = ticketMatchIds.has(match.id)
            return (
              <div
                key={match.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition',
                  inTicket
                    ? 'border-emerald-300/60 bg-emerald-50 dark:border-emerald-700/40 dark:bg-emerald-900/10'
                    : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--lagoon)]/30',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--sea-ink)]">
                    {match.homeTeam}
                    <span className="mx-1 font-normal text-[var(--sea-ink-soft)]">vs</span>
                    {match.awayTeam}
                  </p>
                  <p className="truncate text-[10px] text-[var(--sea-ink-soft)]">
                    {[match.league, formatDate(match.matchDate)].filter(Boolean).join(' · ')}
                  </p>
                  {match.markets.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {match.markets.slice(0, 4).map((mkt) => (
                        <span
                          key={mkt.displayName}
                          className="rounded-full bg-[var(--sand)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--sea-ink-soft)]"
                        >
                          {mkt.displayName}
                        </span>
                      ))}
                      {match.markets.length > 4 && (
                        <span className="text-[9px] text-[var(--sea-ink-soft)]">
                          +{match.markets.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onPickMatch(match)}
                  title={inTicket ? 'Change selection' : 'Add to ticket'}
                  className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition',
                    inTicket
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-[var(--lagoon-deep)] text-white hover:bg-[var(--lagoon)]',
                  )}
                >
                  {inTicket ? '✓' : '+'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── TicketBuilder ────────────────────────────────────────────────────────────

function TicketBuilder({
  selections,
  onRemove,
  onClear,
}: {
  selections: TicketSelection[]
  onRemove: (matchId: number) => void
  onClear: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = React.useState('')
  const [currency, setCurrency] = React.useState('€')
  const [stake, setStake] = React.useState('10')
  const [bankroll, setBankroll] = React.useState('1000')
  const [savedFeedback, setSavedFeedback] = React.useState(false)

  const stakeNum = parseFloat(stake) || 0
  const bankrollNum = parseFloat(bankroll) || 0
  const stats = calcStats(selections, stakeNum)

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      saveTicket({
        data: {
          name: name.trim() || undefined,
          currency,
          stake: stakeNum,
          bankroll: bankrollNum,
          selections,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
      setSavedFeedback(true)
      setTimeout(() => setSavedFeedback(false), 2500)
      onClear()
      setName('')
    },
  })

  const currencyOptions = [
    { label: '€ Euro', value: '€' },
    { label: '$ Dollar', value: '$' },
    { label: '£ Pound', value: '£' },
    { label: 'RON', value: 'RON' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Config */}
      <Card className="space-y-3 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--sea-ink-soft)]">
          Ticket Settings
        </p>
        <div>
          <Label htmlFor="tk-name" className="mb-1 block">Name (optional)</Label>
          <Input
            id="tk-name"
            placeholder="e.g. Weekend Acca"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="tk-stake" className="mb-1 block">Stake</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[var(--sea-ink-soft)]">
                {currency}
              </span>
              <Input
                id="tk-stake"
                type="number"
                min="0.1"
                step="0.5"
                value={stake}
                onChange={(e) => setStake(e.currentTarget.value)}
                className="pl-7"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="tk-currency" className="mb-1 block">Currency</Label>
            <Select value={currency} onValueChange={setCurrency} options={currencyOptions} />
          </div>
        </div>
        <div>
          <Label htmlFor="tk-bankroll" className="mb-1 block">Bankroll</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[var(--sea-ink-soft)]">
              {currency}
            </span>
            <Input
              id="tk-bankroll"
              type="number"
              min="0"
              step="10"
              value={bankroll}
              onChange={(e) => setBankroll(e.currentTarget.value)}
              className="pl-7"
            />
          </div>
        </div>
      </Card>

      {/* Selections */}
      <div className="space-y-1.5">
        {selections.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-[var(--line)] text-sm text-[var(--sea-ink-soft)]">
            Click <strong className="mx-1">+</strong> on a match or prediction to add a selection
          </div>
        ) : (
          selections.map((sel) => (
            <div
              key={sel.matchId}
              className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] text-[var(--sea-ink-soft)]">
                  {sel.homeTeam} vs {sel.awayTeam} · {formatDate(sel.matchDate)}
                </p>
                <p className="text-sm font-semibold text-[var(--sea-ink)]">
                  {sel.label}
                  <span className="ml-1 text-xs font-normal text-[var(--sea-ink-soft)]">
                    · {sel.bookmaker}
                  </span>
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <span className="rounded-lg bg-[var(--lagoon-deep)] px-2.5 py-0.5 text-sm font-bold text-white">
                  {sel.odds.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(sel.matchId)}
                  className="text-[10px] text-red-400 hover:text-red-600"
                >
                  remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {selections.length > 0 && (
        <Card className="space-y-2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--sea-ink-soft)]">
            {selections.length} {selections.length === 1 ? 'Leg' : 'Legs'} · {ticketTypeName(selections.length)}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <span className="text-[var(--sea-ink-soft)]">Combined Odds</span>
            <span className="text-right font-bold text-[var(--sea-ink)]">{stats.combinedOdds}×</span>

            <span className="text-[var(--sea-ink-soft)]">Implied Prob.</span>
            <span className="text-right font-semibold text-[var(--sea-ink)]">{stats.combinedProbability}%</span>

            <span className="text-[var(--sea-ink-soft)]">Stake</span>
            <span className="text-right font-semibold text-[var(--sea-ink)]">
              {currency}{stakeNum.toFixed(2)}
            </span>

            <span className="text-[var(--sea-ink-soft)]">Bankroll stake</span>
            <span className="text-right font-semibold text-[var(--sea-ink)]">
              {bankrollNum > 0 ? ((stakeNum / bankrollNum) * 100).toFixed(1) : '—'}%
            </span>

            <span className="text-[var(--sea-ink-soft)]">Potential Return</span>
            <span className="text-right font-bold text-emerald-600">
              {currency}{stats.potentialReturn.toFixed(2)}
            </span>

            <span className="text-[var(--sea-ink-soft)]">Expected Value</span>
            <span
              className={cn(
                'text-right font-semibold',
                stats.ev >= 0 ? 'text-emerald-600' : 'text-red-500',
              )}
            >
              {stats.ev >= 0 ? '+' : ''}{stats.ev}%
            </span>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={onClear}
          disabled={selections.length === 0}
          className="flex-1"
        >
          Clear
        </Button>
        <Button
          onClick={() => mutate()}
          disabled={selections.length === 0 || stakeNum <= 0 || isPending}
          className="flex-1"
        >
          {isPending ? (
            <><Spinner className="h-4 w-4" /> Saving…</>
          ) : savedFeedback ? (
            '✓ Saved!'
          ) : (
            'Save Ticket'
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── SavedTickets ─────────────────────────────────────────────────────────────

function SavedTickets() {
  const qc = useQueryClient()
  const { data: tickets, isLoading } = useQuery<SavedTicket[]>({
    queryKey: ['tickets'],
    queryFn: () => getTickets(),
  })

  const { mutate: remove } = useMutation({
    mutationFn: (id: number) => deleteTicket({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })

  const [expanded, setExpanded] = React.useState<Set<number>>(new Set())
  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
        <Spinner className="h-4 w-4" /> Loading…
      </div>
    )
  }

  if (!tickets || tickets.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--line)] text-sm text-[var(--sea-ink-soft)]">
        No saved tickets yet — build and save your first ticket!
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tickets.map((ticket) => {
        const isOpen = expanded.has(ticket.id)
        return (
          <Card key={ticket.id} className="space-y-3 p-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--sea-ink)]">
                  {ticket.name || `Ticket #${ticket.id}`}
                </p>
                <p className="text-[10px] text-[var(--sea-ink-soft)]">
                  {new Date(ticket.createdAt).toLocaleString()} · {ticket.selections.length}{' '}
                  {ticket.selections.length === 1 ? 'leg' : 'legs'} ·{' '}
                  {ticketTypeName(ticket.selections.length)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggle(ticket.id)}
                  className="text-xs text-[var(--lagoon-deep)] hover:underline"
                >
                  {isOpen ? 'Hide' : 'Details'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(ticket.id)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2 rounded-xl bg-[var(--sand)] px-3 py-2 text-center text-xs">
              <div>
                <p className="text-[var(--sea-ink-soft)]">Odds</p>
                <p className="font-bold text-[var(--sea-ink)]">{ticket.combinedOdds}×</p>
              </div>
              <div>
                <p className="text-[var(--sea-ink-soft)]">Stake</p>
                <p className="font-semibold text-[var(--sea-ink)]">
                  {ticket.currency}{ticket.stake}
                </p>
              </div>
              <div>
                <p className="text-[var(--sea-ink-soft)]">Return</p>
                <p className="font-bold text-emerald-600">
                  {ticket.currency}{ticket.potentialReturn.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[var(--sea-ink-soft)]">EV</p>
                <p
                  className={cn(
                    'font-semibold',
                    ticket.expectedValue >= 0 ? 'text-emerald-600' : 'text-red-500',
                  )}
                >
                  {ticket.expectedValue >= 0 ? '+' : ''}
                  {(ticket.expectedValue * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Selections detail */}
            {isOpen && (
              <div className="space-y-1.5 pt-1">
                {ticket.selections.map((sel, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[10px] text-[var(--sea-ink-soft)]">
                        {sel.homeTeam} vs {sel.awayTeam} · {formatDate(sel.matchDate)}
                        {sel.league ? ` · ${sel.league}` : ''}
                      </p>
                      <p className="font-semibold text-[var(--sea-ink)]">
                        {sel.label}
                        <span className="ml-1 text-[10px] font-normal text-[var(--sea-ink-soft)]">
                          · {sel.bookmaker}
                        </span>
                      </p>
                    </div>
                    <div className="ml-3 flex flex-shrink-0 items-center gap-2">
                      {(() => {
                        const prob = sel.modelProb ?? 1 / sel.odds
                        const ev = prob * sel.odds - 1
                        return (
                          <span
                            className={cn(
                              'rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                              ev > 0
                                ? 'bg-emerald-900/30 text-emerald-400'
                                : ev < 0
                                  ? 'bg-red-900/30 text-red-400'
                                  : 'bg-[var(--sand)] text-[var(--sea-ink-soft)]',
                            )}
                            title={sel.modelProb != null ? `Model: ${(sel.modelProb * 100).toFixed(1)}% · Implied: ${((1 / sel.odds) * 100).toFixed(1)}%` : 'No model probability — using implied odds'}
                          >
                            EV {ev >= 0 ? '+' : ''}{(ev * 100).toFixed(1)}%
                          </span>
                        )
                      })()}
                      <span className="rounded-lg bg-[var(--lagoon-deep)] px-2 py-0.5 text-sm font-bold text-white">
                        {sel.odds.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function TicketsPanel() {
  const [draftSelections, setDraftSelections] = React.useState<TicketSelection[]>([])
  const [dialogMatch, setDialogMatch] = React.useState<MatchForTicket | null>(null)

  const ticketMatchIds = React.useMemo(
    () => new Set(draftSelections.map((s) => s.matchId)),
    [draftSelections],
  )

  function handleAddSelection(sel: TicketSelection) {
    setDraftSelections((prev) => {
      const idx = prev.findIndex((s) => s.matchId === sel.matchId)
      if (idx !== -1) {
        const next = [...prev]
        next[idx] = sel
        return next
      }
      return [...prev, sel]
    })
  }

  function handleRemove(matchId: number) {
    setDraftSelections((prev) => prev.filter((s) => s.matchId !== matchId))
  }

  return (
    <>
      <Tabs defaultValue="build">
        <TabsList className="mb-6">
          <TabsTrigger value="build">✋ Manual Build</TabsTrigger>
          <TabsTrigger value="predict">🔮 Prediction Build</TabsTrigger>
          <TabsTrigger value="saved">📋 Saved Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="build">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
            {/* Left – match browser */}
            <div className="space-y-3">
              <div>
                <p className="island-kicker mb-1">Match Browser</p>
                <p className="text-sm text-[var(--sea-ink-soft)]">
                  Click <strong>+</strong> on any match to pick a market and add it to your ticket.
                  Click <strong>✓</strong> to change an existing selection.
                </p>
              </div>
              <MatchBrowser ticketMatchIds={ticketMatchIds} onPickMatch={setDialogMatch} />
            </div>

            {/* Right – builder */}
            <div className="space-y-3">
              <div>
                <p className="island-kicker mb-1">Ticket Builder</p>
                <p className="text-sm text-[var(--sea-ink-soft)]">
                  Set your stake and review combined odds before saving.
                </p>
              </div>
              <TicketBuilder
                selections={draftSelections}
                onRemove={handleRemove}
                onClear={() => setDraftSelections([])}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="predict">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
            {/* Left – prediction browser */}
            <div className="space-y-3">
              <div>
                <p className="island-kicker mb-1">Prediction Results</p>
                <p className="text-sm text-[var(--sea-ink-soft)]">
                  Select predictions from a saved session. Click <strong>+</strong> to add a match with its predicted outcome, or click <strong>+ value bets</strong> to bulk-add all value bets.
                </p>
              </div>
              <PredictionBrowser
                draftSelections={draftSelections}
                onAddSelection={handleAddSelection}
                onRemove={handleRemove}
              />
            </div>

            {/* Right – builder */}
            <div className="space-y-3">
              <div>
                <p className="island-kicker mb-1">Ticket Builder</p>
                <p className="text-sm text-[var(--sea-ink-soft)]">
                  Set your stake and review combined odds before saving.
                </p>
              </div>
              <TicketBuilder
                selections={draftSelections}
                onRemove={handleRemove}
                onClear={() => setDraftSelections([])}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="saved">
          <SavedTickets />
        </TabsContent>
      </Tabs>

      <AddSelectionDialog
        match={dialogMatch}
        existingMatchIds={ticketMatchIds}
        onAdd={handleAddSelection}
        onClose={() => setDialogMatch(null)}
      />
    </>
  )
}
