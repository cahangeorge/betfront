import { z } from 'zod'
import { prisma } from '#/db'
import { getCurrentUserId } from '#/server/auth/context'

// ─── Auth ──────────────────────────────────────────────────────────────────
// Session is established by middleware; getCurrentUserId() reads from ALS.
// Dev fallback: if ALLOW_DEV_USER=1 and no session, return / create dev@local.

const DEV_USER_EMAIL = 'dev@local'
const DEV_USER_NAME = 'Local Dev'
const DEFAULT_BANKROLL_NAME = 'Default Paper Bankroll'

async function ensureDefaultBankroll(userId: number) {
  const count = await prisma.bankroll.count({ where: { userId } })
  if (count === 0) {
    await prisma.bankroll.create({
      data: {
        userId,
        name: DEFAULT_BANKROLL_NAME,
        type: 'paper',
        currency: 'EUR',
        startBalance: 1000,
        balance: 1000,
        kellyFraction: 0.5,
      },
    })
  }
}

export async function getCurrentUser() {
  const userId = getCurrentUserId()
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) {
      await ensureDefaultBankroll(user.id)
      return { id: user.id, email: user.email, name: user.name }
    }
  }
  // Dev fallback (e.g. CLI scripts, tests, no session present)
  // Explicit ALLOW_DEV_USER=0 disables the fallback even in dev (E2E uses this).
  const explicitDisable = process.env.ALLOW_DEV_USER === '0'
  const explicitEnable = process.env.ALLOW_DEV_USER === '1'
  if (!explicitDisable && (explicitEnable || process.env.NODE_ENV !== 'production')) {
    let user = await prisma.user.findUnique({ where: { email: DEV_USER_EMAIL } })
    if (!user) {
      user = await prisma.user.create({
        data: { email: DEV_USER_EMAIL, name: DEV_USER_NAME },
      })
    }
    await ensureDefaultBankroll(user.id)
    return { id: user.id, email: user.email, name: user.name }
  }
  throw new Error('Not authenticated')
}

async function requireUserId(): Promise<number> {
  const u = await getCurrentUser()
  return u.id
}

// ─── Bankrolls ─────────────────────────────────────────────────────────────

export async function getBankrolls() {
  const userId = await requireUserId()
  const rows = await prisma.bankroll.findMany({
    where: { userId },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    include: {
      bookmakerAccounts: { where: { isActive: true } },
      _count: { select: { tickets: true, ledger: true } },
    },
  })
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    currency: b.currency,
    startBalance: b.startBalance,
    balance: b.balance,
    kellyFraction: b.kellyFraction,
    isActive: b.isActive,
    createdAt: b.createdAt.toISOString(),
    bookmakerCount: b.bookmakerAccounts.length,
    ticketCount: b._count.tickets,
    ledgerCount: b._count.ledger,
    bookmakerBalanceTotal: b.bookmakerAccounts.reduce((s, a) => s + a.balance, 0),
  }))
}

const createBankrollSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(['real', 'paper', 'sandbox']).default('paper'),
  currency: z.string().min(2).max(8).default('EUR'),
  startBalance: z.number().nonnegative().default(1000),
  kellyFraction: z.number().min(0).max(1).default(0.5),
})
export async function createBankroll(input: unknown) {
  const data = createBankrollSchema.parse(input)
  const userId = await requireUserId()
  const b = await prisma.bankroll.create({
    data: {
      userId,
      name: data.name,
      type: data.type,
      currency: data.currency,
      startBalance: data.startBalance,
      balance: data.startBalance,
      kellyFraction: data.kellyFraction,
    },
  })
  if (data.startBalance > 0) {
    await prisma.ledgerEntry.create({
      data: {
        bankrollId: b.id,
        kind: 'deposit',
        amount: data.startBalance,
        balanceAfter: data.startBalance,
        notes: 'Initial deposit',
      },
    })
  }
  return { id: b.id }
}

const updateBankrollSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(80).optional(),
  kellyFraction: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
})
export async function updateBankroll(input: unknown) {
  const data = updateBankrollSchema.parse(input)
  const userId = await requireUserId()
  const existing = await prisma.bankroll.findFirst({
    where: { id: data.id, userId },
    select: { id: true },
  })
  if (!existing) throw new Error(`Bankroll ${data.id} not found`)
  const { id, ...patch } = data
  await prisma.bankroll.update({ where: { id }, data: patch })
  return { ok: true }
}

const idSchema = z.object({ id: z.number().int().positive() })
export async function deleteBankroll(input: unknown) {
  const { id } = idSchema.parse(input)
  const userId = await requireUserId()
  const existing = await prisma.bankroll.findFirst({
    where: { id, userId },
    select: { id: true },
  })
  if (!existing) throw new Error(`Bankroll ${id} not found`)
  await prisma.bankroll.delete({ where: { id } })
  return { ok: true }
}

// ─── Bookmaker accounts ────────────────────────────────────────────────────

const bankrollFilterSchema = z.object({ bankrollId: z.number().int().positive() })
export async function getBookmakerAccounts(input: unknown) {
  const { bankrollId } = bankrollFilterSchema.parse(input)
  const userId = await requireUserId()
  const owns = await prisma.bankroll.findFirst({
    where: { id: bankrollId, userId },
    select: { id: true },
  })
  if (!owns) throw new Error(`Bankroll ${bankrollId} not found`)
  const rows = await prisma.bookmakerAccount.findMany({
    where: { bankrollId },
    orderBy: [{ isActive: 'desc' }, { bookmaker: 'asc' }],
  })
  return rows.map((r) => ({
    id: r.id,
    bookmaker: r.bookmaker,
    balance: r.balance,
    depositLimit: r.depositLimit,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  }))
}

const createBookmakerAccountSchema = z.object({
  bankrollId: z.number().int().positive(),
  bookmaker: z.string().min(1).max(60),
  balance: z.number().nonnegative().default(0),
  depositLimit: z.number().nonnegative().nullable().optional(),
})
export async function createBookmakerAccount(input: unknown) {
  const data = createBookmakerAccountSchema.parse(input)
  const userId = await requireUserId()
  const owns = await prisma.bankroll.findFirst({
    where: { id: data.bankrollId, userId },
    select: { id: true },
  })
  if (!owns) throw new Error(`Bankroll ${data.bankrollId} not found`)
  const r = await prisma.bookmakerAccount.create({
    data: {
      bankrollId: data.bankrollId,
      bookmaker: data.bookmaker,
      balance: data.balance,
      depositLimit: data.depositLimit ?? null,
    },
  })
  return { id: r.id }
}

const updateBookmakerAccountSchema = z.object({
  id: z.number().int().positive(),
  bookmaker: z.string().min(1).max(60).optional(),
  balance: z.number().optional(),
  depositLimit: z.number().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
})
export async function updateBookmakerAccount(input: unknown) {
  const data = updateBookmakerAccountSchema.parse(input)
  const userId = await requireUserId()
  const owns = await prisma.bookmakerAccount.findFirst({
    where: { id: data.id, bankroll: { userId } },
    select: { id: true },
  })
  if (!owns) throw new Error(`Bookmaker account ${data.id} not found`)
  const { id, ...patch } = data
  await prisma.bookmakerAccount.update({ where: { id }, data: patch })
  return { ok: true }
}

export async function deleteBookmakerAccount(input: unknown) {
  const { id } = idSchema.parse(input)
  const userId = await requireUserId()
  const owns = await prisma.bookmakerAccount.findFirst({
    where: { id, bankroll: { userId } },
    select: { id: true },
  })
  if (!owns) throw new Error(`Bookmaker account ${id} not found`)
  await prisma.bookmakerAccount.delete({ where: { id } })
  return { ok: true }
}

// ─── Ledger ────────────────────────────────────────────────────────────────

const ledgerListSchema = z.object({
  bankrollId: z.number().int().positive(),
  limit: z.number().int().min(1).max(500).default(50),
})
export async function getLedger(input: unknown) {
  const { bankrollId, limit } = ledgerListSchema.parse(input)
  const userId = await requireUserId()
  const owns = await prisma.bankroll.findFirst({
    where: { id: bankrollId, userId },
    select: { id: true },
  })
  if (!owns) throw new Error(`Bankroll ${bankrollId} not found`)
  const rows = await prisma.ledgerEntry.findMany({
    where: { bankrollId },
    orderBy: { ts: 'desc' },
    take: limit,
    select: {
      id: true,
      ticketId: true,
      placementId: true,
      kind: true,
      amount: true,
      balanceAfter: true,
      notes: true,
      ts: true,
    },
  })
  return rows.map((r) => ({ ...r, ts: r.ts.toISOString() }))
}

const recordLedgerSchema = z.object({
  bankrollId: z.number().int().positive(),
  kind: z.enum(['deposit', 'withdraw', 'adjust']),
  amount: z.number().positive(),
  notes: z.string().max(280).optional(),
})
export async function recordLedgerEntry(input: unknown) {
  const data = recordLedgerSchema.parse(input)
  const userId = await requireUserId()
  const bankroll = await prisma.bankroll.findFirst({
    where: { id: data.bankrollId, userId },
    select: { id: true, balance: true },
  })
  if (!bankroll) throw new Error(`Bankroll ${data.bankrollId} not found`)
  const delta = data.kind === 'deposit' ? data.amount : -data.amount
  const balanceAfter = bankroll.balance + delta
  if (balanceAfter < 0) throw new Error('Operation would result in negative balance')
  await prisma.$transaction([
    prisma.bankroll.update({ where: { id: bankroll.id }, data: { balance: balanceAfter } }),
    prisma.ledgerEntry.create({
      data: {
        bankrollId: bankroll.id,
        kind: data.kind,
        amount: delta,
        balanceAfter,
        notes: data.notes ?? null,
      },
    }),
  ])
  return { ok: true, balanceAfter }
}

// ─── Account summary (UI dashboard) ────────────────────────────────────────

const accountSummarySchema = z.object({
  bankrollId: z.number().int().positive().optional(),
})
export async function getAccountSummary(input: unknown) {
  const { bankrollId } = accountSummarySchema.parse(input ?? {})
  const userId = await requireUserId()

  const bankroll = bankrollId
    ? await prisma.bankroll.findFirst({ where: { id: bankrollId, userId } })
    : await prisma.bankroll.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'asc' },
      })
  if (!bankroll) return null

  const [bookmakerAccounts, recentLedger, ticketCounts] = await Promise.all([
    prisma.bookmakerAccount.findMany({
      where: { bankrollId: bankroll.id },
      orderBy: { bookmaker: 'asc' },
    }),
    prisma.ledgerEntry.findMany({
      where: { bankrollId: bankroll.id },
      orderBy: { ts: 'desc' },
      take: 10,
    }),
    prisma.ticket.groupBy({
      by: ['status'],
      where: { bankrollId: bankroll.id },
      _count: { _all: true },
    }),
  ])

  const ticketsByStatus: Record<string, number> = {}
  for (const c of ticketCounts) ticketsByStatus[c.status] = c._count._all

  return {
    bankroll: {
      id: bankroll.id,
      name: bankroll.name,
      type: bankroll.type,
      currency: bankroll.currency,
      startBalance: bankroll.startBalance,
      balance: bankroll.balance,
      kellyFraction: bankroll.kellyFraction,
      isActive: bankroll.isActive,
      pnl: bankroll.balance - bankroll.startBalance,
      pnlPct:
        bankroll.startBalance > 0
          ? ((bankroll.balance - bankroll.startBalance) / bankroll.startBalance) * 100
          : 0,
    },
    bookmakerAccounts: bookmakerAccounts.map((a) => ({
      id: a.id,
      bookmaker: a.bookmaker,
      balance: a.balance,
      depositLimit: a.depositLimit,
      isActive: a.isActive,
    })),
    recentLedger: recentLedger.map((l) => ({
      id: l.id,
      kind: l.kind,
      amount: l.amount,
      balanceAfter: l.balanceAfter,
      notes: l.notes,
      ts: l.ts.toISOString(),
    })),
    ticketsByStatus,
  }
}
