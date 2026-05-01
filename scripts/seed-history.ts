// Seed historical finished matches per league so Pillar 3 can train.
import { PrismaClient } from '../src/generated/prisma/client.ts'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })

const TEAMS = {
  'England Premier League': ['Arsenal','Chelsea','Liverpool','Manchester United','Manchester City','Brighton','Tottenham','Newcastle','Aston Villa','West Ham'],
  'Spain La Liga':          ['Real Madrid','Barcelona','Atletico Madrid','Sevilla','Valencia','Villarreal','Real Sociedad','Athletic Bilbao','Real Betis','Girona'],
  'Germany Bundesliga':     ['Bayern Munich','Dortmund','Leverkusen','RB Leipzig','Stuttgart','Frankfurt','Wolfsburg','Hoffenheim','Mainz','Freiburg'],
  'France Ligue 1':         ['PSG','Marseille','Lyon','Monaco','Lille','Nice','Rennes','Lens','Reims','Toulouse'],
}

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

async function main() {
  const today = new Date('2026-04-29T00:00:00Z')
  const job = await prisma.scrapeJob.create({
    data: {
      source: 'OddsHarvester',
      command: 'historic',
      sport: 'football',
      markets: '1x2',
      league: 'multi',
      date: '20260101',
      status: 'success',
      finishedAt: new Date(),
    },
  })

  let total = 0
  for (const [league, teams] of Object.entries(TEAMS)) {
    const rng = seeded(league.length * 7919)
    // 60 matches per league, 1..120 days ago
    for (let i = 0; i < 60; i++) {
      const a = Math.floor(rng() * teams.length)
      let b = Math.floor(rng() * teams.length)
      if (b === a) b = (b + 1) % teams.length
      const home = teams[a]
      const away = teams[b]
      const homeScore = Math.floor(rng() * 4) // 0..3
      const awayScore = Math.floor(rng() * 4)
      const dayOffset = -(i + 1) * 2
      const d = new Date(today)
      d.setUTCDate(d.getUTCDate() + dayOffset)
      const matchDate = d.toISOString().slice(0, 10)
      await prisma.match.create({
        data: {
          jobId: job.id,
          sport: 'football',
          league,
          homeTeam: home,
          awayTeam: away,
          matchDate,
          homeScore,
          awayScore,
        },
      })
      total++
    }
  }
  console.log(`Seeded ${total} historical matches across ${Object.keys(TEAMS).length} leagues.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
