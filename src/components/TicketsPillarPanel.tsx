import { useState } from 'react'
import {
  generateTicketBatch,
  listTicketBatches,
  getTicketBatch,
  deleteTicketBatch,
  listGenerationStrategies,
  placeTicket,
  settleTicket,
  scanArbitrage,
  placeArbitrage,
} from '#/lib/client-actions/tickets'
import { getBankrolls, getBookmakerAccounts } from '#/lib/client-actions/account'
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

function GenerateTab() {
  const qc = useQueryClient()
  const bankrolls = useQuery({
    queryKey: ['bankrolls'],
    queryFn: () => getBankrolls(),
  })
  const strategies = useQuery({
    queryKey: ['ticket-strategies'],
    queryFn: () => listGenerationStrategies(),
  })

  const bankrollList = (bankrolls.data as any[]) ?? []
  const strategyList = (strategies.data as any[]) ?? []

  const [bankrollId, setBankrollId] = useState<string>('')
  const [strategy, setStrategy] = useState('highest-ev')
  const [ticketCount, setTicketCount] = useState('5')
  const [legsPerTicket, setLegsPerTicket] = useState('3')
  const [stake, setStake] = useState('10')
  const [league, setLeague] = useState('')
  const [swapMatches, setSwapMatches] = useState(true)
  const [minLegOverlap, setMinLegOverlap] = useState('1')
  const [edgeThreshold, setEdgeThreshold] = useState('0.05')
  const [kellyCap, setKellyCap] = useState('0.05')
  const [randomTemperature, setRandomTemperature] = useState('1.0')
  const [bookmaker, setBookmaker] = useState('')

  const effectiveBankrollId = bankrollId || (bankrollList[0]?.id ? String(bankrollList[0].id) : '')

  const gen = useMutation({
    mutationFn: () =>
      generateTicketBatch({
        data: {
          bankrollId: Number(effectiveBankrollId),
          strategy,
          ticketCount: Number(ticketCount),
          legsPerTicket: Number(legsPerTicket),
          stake: Number(stake),
          swapMatches,
          minLegOverlap: Number(minLegOverlap),
          edgeThreshold: Number(edgeThreshold),
          kellyCap: Number(kellyCap),
          randomTemperature: Number(randomTemperature),
          league: league || undefined,
          bookmaker: bookmaker || undefined,
        } as any,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-batches'] }),
  })

  const bankrollOptions = bankrollList.length
    ? bankrollList.map((b) => ({ value: String(b.id), label: `${b.name} (${b.currency} ${b.balance.toFixed(2)})` }))
    : [{ value: '__none__', label: 'No bankrolls — create one in Account' }]

  const strategyOptions = strategyList.length
    ? strategyList.map((s) => ({ value: s.value, label: s.label }))
    : [{ value: 'highest-ev', label: 'Highest EV' }]

  return (
    <Card>
      <div className="mb-3 text-base font-semibold">Generate ticket batch</div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge status="info" label={strategy} />
        <span className="text-xs text-[var(--sea-ink-soft)]">
          Pulls leg candidates from successful PredictionRuns + cross-references current OddsEntry rows.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Bankroll</label>
          <Select value={effectiveBankrollId || '__none__'} onValueChange={(v) => setBankrollId(v === '__none__' ? '' : v)} options={bankrollOptions} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Strategy</label>
          <Select value={strategy} onValueChange={setStrategy} options={strategyOptions} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">League (contains)</label>
          <Input value={league} onChange={(e) => setLeague(e.target.value)} placeholder="optional" />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Ticket count</label>
          <Input value={ticketCount} onChange={(e) => setTicketCount(e.target.value)} type="number" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Legs / ticket</label>
          <Input value={legsPerTicket} onChange={(e) => setLegsPerTicket(e.target.value)} type="number" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Stake</label>
          <Input value={stake} onChange={(e) => setStake(e.target.value)} type="number" />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Bookmaker (optional)</label>
          <Input value={bookmaker} onChange={(e) => setBookmaker(e.target.value)} placeholder="e.g. Bet365" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Edge threshold</label>
          <Input value={edgeThreshold} onChange={(e) => setEdgeThreshold(e.target.value)} type="number" step="0.01" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Kelly cap</label>
          <Input value={kellyCap} onChange={(e) => setKellyCap(e.target.value)} type="number" step="0.01" />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Min leg overlap</label>
          <Input value={minLegOverlap} onChange={(e) => setMinLegOverlap(e.target.value)} type="number" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Random temperature</label>
          <Input value={randomTemperature} onChange={(e) => setRandomTemperature(e.target.value)} type="number" step="0.1" />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={swapMatches} onChange={(e) => setSwapMatches(e.target.checked)} />
            Swap matches across tickets
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button variant="primary" onClick={() => gen.mutate()} disabled={gen.isPending || !effectiveBankrollId}>
          {gen.isPending ? 'Generating…' : 'Generate batch'}
        </Button>
        {gen.isError && <span className="text-sm text-red-500">{(gen.error as Error).message}</span>}
        {gen.isSuccess && (
          <span className="text-sm text-emerald-600">
            Created batch #{(gen.data as any)?.batchId} with {(gen.data as any)?.ticketCount} ticket(s).
          </span>
        )}
      </div>
    </Card>
  )
}

function PlaceMenu({ ticket, accounts, onDone }: { ticket: any; accounts: any[]; onDone: () => void }) {
  const qc = useQueryClient()
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ? String(accounts[0].id) : '')
  const [externalRef, setExternalRef] = useState('')
  const place = useMutation({
    mutationFn: () =>
      placeTicket({
        data: {
          ticketId: ticket.id,
          bookmakerAccountId: Number(accountId),
          externalRef: externalRef || undefined,
          stake: ticket.stake,
        } as any,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-batches'] })
      qc.invalidateQueries({ queryKey: ['ticket-batch', ticket.batchId] })
      qc.invalidateQueries({ queryKey: ['bankrolls'] })
      onDone()
    },
  })
  if (!accounts.length) return <span className="text-xs text-[var(--sea-ink-soft)]">No bookmaker accounts</span>
  return (
    <div className="flex items-center gap-2">
      <div className="w-44">
        <Select
          value={accountId}
          onValueChange={setAccountId}
          options={accounts.map((a) => ({ value: String(a.id), label: a.bookmaker }))}
        />
      </div>
      <Input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} placeholder="Ref (opt)" />
      <Button variant="primary" onClick={() => place.mutate()} disabled={place.isPending || !accountId}>
        Place
      </Button>
    </div>
  )
}

function SettleMenu({ ticket, onDone }: { ticket: any; onDone: () => void }) {
  const qc = useQueryClient()
  const [outcome, setOutcome] = useState('won')
  const [returnAmount, setReturnAmount] = useState(String(ticket.potentialReturn))
  const settle = useMutation({
    mutationFn: () =>
      settleTicket({
        data: {
          ticketId: ticket.id,
          outcome: outcome as any,
          returnAmount: Number(returnAmount),
        } as any,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-batches'] })
      qc.invalidateQueries({ queryKey: ['ticket-batch', ticket.batchId] })
      qc.invalidateQueries({ queryKey: ['bankrolls'] })
      onDone()
    },
  })
  return (
    <div className="flex items-center gap-2">
      <div className="w-28">
        <Select
          value={outcome}
          onValueChange={setOutcome}
          options={[
            { value: 'won', label: 'Won' },
            { value: 'lost', label: 'Lost' },
            { value: 'void', label: 'Void' },
          ]}
        />
      </div>
      <Input value={returnAmount} onChange={(e) => setReturnAmount(e.target.value)} type="number" />
      <Button variant="primary" onClick={() => settle.mutate()} disabled={settle.isPending}>
        Settle
      </Button>
    </div>
  )
}

function BatchDetail({ batchId, onClose }: { batchId: number; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['ticket-batch', batchId],
    queryFn: () => getTicketBatch({ data: { batchId } as any }),
  })
  const accounts = useQuery({
    queryKey: ['bookmaker-accounts'],
    queryFn: () => getBookmakerAccounts(),
  })
  const data = detail.data as any
  const accountList = (accounts.data as any[]) ?? []

  if (detail.isLoading) return <div className="p-4 text-sm">Loading…</div>
  if (!data) return null

  const bankrollAccounts = accountList.filter((a) => a.bankrollId === data.bankrollId)

  return (
    <Card>
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-semibold truncate">{data.name ?? `Batch #${data.id}`}</div>
          <div className="text-xs text-[var(--sea-ink-soft)]">
            {data.strategy} • {data.ticketCount} tickets • {data.bankroll?.name}
          </div>
        </div>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <div className="space-y-3">
        {data.tickets.map((t: any) => {
          const placement = t.placements?.[0]
          return (
            <div key={t.id} className="rounded-lg border border-[var(--sea-line)] p-3">
              <div className="mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge status={t.status === 'settled' ? 'success' : t.status === 'placed' ? 'info' : 'neutral'} label={t.status} />
                  <span className="font-mono text-sm">#{t.id}</span>
                  <span className="text-sm">odds {t.combinedOdds.toFixed(2)} • prob {(t.combinedProbability * 100).toFixed(1)}% • EV {(t.expectedValue * 100).toFixed(1)}%</span>
                </div>
                <div className="text-sm">stake {t.stake} → {t.potentialReturn.toFixed(2)}</div>
              </div>
              <div className="mb-2 space-y-1 text-xs">
                {t.legs.map((leg: any) => (
                  <div key={leg.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[var(--sea-line)]/50 py-1 gap-0.5">
                    <span className="truncate">
                      {leg.homeTeam} vs {leg.awayTeam}
                      <span className="ml-2 text-[var(--sea-ink-soft)]">{leg.matchDate ?? ''}</span>
                    </span>
                    <span className="font-mono shrink-0">
                      {leg.label} @ {leg.odds.toFixed(2)} ({leg.bookmaker}) • p={leg.modelProb != null ? (leg.modelProb * 100).toFixed(0) + '%' : '—'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                {t.status === 'draft' && <PlaceMenu ticket={t} accounts={bankrollAccounts} onDone={() => {}} />}
                {t.status === 'placed' && placement && <SettleMenu ticket={t} onDone={() => {}} />}
                {t.status === 'settled' && placement?.settlement && (
                  <span className="text-xs text-[var(--sea-ink-soft)]">
                    Settled {placement.settlement.outcome} • return {placement.settlement.returnAmount.toFixed(2)} • PL {placement.settlement.profitLoss.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function BatchesTab() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<number | null>(null)
  const batches = useQuery({
    queryKey: ['ticket-batches'],
    queryFn: () => listTicketBatches(),
    refetchInterval: 6000,
  })
  const del = useMutation({
    mutationFn: (batchId: number) => deleteTicketBatch({ data: { batchId } as any }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-batches'] }),
  })

  const list = (batches.data as any[]) ?? []
  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 text-base font-semibold">Ticket batches</div>
        {list.length === 0 ? (
          <EmptyState title="No batches yet" description="Generate a batch from the Generate tab." />
        ) : (
          <div className="space-y-2">
            {list.map((b) => {
              const settled = b.tickets.filter((t: any) => t.status === 'settled').length
              const placed = b.tickets.filter((t: any) => t.status === 'placed').length
              return (
                <div key={b.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-[var(--sea-line)] bg-[var(--sea-surface)] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      #{b.id} • {b.strategy} • {b.bankroll?.name ?? '—'}
                    </div>
                    <div className="text-xs text-[var(--sea-ink-soft)]">
                      {b.ticketCount} tickets • {placed} placed • {settled} settled • {new Date(b.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => setSelected(b.id)}>Open</Button>
                    <Button variant="danger" onClick={() => del.mutate(b.id)} disabled={del.isPending}>Delete</Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
      {selected != null && <BatchDetail batchId={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function ArbitragePlaceModal({
  opp,
  bankrolls,
  accounts,
  onClose,
}: {
  opp: any
  bankrolls: any[]
  accounts: any[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [bankrollId, setBankrollId] = useState<string>(bankrolls[0]?.id ? String(bankrolls[0].id) : '')
  const [totalStake, setTotalStake] = useState('100')
  const bankrollAccounts = accounts.filter((a) => bankrollId && a.bankrollId === Number(bankrollId))
  const [legAccounts, setLegAccounts] = useState<Record<string, string>>({})

  const place = useMutation({
    mutationFn: () =>
      placeArbitrage({
        data: {
          matchId: opp.matchId,
          market: opp.market,
          bankrollId: Number(bankrollId),
          totalStake: Number(totalStake),
          legs: opp.legs.map((l: any) => ({
            outcome: l.outcome,
            bookmakerAccountId: Number(legAccounts[l.outcome] ?? bankrollAccounts[0]?.id ?? 0),
            odds: l.odds,
          })),
        } as any,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-batches'] })
      qc.invalidateQueries({ queryKey: ['bankrolls'] })
      onClose()
    },
  })

  const accountOptions = bankrollAccounts.map((a) => ({ value: String(a.id), label: a.bookmaker }))
  if (!accountOptions.length) accountOptions.push({ value: '__none__', label: 'No bookmaker accounts on this bankroll' })

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-base font-semibold">
          Place hedge: {opp.homeTeam} vs {opp.awayTeam} • {opp.market}
        </div>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Bankroll</label>
          <Select
            value={bankrollId || '__none__'}
            onValueChange={(v) => setBankrollId(v === '__none__' ? '' : v)}
            options={
              bankrolls.length
                ? bankrolls.map((b) => ({ value: String(b.id), label: `${b.name} (${b.balance.toFixed(2)})` }))
                : [{ value: '__none__', label: 'No bankrolls' }]
            }
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Total stake</label>
          <Input value={totalStake} onChange={(e) => setTotalStake(e.target.value)} type="number" />
        </div>
      </div>
      <div className="mt-3 -mx-1 overflow-x-auto">
        <div className="min-w-[560px] space-y-2 px-1">
          {opp.legs.map((leg: any) => {
          const projectedStake = (Number(totalStake) * leg.impliedProb) / opp.totalImplied
          const accountId = legAccounts[leg.outcome] ?? (bankrollAccounts[0]?.id ? String(bankrollAccounts[0].id) : '__none__')
          return (
            <div key={leg.outcome} className="flex items-center gap-2 rounded border border-[var(--sea-line)] p-2">
              <div className="w-24 font-mono">{leg.label}</div>
              <div className="w-24">@ {leg.odds.toFixed(2)}</div>
              <div className="w-32 text-xs text-[var(--sea-ink-soft)]">{leg.bookmaker}</div>
              <div className="w-32">stake {projectedStake.toFixed(2)}</div>
              <div className="flex-1">
                <Select
                  value={accountId}
                  onValueChange={(v) => setLegAccounts((s) => ({ ...s, [leg.outcome]: v }))}
                  options={accountOptions}
                />
              </div>
            </div>
          )
        })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => place.mutate()} disabled={place.isPending || !bankrollId || !bankrollAccounts.length}>
          {place.isPending ? 'Placing…' : 'Place hedge tickets'}
        </Button>
        {place.isError && <span className="text-sm text-red-500">{(place.error as Error).message}</span>}
        {place.isSuccess && <span className="text-sm text-emerald-600">Placed batch #{(place.data as any)?.batchId}.</span>}
      </div>
    </Card>
  )
}

function ArbitrageTab() {
  const [windowDays, setWindowDays] = useState('7')
  const [minMargin, setMinMargin] = useState('0.0')
  const [league, setLeague] = useState('')
  const [selected, setSelected] = useState<any | null>(null)

  const opportunities = useQuery({
    queryKey: ['arbitrage', windowDays, minMargin, league],
    queryFn: () =>
      scanArbitrage({
        data: {
          windowDays: Number(windowDays),
          minMargin: Number(minMargin),
          league: league || undefined,
        } as any,
      }),
  })
  const bankrolls = useQuery({ queryKey: ['bankrolls'], queryFn: () => getBankrolls() })
  const accounts = useQuery({ queryKey: ['bookmaker-accounts'], queryFn: () => getBookmakerAccounts() })

  const opps = (opportunities.data as any[]) ?? []

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 text-base font-semibold">Cross-bookmaker arbitrage scanner</div>
        <div className="mb-3 text-xs text-[var(--sea-ink-soft)]">
          Scans current OddsEntry rows. Finds matches where best odds across bookmakers sum (1/odds) to less than 1.
          Hedge stakes are split so payout is identical regardless of outcome.
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Window (days)</label>
            <Input value={windowDays} onChange={(e) => setWindowDays(e.target.value)} type="number" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Min margin</label>
            <Input value={minMargin} onChange={(e) => setMinMargin(e.target.value)} type="number" step="0.005" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">League contains</label>
            <Input value={league} onChange={(e) => setLeague(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="primary" onClick={() => opportunities.refetch()} disabled={opportunities.isFetching}>
              {opportunities.isFetching ? 'Scanning…' : 'Re-scan'}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-3 text-base font-semibold">Opportunities ({opps.length})</div>
        {opportunities.isLoading ? (
          <div className="text-sm">Loading…</div>
        ) : opps.length === 0 ? (
          <EmptyState title="No arbitrage opportunities" description="No combinations of best odds sum below 1 in the selected window." />
        ) : (
          <div className="space-y-2">
            {opps.map((opp) => (
              <div
                key={`${opp.matchId}-${opp.market}`}
                className="rounded-lg border border-[var(--sea-line)] bg-[var(--sea-surface)] p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      {opp.homeTeam} vs {opp.awayTeam}
                      <span className="ml-2 text-xs text-[var(--sea-ink-soft)]">{opp.matchDate ?? ''}</span>
                    </div>
                    <div className="text-xs text-[var(--sea-ink-soft)]">
                      {opp.league} • {opp.market} • implied {(opp.totalImplied * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status="success" label={`+${(opp.margin * 100).toFixed(2)}%`} />
                    <Button variant="primary" onClick={() => setSelected({ ...opp })}>
                      Place hedge
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs md:grid-cols-3">
                  {opp.legs.map((leg: any) => (
                    <div key={leg.outcome} className="rounded border border-[var(--sea-line)]/50 px-2 py-1">
                      <span className="font-mono">{leg.label}</span> @ {leg.odds.toFixed(2)}{' '}
                      <span className="text-[var(--sea-ink-soft)]">({leg.bookmaker})</span>{' '}
                      <span className="ml-2">share {(leg.stakeShare * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {selected && (
        <ArbitragePlaceModal
          opp={selected}
          bankrolls={(bankrolls.data as any[]) ?? []}
          accounts={(accounts.data as any[]) ?? []}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

export default function TicketsPillarPanel() {
  const [tab, setTab] = useState('generate')
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="generate">⚙️ Generate</TabsTrigger>
        <TabsTrigger value="batches">🎫 Batches</TabsTrigger>
        <TabsTrigger value="arbitrage">⚖️ Arbitrage</TabsTrigger>
      </TabsList>
      <TabsContent value="generate">
        <GenerateTab />
      </TabsContent>
      <TabsContent value="batches">
        <BatchesTab />
      </TabsContent>
      <TabsContent value="arbitrage">
        <ArbitrageTab />
      </TabsContent>
    </Tabs>
  )
}
