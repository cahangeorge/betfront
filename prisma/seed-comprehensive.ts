import { PrismaClient } from '../src/generated/prisma/client.js'

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})
const prisma = new PrismaClient({ adapter })

async function seed() {
  console.log('BetFront comprehensive seed\n')

  const userId = 1 // admin@betfront.com

  // ─── Bankrolls ─────────────────────────────────────────────
  const mainBankroll = await prisma.bankroll.create({
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
  console.log(`Bankroll #${mainBankroll.id}`)

  // ─── Bookmaker Accounts ────────────────────────────────────
  const bookies = ['bet365', 'pinnacle', 'betfair', 'unibet']
  for (const bookie of bookies) {
    await prisma.bookmakerAccount.create({
      data: {
        bankrollId: mainBankroll.id,
        bookmaker: bookie,
        balance: 250 + Math.floor(Math.random() * 500),
        isActive: true,
      },
    })
  }
  console.log(`Created ${bookies.length} bookmaker accounts`)

  // ─── Scrape Jobs + Matches ─────────────────────────────────
  const scrapeJob = await prisma.scrapeJob.create({
    data: {
      source: 'OddsHarvester',
      command: 'upcoming',
      sport: 'football',
      markets: '1x2,over_under,btts',
      league: 'EPL',
      status: 'success',
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  })

  const teamsPool = [
    ['Arsenal', 'Chelsea'], ['Man City', 'Liverpool'],
    ['Man Utd', 'Tottenham'], ['Newcastle', 'Aston Villa'],
    ['Brighton', 'West Ham'], ['Everton', 'Crystal Palace'],
    ['Fulham', 'Wolves'], ['Brentford', 'AFC Bournemouth'],
    ['Leeds', 'Leicester'], ['Southampton', 'Nottm Forest'],
  ]

  const matches = []
  const today = new Date()
  for (let i = 0; i < teamsPool.length; i++) {
    const [home, away] = teamsPool[i]
    const match = await prisma.match.create({
      data: {
        jobId: scrapeJob.id,
        sport: 'football',
        league: 'EPL',
        homeTeam: home,
        awayTeam: away,
        matchDate: new Date(today.getTime() + i * 86400000).toISOString().slice(0, 10),
        homeScore: i < 5 ? Math.floor(Math.random() * 4) : null,
        awayScore: i < 5 ? Math.floor(Math.random() * 4) : null,
      },
    })
    matches.push(match)

    // Odds entries for each match
    for (const bookie of ['bet365', 'pinnacle']) {
      await prisma.oddsEntry.create({
        data: {
          matchId: match.id,
          market: '1x2',
          bookmaker: bookie,
          oddsHome: 1.8 + Math.random() * 1.5,
          oddsDraw: 3.0 + Math.random() * 1.0,
          oddsAway: 2.5 + Math.random() * 2.0,
          oddsOver: 1.7 + Math.random(),
          oddsUnder: 1.9 + Math.random(),
          oddsYes: 1.8 + Math.random(),
          oddsNo: 1.85 + Math.random(),
        },
      })
    }
  }

  // Match stats for completed matches
  for (let i = 0; i < 5; i++) {
    await prisma.matchStat.create({
      data: {
        matchId: matches[i].id,
        source: 'fbref',
        xgHome: 1.2 + Math.random(),
        xgAway: 0.8 + Math.random(),
        possessionHome: 45 + Math.random() * 20,
        possessionAway: 100 - (45 + Math.random() * 20),
        shotsHome: 8 + Math.floor(Math.random() * 12),
        shotsAway: 6 + Math.floor(Math.random() * 10),
        shotsOnTargetHome: 3 + Math.floor(Math.random() * 5),
        shotsOnTargetAway: 2 + Math.floor(Math.random() * 4),
        cornersHome: 4 + Math.floor(Math.random() * 6),
        cornersAway: 3 + Math.floor(Math.random() * 5),
      },
    })
  }

  console.log(`Created ${matches.length} matches with odds and stats`)

  // ─── Ledger Entry ──────────────────────────────────────────
  await prisma.ledgerEntry.create({
    data: {
      bankrollId: mainBankroll.id,
      kind: 'deposit',
      amount: 1000,
      balanceAfter: 1000,
      notes: 'Initial deposit',
      ts: new Date(),
    },
  })

  // ─── Prediction Sessions ───────────────────────────────────
  const predSession = await prisma.predictionSession.create({
    data: {
      league: 'EPL',
      source: 'penaltyblog',
      model: 'PoissonGoalsModel',
      matchCount: 6,
    },
  })

  const predSession2 = await prisma.predictionSession.create({
    data: {
      league: 'EPL',
      source: 'sports-betting',
      model: 'Ensemble-XGBoost',
      matchCount: 4,
    },
  })

  // ─── Predictions ───────────────────────────────────────────
  for (let i = 0; i < Math.min(6, matches.length); i++) {
    const m = matches[i]
    const homeWin = 0.35 + Math.random() * 0.35
    const draw = 0.2 + Math.random() * 0.15
    const awayWin = 1 - homeWin - draw
    const over25 = 0.45 + Math.random() * 0.3
    const bttsYes = 0.4 + Math.random() * 0.35

    await prisma.prediction.create({
      data: {
        sessionId: predSession.id,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        matchDate: m.matchDate,
        league: m.league,
        homeWinProb: parseFloat(homeWin.toFixed(4)),
        drawProb: parseFloat(draw.toFixed(4)),
        awayWinProb: parseFloat(awayWin.toFixed(4)),
        predictedGoalsHome: parseFloat((homeWin * 3).toFixed(2)),
        predictedGoalsAway: parseFloat((awayWin * 3).toFixed(2)),
        predictedOutcome: homeWin > awayWin ? 'home_win' : awayWin > homeWin ? 'away_win' : 'draw',
        confidence: parseFloat(Math.max(homeWin, awayWin, draw).toFixed(4)),
        dc1X: parseFloat((homeWin + draw).toFixed(4)),
        dcX2: parseFloat((draw + awayWin).toFixed(4)),
        dc12: parseFloat((homeWin + awayWin).toFixed(4)),
        over15: parseFloat((over25 + 0.1).toFixed(4)),
        over25: parseFloat(over25.toFixed(4)),
        under25: parseFloat((1 - over25).toFixed(4)),
        bttsYes: parseFloat(bttsYes.toFixed(4)),
        bttsNo: parseFloat((1 - bttsYes).toFixed(4)),
        expectedValue: parseFloat((Math.random() * 0.15).toFixed(4)),
        isValueBet: Math.random() > 0.6,
      },
    })
  }

  for (let i = 6; i < Math.min(10, matches.length); i++) {
    const m = matches[i]
    const homeWin = 0.3 + Math.random() * 0.3
    const draw = 0.25 + Math.random() * 0.1
    const awayWin = 1 - homeWin - draw

    await prisma.prediction.create({
      data: {
        sessionId: predSession2.id,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        matchDate: m.matchDate,
        league: m.league,
        homeWinProb: parseFloat(homeWin.toFixed(4)),
        drawProb: parseFloat(draw.toFixed(4)),
        awayWinProb: parseFloat(awayWin.toFixed(4)),
        predictedGoalsHome: parseFloat((homeWin * 3).toFixed(2)),
        predictedGoalsAway: parseFloat((awayWin * 3).toFixed(2)),
        predictedOutcome: homeWin > awayWin ? 'home_win' : 'away_win',
        confidence: parseFloat(Math.max(homeWin, awayWin, draw).toFixed(4)),
        over25: parseFloat((0.4 + Math.random() * 0.3).toFixed(4)),
        bttsYes: parseFloat((0.35 + Math.random() * 0.3).toFixed(4)),
        isValueBet: Math.random() > 0.5,
      },
    })
  }

  console.log('Created 2 prediction sessions with predictions')

  // ─── Prediction Runs ───────────────────────────────────────
  const predRun = await prisma.predictionRun.create({
    data: {
      userId,
      league: 'EPL',
      windowStart: new Date(),
      windowEnd: new Date(today.getTime() + 7 * 86400000),
      source: 'frontbet',
      modelKey: 'ensemble_v1',
      status: 'completed',
      finishedAt: new Date(),
    },
  })

  for (let i = 0; i < 5; i++) {
    const m = matches[i]
    const probs = [0.45 + Math.random() * 0.25, 0.2 + Math.random() * 0.15, 0.25 + Math.random() * 0.2]
    const total = probs.reduce((a, b) => a + b, 0)
    probs[0] /= total
    probs[1] /= total
    probs[2] /= total

    await prisma.modelPrediction.create({
      data: {
        runId: predRun.id,
        matchId: m.id,
        modelKey: 'xgboost',
        market: '1x2',
        outcome: 'home',
        probability: parseFloat(probs[0].toFixed(4)),
        raw: JSON.stringify({ home: probs[0], draw: probs[1], away: probs[2] }),
      },
    })

    await prisma.modelPrediction.create({
      data: {
        runId: predRun.id,
        matchId: m.id,
        modelKey: 'poisson',
        market: 'over_under',
        outcome: 'over_2_5',
        probability: parseFloat((probs[0] + 0.1).toFixed(4)),
        raw: JSON.stringify({ over: probs[0] + 0.1, under: 1 - probs[0] - 0.1 }),
      },
    })
  }

  // Ensemble predictions
  for (let i = 0; i < 5; i++) {
    const m = matches[i]
    const prob = 0.5 + Math.random() * 0.3
    await prisma.ensemblePrediction.create({
      data: {
        runId: predRun.id,
        matchId: m.id,
        market: '1x2',
        outcome: 'home',
        probability: parseFloat(prob.toFixed(4)),
        weights: 'xgboost:0.6,poisson:0.4',
        contributingModels: 'xgboost,poisson',
      },
    })
  }

  console.log('Created prediction run with model+ensemble predictions')

  // ─── Ticket Batches ──────────────────────────────────────────
  const batch = await prisma.ticketBatch.create({
    data: {
      bankrollId: mainBankroll.id,
      name: 'Weekend Acca Build',
      strategy: 'highest-ev',
      ticketCount: 3,
    },
  })

  // ─── Tickets ───────────────────────────────────────────────
  for (let t = 0; t < 5; t++) {
    const selections = []
    const numLegs = 2 + Math.floor(Math.random() * 3)
    let combinedOdds = 1

    for (let l = 0; l < numLegs; l++) {
      const m = matches[(t + l) % matches.length]
      const odds = 1.7 + Math.random() * 2.0
      combinedOdds *= odds

      selections.push({
        matchId: m.id,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        market: '1x2',
        outcome: ['home', 'draw', 'away'][l % 3],
        label: `${m.homeTeam} win`,
        odds: parseFloat(odds.toFixed(2)),
        bookmaker: ['bet365', 'pinnacle'][l % 2],
        modelProb: 0.35 + Math.random() * 0.3,
        kellyFraction: 0.05,
      })
    }

    const stake = [10, 25, 50][t % 3]
    const ticket = await prisma.ticket.create({
      data: {
        name: `Ticket #${t + 1}`,
        currency: 'EUR',
        stake,
        bankroll: mainBankroll.balance * 0.02,
        selections: JSON.stringify(selections),
        combinedOdds: parseFloat(combinedOdds.toFixed(2)),
        combinedProbability: parseFloat((1 / combinedOdds).toFixed(4)),
        expectedValue: parseFloat((Math.random() * 0.5).toFixed(4)),
        potentialReturn: parseFloat((stake * combinedOdds).toFixed(2)),
        bankrollId: mainBankroll.id,
        batchId: t < 3 ? batch.id : null,
        strategy: ['highest-ev', 'value-mix', 'dutch'][t % 3],
        status: ['draft', 'placed', 'settled'][t % 3],
      },
    })

    // Create ticket legs
    for (const sel of selections) {
      await prisma.ticketLeg.create({
        data: {
          ticketId: ticket.id,
          matchId: sel.matchId,
          homeTeam: sel.homeTeam,
          awayTeam: sel.awayTeam,
          matchDate: matches.find((m) => m.id === sel.matchId)?.matchDate ?? null,
          sport: 'football',
          league: 'EPL',
          market: sel.market,
          submarket: null,
          outcome: sel.outcome,
          label: sel.label,
          odds: sel.odds,
          bookmaker: sel.bookmaker,
          modelProb: sel.modelProb,
          kellyFraction: sel.kellyFraction,
          legResult: t % 3 === 2 ? (Math.random() > 0.5 ? 'win' : 'loss') : null,
        },
      })
    }

    // Create bet placements for placed/settled tickets
    if (t % 3 > 0) {
      const placement = await prisma.betPlacement.create({
        data: {
          ticketId: ticket.id,
          bookmakerAccountId: (await prisma.bookmakerAccount.findFirst({ where: { bankrollId: mainBankroll.id } }))?.id ?? 1,
          stake: ticket.stake,
          status: t % 3 === 2 ? 'settled' : 'placed',
        },
      })

      if (t % 3 === 2) {
        const won = Math.random() > 0.4
        const ret = won ? ticket.potentialReturn : 0
        await prisma.settlement.create({
          data: {
            placementId: placement.id,
            outcome: won ? 'win' : 'loss',
            returnAmount: ret,
            profitLoss: ret - ticket.stake,
          },
        })

        // Ledger entry
        await prisma.ledgerEntry.create({
          data: {
            bankrollId: mainBankroll.id,
            ticketId: ticket.id,
            placementId: placement.id,
            kind: won ? 'payout' : 'loss',
            amount: won ? ret : -ticket.stake,
            balanceAfter: won ? mainBankroll.balance + ret - ticket.stake : mainBankroll.balance - ticket.stake,
            notes: `Ticket #${ticket.id} ${won ? 'won' : 'lost'}`,
          },
        })
      }
    }
  }

  console.log('Created 5 tickets with legs, placements, settlements')

  // ─── Scraped Datasets ────────────────────────────────────────
  await prisma.scrapedDataset.create({
    data: {
      source: 'fbref',
      operation: 'schedule',
      sport: 'football',
      league: 'EPL',
      season: '2024-25',
      rowCount: 380,
      data: JSON.stringify({ teams: teamsPool.map((t) => t[0]) }),
      summary: 'Full season schedule for English Premier League',
    },
  })

  await prisma.scrapedDataset.create({
    data: {
      source: 'penaltyblog',
      operation: 'history',
      sport: 'football',
      league: 'EPL',
      season: '2023-24',
      rowCount: 380,
      data: JSON.stringify({ matches: 'historical match results and stats' }),
      summary: 'Historical match results from Penaltyblog',
    },
  })

  console.log('Created 2 scraped datasets')

  // ─── Scheduled Jobs ────────────────────────────────────────
  await prisma.scheduledJob.create({
    data: {
      name: 'Daily Odds Scrape',
      kind: 'scrape',
      cron: '0 6 * * *',
      payload: JSON.stringify({ sport: 'football', leagues: ['EPL', 'La Liga'] }),
      isEnabled: true,
      lastRunAt: new Date(),
      lastStatus: 'success',
    },
  })

  console.log('Seed complete. Summary:')
  console.log(`  • User: ${userId} (bankrolls, predictions, tickets)`)
  console.log(`  • ${matches.length} matches with odds and stats`)
  console.log(`  • 2 prediction sessions with predictions`)
  console.log(`  • 1 prediction run with model+ensemble predictions`)
  console.log(`  • 1 ticket batch with 5 tickets (legs, placements, settlements)`)
}

seed()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
