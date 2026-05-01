// Generate a ticket batch via the server fn directly (bypasses buggy panel wrapper)
import { generateTicketBatch } from '../src/server/tickets/builder.ts'
import { PrismaClient } from '../src/generated/prisma/client.ts'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

process.env.DATABASE_URL ??= 'file:./tutorial.db'

// Find first bankroll
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const bankroll = await prisma.bankroll.findFirst({ orderBy: { id: 'desc' } })
if (!bankroll) throw new Error('No bankroll — did you log in via the UI first?')

const result = await generateTicketBatch({
  bankrollId: bankroll.id,
  strategy: 'highest-ev',
  ticketCount: 5,
  legsPerTicket: 3,
  stake: 10,
  swapMatches: true,
  minLegOverlap: 1,
  edgeThreshold: 0.05,
  kellyCap: 0.05,
  randomTemperature: 1.0,
  markets: ['1x2', 'btts', 'ou_2_5'],
  name: 'Tutorial batch · highest-EV',
})
console.log('Generated batch:', result)
await prisma.$disconnect()
