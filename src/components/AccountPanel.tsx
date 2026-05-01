import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '#/lib/query'
import {
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Select,
  Spinner,
} from '#/components/ui'
import {
  getCurrentUser,
  getBankrolls,
  createBankroll,
  updateBankroll,
  deleteBankroll,
  getBookmakerAccounts,
  createBookmakerAccount,
  updateBookmakerAccount,
  deleteBookmakerAccount,
  getLedger,
  recordLedgerEntry,
  getAccountSummary,
} from '#/lib/client-actions/account'

type Bankroll = Awaited<ReturnType<typeof getBankrolls>>[number]
type Summary = NonNullable<Awaited<ReturnType<typeof getAccountSummary>>>

const fmt = (n: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)

const fmtSigned = (n: number, currency = 'EUR') => `${n >= 0 ? '+' : ''}${fmt(n, currency)}`

export function AccountPanel() {
  const qc = useQueryClient()
  const userQ = useQuery({ queryKey: ['account.user'], queryFn: () => getCurrentUser() })
  const bankrollsQ = useQuery({
    queryKey: ['account.bankrolls'],
    queryFn: () => getBankrolls(),
  })

  const [selectedId, setSelectedId] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (selectedId == null && bankrollsQ.data && bankrollsQ.data.length > 0) {
      const active = bankrollsQ.data.find((b) => b.isActive) ?? bankrollsQ.data[0]
      setSelectedId(active.id)
    }
  }, [bankrollsQ.data, selectedId])

  const summaryQ = useQuery({
    queryKey: ['account.summary', selectedId ?? 'none'],
    queryFn: () => (selectedId == null ? Promise.resolve(null) : getAccountSummary({ bankrollId: selectedId })),
    enabled: selectedId != null,
  })

  const refreshAll = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: ['account.bankrolls'] })
    qc.invalidateQueries({ queryKey: ['account.summary'] })
    qc.invalidateQueries({ queryKey: ['account.bookmakers'] })
    qc.invalidateQueries({ queryKey: ['account.ledger'] })
  }, [qc])

  if (userQ.isLoading || bankrollsQ.isLoading) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-[var(--sea-ink-soft)]">
          <Spinner /> Loading account…
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--sea-ink)]">👤 Account</h2>
            <p className="text-xs text-[var(--sea-ink-soft)]">
              Signed in as <span className="font-medium text-[var(--sea-ink)]">{userQ.data?.email}</span>
              {' · '}
              {bankrollsQ.data?.length ?? 0} bankroll{(bankrollsQ.data?.length ?? 0) === 1 ? '' : 's'}
            </p>
          </div>
          <BankrollSelector
            bankrolls={bankrollsQ.data ?? []}
            value={selectedId}
            onChange={setSelectedId}
          />
        </div>
      </Card>

      {summaryQ.data && selectedId != null ? (
        <SummaryCard summary={summaryQ.data} />
      ) : null}

      {selectedId != null && (
        <BankrollDetails
          bankrollId={selectedId}
          bankroll={bankrollsQ.data?.find((b) => b.id === selectedId)}
          onChanged={refreshAll}
        />
      )}

      <CreateBankrollCard onCreated={refreshAll} />

      {selectedId != null && (
        <BookmakerAccountsCard bankrollId={selectedId} currency={summaryQ.data?.bankroll.currency ?? 'EUR'} />
      )}

      {selectedId != null && (
        <LedgerCard
          bankrollId={selectedId}
          currency={summaryQ.data?.bankroll.currency ?? 'EUR'}
          onChanged={refreshAll}
        />
      )}
    </div>
  )
}

// ─── Bankroll selector ─────────────────────────────────────────────────────

function BankrollSelector({
  bankrolls,
  value,
  onChange,
}: {
  bankrolls: Bankroll[]
  value: number | null
  onChange: (id: number) => void
}) {
  if (bankrolls.length === 0) return null
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-[var(--sea-ink-soft)]">Active bankroll</Label>
      <Select
        value={value == null ? undefined : String(value)}
        onValueChange={(v) => onChange(Number(v))}
        options={bankrolls.map((b) => ({
          value: String(b.id),
          label: `${b.name} · ${fmt(b.balance, b.currency)}${b.isActive ? '' : ' (archived)'}`,
        }))}
      />
    </div>
  )
}

// ─── Summary card ──────────────────────────────────────────────────────────

function SummaryCard({ summary }: { summary: Summary }) {
  const { bankroll } = summary
  const pnlClass =
    bankroll.pnl > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : bankroll.pnl < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-[var(--sea-ink-soft)]'
  const ticketTotal = Object.values(summary.ticketsByStatus).reduce((s, n) => s + n, 0)
  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Balance" value={fmt(bankroll.balance, bankroll.currency)} />
        <Stat
          label="P&L"
          value={fmtSigned(bankroll.pnl, bankroll.currency)}
          sub={`${bankroll.pnlPct >= 0 ? '+' : ''}${bankroll.pnlPct.toFixed(2)}%`}
          valueClass={pnlClass}
        />
        <Stat label="Kelly Fraction" value={`${(bankroll.kellyFraction * 100).toFixed(0)}%`} />
        <Stat
          label="Tickets"
          value={String(ticketTotal)}
          sub={Object.entries(summary.ticketsByStatus).map(([k, v]) => `${k}:${v}`).join(' · ') || 'none'}
        />
      </div>
    </Card>
  )
}

function Stat({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-bold text-[var(--sea-ink)] ${valueClass ?? ''}`}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--sea-ink-soft)]">{sub}</div>}
    </div>
  )
}

// ─── Bankroll details / edit ──────────────────────────────────────────────

function BankrollDetails({
  bankrollId,
  bankroll,
  onChanged,
}: {
  bankrollId: number
  bankroll: Bankroll | undefined
  onChanged: () => void
}) {
  const [name, setName] = React.useState(bankroll?.name ?? '')
  const [kelly, setKelly] = React.useState(String(bankroll?.kellyFraction ?? 0.5))
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setName(bankroll?.name ?? '')
    setKelly(String(bankroll?.kellyFraction ?? 0.5))
  }, [bankrollId, bankroll?.name, bankroll?.kellyFraction])

  const updateMut = useMutation({
    mutationFn: (vars: { id: number; name?: string; kellyFraction?: number; isActive?: boolean }) =>
      updateBankroll(vars),
    onSuccess: () => {
      setError(null)
      onChanged()
    },
    onError: (e) => setError(String((e as Error).message ?? e)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteBankroll({ id }),
    onSuccess: () => onChanged(),
    onError: (e) => setError(String((e as Error).message ?? e)),
  })

  if (!bankroll) return null
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--sea-ink)]">Bankroll Settings</h3>
        <span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--sea-ink-soft)]">
          {bankroll.type}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Kelly fraction (0–1)</Label>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={kelly}
            onChange={(e) => setKelly(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button
            onClick={() =>
              updateMut.mutate({
                id: bankroll.id,
                name: name.trim() || undefined,
                kellyFraction: Number(kelly),
              })
            }
            disabled={updateMut.isPending}
          >
            {updateMut.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              updateMut.mutate({ id: bankroll.id, isActive: !bankroll.isActive })
            }
            disabled={updateMut.isPending}
          >
            {bankroll.isActive ? 'Archive' : 'Activate'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm(`Delete bankroll "${bankroll.name}" and all related data?`)) {
                deleteMut.mutate(bankroll.id)
              }
            }}
            disabled={deleteMut.isPending}
          >
            Delete
          </Button>
        </div>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </Card>
  )
}

// ─── Create bankroll ──────────────────────────────────────────────────────

function CreateBankrollCard({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [type, setType] = React.useState<'real' | 'paper' | 'sandbox'>('paper')
  const [currency, setCurrency] = React.useState('EUR')
  const [startBalance, setStartBalance] = React.useState('1000')
  const [kelly, setKelly] = React.useState('0.5')
  const [error, setError] = React.useState<string | null>(null)

  const createMut = useMutation({
    mutationFn: (vars: {
      name: string
      type: 'real' | 'paper' | 'sandbox'
      currency: string
      startBalance: number
      kellyFraction: number
    }) => createBankroll(vars),
    onSuccess: () => {
      setError(null)
      setOpen(false)
      setName('')
      setStartBalance('1000')
      setKelly('0.5')
      onCreated()
    },
    onError: (e) => setError(String((e as Error).message ?? e)),
  })

  if (!open) {
    return (
      <Card>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          + New bankroll
        </Button>
      </Card>
    )
  }
  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--sea-ink)]">New Bankroll</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend Acca" />
        </div>
        <div className="space-y-1">
          <Label>Type</Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v as typeof type)}
            options={[
              { value: 'paper', label: 'Paper (simulated)' },
              { value: 'real', label: 'Real money' },
              { value: 'sandbox', label: 'Sandbox' },
            ]}
          />
        </div>
        <div className="space-y-1">
          <Label>Currency</Label>
          <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} />
        </div>
        <div className="space-y-1">
          <Label>Start balance</Label>
          <Input
            type="number"
            min={0}
            step={50}
            value={startBalance}
            onChange={(e) => setStartBalance(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Kelly fraction</Label>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={kelly}
            onChange={(e) => setKelly(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={() =>
            createMut.mutate({
              name: name.trim(),
              type,
              currency: currency.trim() || 'EUR',
              startBalance: Number(startBalance) || 0,
              kellyFraction: Number(kelly),
            })
          }
          disabled={!name.trim() || createMut.isPending}
        >
          {createMut.isPending ? 'Creating…' : 'Create'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </Card>
  )
}

// ─── Bookmaker accounts ───────────────────────────────────────────────────

function BookmakerAccountsCard({
  bankrollId,
  currency,
}: {
  bankrollId: number
  currency: string
}) {
  const qc = useQueryClient()
  const listQ = useQuery({
    queryKey: ['account.bookmakers', bankrollId],
    queryFn: () => getBookmakerAccounts({ bankrollId }),
  })

  const [name, setName] = React.useState('')
  const [balance, setBalance] = React.useState('0')
  const [error, setError] = React.useState<string | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: ['account.bookmakers', bankrollId] })

  const createMut = useMutation({
    mutationFn: (vars: { bankrollId: number; bookmaker: string; balance: number }) =>
      createBookmakerAccount(vars),
    onSuccess: () => {
      setError(null)
      setName('')
      setBalance('0')
      refresh()
    },
    onError: (e) => setError(String((e as Error).message ?? e)),
  })

  const updateMut = useMutation({
    mutationFn: (vars: { id: number; balance?: number; isActive?: boolean }) =>
      updateBookmakerAccount(vars),
    onSuccess: refresh,
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteBookmakerAccount({ id }),
    onSuccess: refresh,
  })

  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--sea-ink)]">🏦 Bookmaker Accounts</h3>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Bookmaker</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bet365, Pinnacle"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Balance</Label>
          <Input
            type="number"
            min={0}
            step={10}
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-32"
          />
        </div>
        <Button
          onClick={() =>
            createMut.mutate({
              bankrollId,
              bookmaker: name.trim(),
              balance: Number(balance) || 0,
            })
          }
          disabled={!name.trim() || createMut.isPending}
        >
          Add
        </Button>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}

      {listQ.isLoading ? (
        <Spinner />
      ) : (listQ.data ?? []).length === 0 ? (
        <EmptyState
          title="No bookmaker accounts yet"
          description="Add one to track per-book balances and place bets against them."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[var(--sand)]">
              <tr className="border-b border-[var(--line)]">
                <th className="px-2 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)]">
                  Bookmaker
                </th>
                <th className="px-2 py-1.5 text-right font-semibold text-[var(--sea-ink-soft)]">
                  Balance
                </th>
                <th className="px-2 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)]">
                  Status
                </th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {(listQ.data ?? []).map((a) => (
                <BookmakerRow
                  key={a.id}
                  account={a}
                  currency={currency}
                  onUpdate={(patch) => updateMut.mutate({ id: a.id, ...patch })}
                  onDelete={() => {
                    if (window.confirm(`Delete account "${a.bookmaker}"?`)) deleteMut.mutate(a.id)
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function BookmakerRow({
  account,
  currency,
  onUpdate,
  onDelete,
}: {
  account: { id: number; bookmaker: string; balance: number; isActive: boolean }
  currency: string
  onUpdate: (patch: { balance?: number; isActive?: boolean }) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [bal, setBal] = React.useState(String(account.balance))
  React.useEffect(() => setBal(String(account.balance)), [account.balance])

  return (
    <tr className="border-b border-[var(--line)]/50">
      <td className="px-2 py-1 font-medium text-[var(--sea-ink)]">{account.bookmaker}</td>
      <td className="px-2 py-1 text-right text-[var(--sea-ink)]">
        {editing ? (
          <Input
            type="number"
            value={bal}
            onChange={(e) => setBal(e.target.value)}
            className="w-24 text-right"
          />
        ) : (
          fmt(account.balance, currency)
        )}
      </td>
      <td className="px-2 py-1 text-[var(--sea-ink-soft)]">
        {account.isActive ? 'Active' : 'Disabled'}
      </td>
      <td className="px-2 py-1 text-right">
        <div className="flex justify-end gap-1">
          {editing ? (
            <>
              <Button
                size="sm"
                onClick={() => {
                  onUpdate({ balance: Number(bal) })
                  setEditing(false)
                }}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUpdate({ isActive: !account.isActive })}
              >
                {account.isActive ? 'Disable' : 'Enable'}
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete}>
                Delete
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Ledger ───────────────────────────────────────────────────────────────

function LedgerCard({
  bankrollId,
  currency,
  onChanged,
}: {
  bankrollId: number
  currency: string
  onChanged: () => void
}) {
  const qc = useQueryClient()
  const listQ = useQuery({
    queryKey: ['account.ledger', bankrollId],
    queryFn: () => getLedger({ bankrollId, limit: 50 }),
  })

  const [kind, setKind] = React.useState<'deposit' | 'withdraw' | 'adjust'>('deposit')
  const [amount, setAmount] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const recordMut = useMutation({
    mutationFn: (vars: {
      bankrollId: number
      kind: 'deposit' | 'withdraw' | 'adjust'
      amount: number
      notes?: string
    }) => recordLedgerEntry(vars),
    onSuccess: () => {
      setError(null)
      setAmount('')
      setNotes('')
      qc.invalidateQueries({ queryKey: ['account.ledger', bankrollId] })
      onChanged()
    },
    onError: (e) => setError(String((e as Error).message ?? e)),
  })

  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--sea-ink)]">📒 Ledger</h3>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Kind</Label>
          <Select
            value={kind}
            onValueChange={(v) => setKind(v as typeof kind)}
            options={[
              { value: 'deposit', label: 'Deposit' },
              { value: 'withdraw', label: 'Withdraw' },
              { value: 'adjust', label: 'Adjust (manual)' },
            ]}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Amount</Label>
          <Input
            type="number"
            min={0}
            step={10}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32"
          />
        </div>
        <div className="flex-1 min-w-[180px] space-y-1">
          <Label className="text-xs">Notes (optional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button
          onClick={() =>
            recordMut.mutate({
              bankrollId,
              kind,
              amount: Number(amount),
              notes: notes.trim() || undefined,
            })
          }
          disabled={!amount || Number(amount) <= 0 || recordMut.isPending}
        >
          {recordMut.isPending ? 'Recording…' : 'Record'}
        </Button>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}

      {listQ.isLoading ? (
        <Spinner />
      ) : (listQ.data ?? []).length === 0 ? (
        <EmptyState title="No ledger entries yet" description="Deposits, stakes, wins/losses appear here." />
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[var(--sand)]">
              <tr className="border-b border-[var(--line)]">
                <th className="px-2 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)]">When</th>
                <th className="px-2 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)]">Kind</th>
                <th className="px-2 py-1.5 text-right font-semibold text-[var(--sea-ink-soft)]">Amount</th>
                <th className="px-2 py-1.5 text-right font-semibold text-[var(--sea-ink-soft)]">Balance</th>
                <th className="px-2 py-1.5 text-left font-semibold text-[var(--sea-ink-soft)]">Notes</th>
              </tr>
            </thead>
            <tbody>
              {(listQ.data ?? []).map((e) => (
                <tr key={e.id} className="border-b border-[var(--line)]/50">
                  <td className="px-2 py-1 text-[var(--sea-ink-soft)] whitespace-nowrap">
                    {new Date(e.ts).toLocaleString()}
                  </td>
                  <td className="px-2 py-1">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${kindClass(e.kind)}`}>
                      {e.kind}
                    </span>
                  </td>
                  <td
                    className={`px-2 py-1 text-right font-mono ${
                      e.amount >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {fmtSigned(e.amount, currency)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-[var(--sea-ink)]">
                    {fmt(e.balanceAfter, currency)}
                  </td>
                  <td className="px-2 py-1 text-[var(--sea-ink-soft)]">{e.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function kindClass(kind: string) {
  switch (kind) {
    case 'deposit':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'withdraw':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    case 'win':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'loss':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'stake':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300'
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-300'
  }
}
