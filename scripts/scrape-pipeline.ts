// Orchestration script: scrape upcoming matches + team histories
// Run from /root/betfront with: DATABASE_URL="file:./dev.db" npx tsx scripts/scrape-pipeline.ts

import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

// We'll import server functions directly to create proper job records
// @ts-ignore - esm path resolution
import * as scraper from '../src/server/scraper.ts'
// @ts-ignore
import * as soccerdata from '../src/server/soccerdata.ts'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('=== BETFRONT SCRAPE PIPELINE ===\n')

  // ─── 1. Bankroll check ──────────────────────────────────────
  const userId = 1
  const bankrolls = await prisma.bankroll.findMany({ where: { userId } })
  if (bankrolls.length === 0) {
    console.log('No bankroll found. Creating default bankroll...')
    await prisma.bankroll.create({
      data: {
        userId,
        name: 'Main Paper Bankroll',
        type: 'paper',
        currency: 'EUR',
        startBalance: 1000,
        balance: 1000,
        kellyFraction: 0.5,
      },
    })
  } else {
    console.log(`✓ Bankroll: ${bankrolls.map(b => `${b.name} (${b.balance} ${b.currency})`).join(', ')}`)
  }

  // ─── 2. Scrape upcoming matches ─────────────────────────────
  // UTC+2 hours 20:00-04:00 means we need May 21 evening + May 22/23 dates
  const dates = ['20260521', '20260522', '20260523']
  const leagues = [
    { sport: 'football', league: 'usa-mls', label: 'USA MLS' },
    { sport: 'football', league: 'brazil-serie-a', label: 'Brazil Serie A' },
    { sport: 'football', league: 'japan-j1-league', label: 'Japan J1 League' },
  ]

  const upcomingJobs: Array<{ jobId: number; date: string; league: string }> = []

  for (const d of dates) {
    for (const l of leagues) {
      console.log(`\n→ Scraping upcoming: ${l.label} | date=${d}`)
      try {
        const result = await scraper.runUpcoming({
          sport: l.sport,
          league: l.league,
          date: d,
          markets: '1x2,over_under,btts',
          headless: true,
          outputFormat: 'json',
        })
        upcomingJobs.push({ jobId: result.jobId, date: d, league: l.league })
        console.log(`  Created job #${result.jobId}`)
      } catch (e: any) {
        console.log(`  ERROR: ${e.message}`)
      }
    }
  }

  // Wait a bit for jobs to start processing (they run in background)
  console.log('\n→ Waiting 10s for jobs to start...')
  await new Promise(r => setTimeout(r, 10000))

  // Check which jobs succeeded
  let totalNewMatches = 0
  const scrapedTeams = new Set<string>()
  const scrapedLeagues = new Set<string>()

  for (const jobInfo of upcomingJobs) {
    const job = await prisma.scrapeJob.findUnique({ where: { id: jobInfo.jobId } })
    if (job && job.status === 'success') {
      const matchCount = await prisma.match.count({ where: { jobId: job.id } })
      totalNewMatches += matchCount
      console.log(`  Job #${job.id} [${jobInfo.league} ${jobInfo.date}]: ${matchCount} matches`)

      // Collect teams for history scraping
      const matches = await prisma.match.findMany({
        where: { jobId: job.id },
        select: { homeTeam: true, awayTeam: true, league: true },
      })
      for (const m of matches) {
        scrapedTeams.add(m.homeTeam)
        scrapedTeams.add(m.awayTeam)
        if (m.league) scrapedLeagues.add(m.league)
      }
    } else {
      console.log(`  Job #${jobInfo.jobId}: status=${job?.status ?? 'unknown'}`)
    }
  }

  console.log(`\n→ Total new matches: ${totalNewMatches}`)
  console.log(`→ Teams to look up history: ${scrapedTeams.size}`)

  // ─── 3. Scrape team histories ───────────────────────────────
  // We use FBref for detailed stats (defense, possession, misc → cards, fouls, offsides)
  // We use MatchHistory for historical game results

  // First, map league slugs to soccerdata league names
  const leagueMapping: Record<string, { fbref: string; season: string }> = {
    'usa-mls': { fbref: 'USA-Major League Soccer', season: '2025' },
    'brazil-serie-a': { fbref: 'BRA-Serie A', season: '2025' },
    'japan-j1-league': { fbref: 'JPN-J1 League', season: '2025' },
  }

  console.log('\n=== TEAM HISTORY SCRAPING ===')

  // Scrape FBref schedule (contains past match data with scores and xG)
  for (const [slug, mapping] of Object.entries(leagueMapping)) {
    console.log(`\n→ FBref schedule: ${mapping.fbref} (${mapping.season})`)
    try {
      // @ts-ignore
      const result = await soccerdata.getFBrefSchedule({
        league: mapping.fbref,
        season: mapping.season,
        limit: 100,
        refresh: false,
      })
      console.log(`  Got ${result.rows.length} schedule rows`)

      // Persist as a scraped dataset + match history entries
      const job = await prisma.scrapeJob.create({
        data: {
          source: 'FBref',
          command: 'schedule',
          sport: 'football',
          markets: 'schedule',
          league: slug,
          season: mapping.season,
          status: 'success',
          output: JSON.stringify({ count: result.rows.length }),
          finishedAt: new Date(),
        },
      })

      for (const row of result.rows) {
        if (!row.homeTeam || !row.awayTeam) continue
        // Only store rows with scores (completed matches)
        if (row.score) {
          await prisma.match.upsert({
            where: {
              // Use a unique constraint on homeTeam+awayTeam+matchDate
              // Since we don't have a composite unique key, we'll create with a jobId
            },
            create: {
              jobId: job.id,
              sport: 'football',
              league: slug,
              homeTeam: row.homeTeam,
              awayTeam: row.awayTeam,
              matchDate: row.date ?? null,
              homeScore: row.score ? parseInt(row.score.split('-')[0]) || null : null,
              awayScore: row.score ? parseInt(row.score.split('-')[1]) || null : null,
            },
            update: {
              homeScore: row.score ? parseInt(row.score.split('-')[0]) || null : null,
              awayScore: row.score ? parseInt(row.score.split('-')[1]) || null : null,
            },
          } as any).catch(() => {})
        }
      }
    } catch (e: any) {
      console.log(`  ERROR: ${e.message}`)
    }
  }

  // Scrape FBref team stats for detailed metrics (cards, fouls, offsides)
  const statTypes = ['defense', 'possession', 'misc'] as const
  for (const [slug, mapping] of Object.entries(leagueMapping)) {
    for (const statType of statTypes) {
      console.log(`\n→ FBref team stats: ${mapping.fbref} | ${statType}`)
      try {
        // @ts-ignore
        const result = await soccerdata.getFBrefTeamStats({
          league: mapping.fbref,
          season: mapping.season,
          stat_type: statType,
          limit: 40,
          refresh: false,
        })
        console.log(`  Got ${result.rows.length} team stat rows`)

        // Store in ScrapedDataset for reference
        await prisma.scrapedDataset.create({
          data: {
            source: 'FBref',
            operation: 'team_stats',
            sport: 'football',
            league: slug,
            season: mapping.season,
            rowCount: result.rows.length,
            data: JSON.stringify({ statType, columns: result.columns, rows: result.rows.slice(0, 5) }),
            summary: `${mapping.fbref} ${statType} stats (${result.rows.length} rows)`,
          },
        }).catch(() => {})
      } catch (e: any) {
        console.log(`  ERROR: ${e.message}`)
      }
    }
  }

  // Scrape MatchHistory for historical games
  for (const [slug, mapping] of Object.entries(leagueMapping)) {
    console.log(`\n→ MatchHistory games: ${mapping.fbref} (${mapping.season})`)
    try {
      // @ts-ignore
      const result = await soccerdata.getMatchHistoryGames({
        league: mapping.fbref,
        season: mapping.season,
        limit: 100,
        refresh: false,
      })
      console.log(`  Got ${result.rows.length} historical games`)

      // Store as dataset
      await prisma.scrapedDataset.create({
        data: {
          source: 'MatchHistory',
          operation: 'games',
          sport: 'football',
          league: slug,
          season: mapping.season,
          rowCount: result.rows.length,
          data: JSON.stringify(result.rows.slice(0, 10)),
          summary: `${result.rows.length} historical games for ${slug}`,
        },
      }).catch(() => {})
    } catch (e: any) {
      console.log(`  ERROR: ${e.message}`)
    }
  }

  // ─── 4. Summary ────────────────────────────────────────────
  console.log('\n=== PIPELINE COMPLETE ===')
  const finalCounts = {
    matches: await prisma.match.count(),
    odds: await prisma.oddsEntry.count(),
    datasets: await prisma.scrapedDataset.count(),
    jobs: await prisma.scrapeJob.count(),
  }
  console.log(`DB totals:`)
  console.log(`  Matches:        ${finalCounts.matches}`)
  console.log(`  Odds entries:   ${finalCounts.odds}`)
  console.log(`  Scraped datasets: ${finalCounts.datasets}`)
  console.log(`  Scrape jobs:    ${finalCounts.jobs}`)
}

main()
  .catch((e) => {
    console.error('Pipeline error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
