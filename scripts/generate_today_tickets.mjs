#!/usr/bin/env node
/**
 * Generate 7 tickets from today's matches.
 * Uses sqlite3 CLI via child_process to avoid native module issues.
 */
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync, unlinkSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = resolve(__dirname, '..', 'dev.db')
const TMP_SQL = resolve(__dirname, '..', '.tmp_tickets.sql')

function sqlJson(query) {
  writeFileSync(TMP_SQL, query)
  const out = execSync(`sqlite3 -json "${DB_PATH}" < "${TMP_SQL}"`, { encoding: 'utf-8', shell: true }).trim()
  return out ? JSON.parse(out) : []
}

function sqlExec(query) {
  writeFileSync(TMP_SQL, query)
  return execSync(`sqlite3 "${DB_PATH}" < "${TMP_SQL}"`, { encoding: 'utf-8', shell: true }).trim()
}

// ─── Get today's date ──────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10)
console.log(`Generating tickets for matches on ${today}...\n`)

// ─── Fetch matches with odds ───────────────────────────────────────────────────
const matches = sqlJson(
  `SELECT m.id, m.sport, m.league, m.homeTeam, m.awayTeam, m.matchDate
   FROM Match m
   WHERE EXISTS (SELECT 1 FROM OddsEntry o WHERE o.matchId = m.id)
     AND m.matchDate LIKE '${today}%'
   ORDER BY m.matchDate ASC`,
)

if (matches.length === 0) {
  console.error('No matches with odds found for today.')
  process.exit(1)
}

console.log(`Found ${matches.length} matches:`)
for (const m of matches) {
  console.log(`  [${m.id}] ${m.homeTeam} vs ${m.awayTeam} — ${m.matchDate}`)
}
console.log()

// ─── Aggregate best odds per match ─────────────────────────────────────────────
function getBestOdds(matchId) {
  const entries = sqlJson(`SELECT * FROM OddsEntry WHERE matchId = ${matchId}`)
  const best = {}
  for (const e of entries) {
    for (const [outcome, col] of [['home', 'oddsHome'], ['draw', 'oddsDraw'], ['away', 'oddsAway']]) {
      const odds = e[col]
      if (odds && odds > 1 && (!best[outcome] || odds > best[outcome].odds)) {
        best[outcome] = { odds, bookmaker: e.bookmaker }
      }
    }
  }
  return best
}

const matchData = matches.map((m) => ({ ...m, bestOdds: getBestOdds(m.id) }))

for (const m of matchData) {
  const h = m.bestOdds.home; const d = m.bestOdds.draw; const a = m.bestOdds.away
  console.log(`  ${m.homeTeam} vs ${m.awayTeam}: H=${h?.odds}(${h?.bookmaker}) D=${d?.odds}(${d?.bookmaker}) A=${a?.odds}(${a?.bookmaker})`)
}
console.log()

// ─── Selection builder ─────────────────────────────────────────────────────────
function makeSelection(match, outcome) {
  const best = match.bestOdds[outcome]
  if (!best) throw new Error(`No odds for ${outcome} on match ${match.id}`)

  const labels = {
    home: `${match.homeTeam} Win`,
    draw: 'Draw',
    away: `${match.awayTeam} Win`,
  }

  return {
    matchId: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    matchDate: match.matchDate,
    sport: match.sport,
    league: match.league,
    market: '1x2',
    submarket: 'FullTime',
    outcome,
    label: labels[outcome],
    odds: best.odds,
    bookmaker: best.bookmaker,
  }
}

// ─── Stats calculator ──────────────────────────────────────────────────────────
function calcStats(selections, stake) {
  const combinedOdds = selections.reduce((a, s) => a * s.odds, 1)
  const combinedProbability = selections.reduce((a, s) => a * (1 / s.odds), 1)
  const expectedValue = combinedProbability * combinedOdds - 1
  const potentialReturn = stake * combinedOdds
  return {
    combinedOdds: +combinedOdds.toFixed(2),
    combinedProbability: +combinedProbability.toFixed(4),
    expectedValue: +expectedValue.toFixed(4),
    potentialReturn: +potentialReturn.toFixed(2),
  }
}

// ─── Define 7 ticket strategies ────────────────────────────────────────────────
const STAKE = 10
const BANKROLL = 1000
const CURRENCY = '€'

const ticketDefs = []

// With 3 matches indexed 0,1,2
const [m0, m1, m2] = matchData

// Ticket 1: "Favorites Treble" — all home wins
ticketDefs.push({
  name: 'Favorites Treble',
  selections: [
    makeSelection(m0, 'home'),
    makeSelection(m1, 'home'),
    makeSelection(m2, 'home'),
  ],
})

// Ticket 2: "Draw Specialist" — all draws
ticketDefs.push({
  name: 'Draw Specialist',
  selections: [
    makeSelection(m0, 'draw'),
    makeSelection(m1, 'draw'),
    makeSelection(m2, 'draw'),
  ],
})

// Ticket 3: "Upset Special" — all away wins
ticketDefs.push({
  name: 'Upset Special',
  selections: [
    makeSelection(m0, 'away'),
    makeSelection(m1, 'away'),
    makeSelection(m2, 'away'),
  ],
})

// Ticket 4: "Conservative Double" — two strongest favorites
ticketDefs.push({
  name: 'Conservative Double',
  selections: [
    makeSelection(m0, 'home'),
    makeSelection(m2, 'home'),
  ],
})

// Ticket 5: "Balanced Mix" — favorite + draw + favorite
ticketDefs.push({
  name: 'Balanced Mix',
  selections: [
    makeSelection(m0, 'home'),
    makeSelection(m1, 'draw'),
    makeSelection(m2, 'home'),
  ],
})

// Ticket 6: "Value Double" — draw + away on balanced match
ticketDefs.push({
  name: 'Value Double',
  selections: [
    makeSelection(m2, 'draw'),
    makeSelection(m1, 'away'),
  ],
})

// Ticket 7: "High Risk Single" — biggest underdog
ticketDefs.push({
  name: 'High Risk Single',
  selections: [makeSelection(m0, 'away')],
})

// ─── Insert tickets ────────────────────────────────────────────────────────────
const results = []
for (const def of ticketDefs) {
  const stats = calcStats(def.selections, STAKE)
  const selectionsJson = JSON.stringify(def.selections).replace(/'/g, "''")
  const name = def.name.replace(/'/g, "''")
  sqlExec(
    `INSERT INTO Ticket (name, currency, stake, bankroll, selections, combinedOdds, combinedProbability, expectedValue, potentialReturn, createdAt)
     VALUES ('${name}', '${CURRENCY}', ${STAKE}, ${BANKROLL}, '${selectionsJson}', ${stats.combinedOdds}, ${stats.combinedProbability}, ${stats.expectedValue}, ${stats.potentialReturn}, datetime('now'));`,
  )
  const lastIdRows = sqlJson('SELECT last_insert_rowid() as id')
  const lastId = lastIdRows[0]?.id ?? '?'
  results.push({ id: lastId, name: def.name, legs: def.selections.length, ...stats })
}

try { unlinkSync(TMP_SQL) } catch {}

console.log('✅ Created 7 tickets:\n')
for (const t of results) {
  console.log(`  #${t.id} "${t.name}" — ${t.legs} leg(s), odds ${t.combinedOdds}, return ${CURRENCY}${t.potentialReturn}`)
}
console.log('\nDone.')
