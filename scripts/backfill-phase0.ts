/**
 * Phase 0 backfill — run once after schema migration.
 * Idempotent: safe to re-run.
 *
 *   pnpm tsx scripts/backfill-phase0.ts
 */
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})
const prisma = new PrismaClient({ adapter })

const DEFAULT_USER_EMAIL = 'dev@local'
const DEFAULT_USER_NAME = 'Local Dev'
const DEFAULT_BANKROLL_NAME = 'Default Paper Bankroll'

type LegacySelection = {
  matchId?: number
  homeTeam?: string
  awayTeam?: string
  matchDate?: string | null
  sport?: string | null
  league?: string | null
  market?: string
  submarket?: string | null
  outcome?: string
  label?: string
  odds?: number
  bookmaker?: string
  modelProb?: number
}

async function main() {
  console.log('🔧 Phase 0 backfill starting...')

  // 1) Default user
  const user = await prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    update: {},
    create: { email: DEFAULT_USER_EMAIL, name: DEFAULT_USER_NAME },
  })
  console.log(`  user: ${user.email} (id=${user.id})`)

  // 2) Default bankroll
  let bankroll = await prisma.bankroll.findFirst({
    where: { userId: user.id, name: DEFAULT_BANKROLL_NAME },
  })
  if (!bankroll) {
    bankroll = await prisma.bankroll.create({
      data: {
        userId: user.id,
        name: DEFAULT_BANKROLL_NAME,
        type: 'paper',
        currency: 'EUR',
        startBalance: 1000,
        balance: 1000,
        kellyFraction: 0.5,
      },
    })
    console.log(`  bankroll: ${bankroll.name} (id=${bankroll.id})`)
  } else {
    console.log(`  bankroll exists (id=${bankroll.id})`)
  }

  // 3) Backfill existing tickets → link to bankroll + create TicketLeg rows
  const orphanTickets = await prisma.ticket.findMany({
    where: { bankrollId: null },
    include: { legs: true },
  })
  console.log(`  tickets without bankroll: ${orphanTickets.length}`)

  for (const t of orphanTickets) {
    let legCount = t.legs.length
    if (legCount === 0 && t.selections) {
      try {
        const sels = JSON.parse(t.selections) as LegacySelection[]
        if (Array.isArray(sels)) {
          await prisma.ticketLeg.createMany({
            data: sels.map((s) => ({
              ticketId: t.id,
              matchId: s.matchId ?? null,
              homeTeam: s.homeTeam ?? '',
              awayTeam: s.awayTeam ?? '',
              matchDate: s.matchDate ?? null,
              sport: s.sport ?? null,
              league: s.league ?? null,
              market: s.market ?? 'unknown',
              submarket: s.submarket ?? null,
              outcome: s.outcome ?? 'unknown',
              label: s.label ?? '',
              odds: s.odds ?? 1,
              bookmaker: s.bookmaker ?? 'unknown',
              modelProb: s.modelProb ?? null,
            })),
          })
          legCount = sels.length
        }
      } catch (err) {
        console.warn(`    ticket #${t.id}: failed to parse selections — ${(err as Error).message}`)
      }
    }
    await prisma.ticket.update({
      where: { id: t.id },
      data: { bankrollId: bankroll.id, status: t.status === 'draft' ? 'draft' : t.status },
    })
    console.log(`    ticket #${t.id}: linked → bankroll, ${legCount} legs`)
  }

  console.log('✅ Phase 0 backfill complete')
}

main()
  .catch((e) => {
    console.error('❌ backfill failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
