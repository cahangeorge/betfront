// Seed script for the tutorial: creates matches + odds + a successful prediction run
// so that "Generate ticket batch" produces tickets.
import { PrismaClient } from '../src/generated/prisma/client.ts'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./tutorial.db',
})
const prisma = new PrismaClient({ adapter })

const today = new Date()
const futureDate = (d: number) => {
  const x = new Date(today)
  x.setDate(x.getDate() + d)
  return x.toISOString().slice(0, 10)
}

const FIXTURES = [
  { home: 'Arsenal',          away: 'Chelsea',          league: 'England Premier League', day: 1, p_home: 0.55, p_draw: 0.22, p_away: 0.23, p_btts: 0.62, p_over: 0.58 },
  { home: 'Liverpool',        away: 'Manchester United',league: 'England Premier League', day: 1, p_home: 0.48, p_draw: 0.26, p_away: 0.26, p_btts: 0.66, p_over: 0.61 },
  { home: 'Manchester City',  away: 'Brighton',         league: 'England Premier League', day: 2, p_home: 0.71, p_draw: 0.18, p_away: 0.11, p_btts: 0.55, p_over: 0.68 },
  { home: 'Real Madrid',      away: 'Barcelona',        league: 'Spain La Liga',          day: 2, p_home: 0.42, p_draw: 0.28, p_away: 0.30, p_btts: 0.71, p_over: 0.64 },
  { home: 'Bayern Munich',    away: 'Dortmund',         league: 'Germany Bundesliga',     day: 3, p_home: 0.53, p_draw: 0.24, p_away: 0.23, p_btts: 0.69, p_over: 0.72 },
  { home: 'PSG',              away: 'Marseille',        league: 'France Ligue 1',         day: 3, p_home: 0.61, p_draw: 0.21, p_away: 0.18, p_btts: 0.58, p_over: 0.65 },
]

// Convert probability to odds with a small bookmaker margin
const toOdds = (p: number, margin = 0.06) => Math.round((1 / (p * (1 + margin))) * 100) / 100

async function main() {
  console.log('Seeding tutorial data…')

  // 1. Create a scrape job to anchor the matches
  const job = await prisma.scrapeJob.create({
    data: {
      source: 'OddsHarvester',
      command: 'upcoming',
      sport: 'football',
      markets: '1x2,btts,over_under_2_5',
      league: 'multi',
      date: futureDate(0).replaceAll('-', ''),
      status: 'success',
      finishedAt: new Date(),
    },
  })

  // 2. Create matches + odds
  const matches = []
  for (const f of FIXTURES) {
    const m = await prisma.match.create({
      data: {
        jobId: job.id,
        sport: 'football',
        league: f.league,
        homeTeam: f.home,
        awayTeam: f.away,
        matchDate: futureDate(f.day),
        odds: {
          create: [
            {
              market: '1x2',
              bookmaker: 'Pinnacle',
              oddsHome: toOdds(f.p_home),
              oddsDraw: toOdds(f.p_draw),
              oddsAway: toOdds(f.p_away),
            },
            {
              market: 'btts',
              bookmaker: 'Pinnacle',
              oddsYes: toOdds(f.p_btts),
              oddsNo: toOdds(1 - f.p_btts),
            },
            {
              market: 'over_under_2_5',
              submarket: 'over_under_2_5',
              bookmaker: 'Pinnacle',
              oddsOver: toOdds(f.p_over),
              oddsUnder: toOdds(1 - f.p_over),
            },
          ],
        },
      },
    })
    matches.push({ ...f, id: m.id })
  }

  // 3. Create a successful single-model prediction run with predictions
  const run = await prisma.predictionRun.create({
    data: {
      source: 'single',
      modelKey: 'penaltyblog-poisson',
      status: 'success',
      finishedAt: new Date(),
    },
  })

  for (const m of matches) {
    await prisma.modelPrediction.createMany({
      data: [
        { runId: run.id, matchId: m.id, modelKey: 'penaltyblog-poisson', market: '1x2', outcome: 'home', probability: m.p_home },
        { runId: run.id, matchId: m.id, modelKey: 'penaltyblog-poisson', market: '1x2', outcome: 'draw', probability: m.p_draw },
        { runId: run.id, matchId: m.id, modelKey: 'penaltyblog-poisson', market: '1x2', outcome: 'away', probability: m.p_away },
        { runId: run.id, matchId: m.id, modelKey: 'penaltyblog-poisson', market: 'btts', outcome: 'yes', probability: m.p_btts },
        { runId: run.id, matchId: m.id, modelKey: 'penaltyblog-poisson', market: 'btts', outcome: 'no',  probability: 1 - m.p_btts },
        { runId: run.id, matchId: m.id, modelKey: 'penaltyblog-poisson', market: 'ou_2_5', outcome: 'over',  probability: m.p_over },
        { runId: run.id, matchId: m.id, modelKey: 'penaltyblog-poisson', market: 'ou_2_5', outcome: 'under', probability: 1 - m.p_over },
      ],
    })
  }

  console.log(`Seeded: 1 job, ${matches.length} matches, 1 prediction run with ${matches.length * 7} predictions`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
