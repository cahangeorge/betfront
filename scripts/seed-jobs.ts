import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })

const existing = await prisma.scheduledJob.count()
if (existing > 0) {
  console.log(`skip: ${existing} scheduled jobs already exist`)
} else {
  const seeds = [
    { name: 'Daily upcoming scrape', kind: 'scrape_upcoming', cron: '0 8 * * *', isEnabled: false, payload: JSON.stringify({}) },
    { name: 'Hourly arbitrage scan', kind: 'arbitrage_scan', cron: '0 * * * *', isEnabled: false, payload: JSON.stringify({ markets: ['1x2'], minMargin: 0.01, windowDays: 7, limit: 25 }) },
    { name: 'Weekly history backfill', kind: 'scrape_history', cron: '0 6 * * 1', isEnabled: false, payload: JSON.stringify({}) },
  ]
  for (const s of seeds) await prisma.scheduledJob.create({ data: s })
  console.log(`seeded ${seeds.length} scheduled jobs (all disabled by default)`)
}

await prisma.$disconnect()
