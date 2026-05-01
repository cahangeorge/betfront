// Match + odds persistence: parse oddsharvester JSON output and upsert into DB.
// Writes to Match + OddsEntry; mirrors a summary into ScrapedDataset and tags
// MatchSource so we can dedupe/correlate across providers later.

import { readFile } from 'node:fs/promises'

import { prisma } from '#/db'

type ParsedOddsEntry = {
  market: string
  submarket: string | null
  bookmaker: string
  oddsHome: number | null
  oddsDraw: number | null
  oddsAway: number | null
  oddsOver: number | null
  oddsUnder: number | null
  oddsYes: number | null
  oddsNo: number | null
}

type ParsedMatch = {
  jobId: number
  sport: string
  league: string | null
  homeTeam: string
  awayTeam: string
  matchDate: string | null
  matchUrl: string | null
  homeScore: number | null
  awayScore: number | null
  odds: ParsedOddsEntry[]
}

function buildOddsEntries(raw: any): ParsedOddsEntry[] {
  const entries: ParsedOddsEntry[] = []

  // oddsharvester JSON uses keys like '1x2_market', 'btts_market', etc.
  for (const key of Object.keys(raw)) {
    if (!key.endsWith('_market')) continue
    const market = key.replace(/_market$/, '')
    const bookmakers = raw[key]
    if (!Array.isArray(bookmakers)) continue

    for (const entry of bookmakers) {
      if (typeof entry !== 'object' || !entry) continue
      const num = (v: unknown) => (v != null && v !== '-' ? Number(v) : null)
      entries.push({
        market,
        submarket: entry.period ?? null,
        bookmaker: entry.bookmaker_name ?? '',
        oddsHome: num(entry['1'] ?? entry['1X'] ?? entry['dnb_team1'] ?? entry['team1_handicap']),
        oddsDraw: num(entry['X'] ?? entry['12'] ?? entry['draw_handicap']),
        oddsAway: num(entry['2'] ?? entry['X2'] ?? entry['dnb_team2'] ?? entry['team2_handicap']),
        oddsOver: num(entry['over'] ?? entry['odds_over']),
        oddsUnder: num(entry['under'] ?? entry['odds_under']),
        oddsYes: num(entry['yes'] ?? entry['btts_yes']),
        oddsNo: num(entry['no'] ?? entry['btts_no']),
      })
    }
  }
  return entries
}

function parseScrapedMatches(jsonData: unknown[], sport: string, jobId: number): ParsedMatch[] {
  return jsonData.map((raw: any) => ({
    jobId,
    sport,
    league: raw.league_name ?? raw.league ?? raw.tournament ?? null,
    homeTeam: raw.home_team ?? raw.home ?? '',
    awayTeam: raw.away_team ?? raw.away ?? '',
    matchDate: raw.match_date ?? raw.date ?? null,
    matchUrl: raw.match_link ?? raw.url ?? raw.match_url ?? null,
    homeScore: raw.home_score != null ? Number(raw.home_score) : null,
    awayScore: raw.away_score != null ? Number(raw.away_score) : null,
    odds: buildOddsEntries(raw),
  }))
}

// Tag a match with its provenance (Phase 2 enrichment).
async function tagMatchSource(matchId: number, externalUrl: string | null) {
  if (!externalUrl) return
  await prisma.matchSource
    .upsert({
      where: { matchId_source: { matchId, source: 'OddsHarvester' } },
      create: { matchId, source: 'OddsHarvester', externalId: null, url: externalUrl, lastSeen: new Date() },
      update: { url: externalUrl, lastSeen: new Date() },
    })
    .catch(() => {})
}

export async function persistMatches(
  jsonPath: string,
  sport: string,
  jobId: number,
): Promise<Map<string, number>> {
  const matchMap = new Map<string, number>()
  let raw: unknown[]
  try {
    const text = await readFile(jsonPath, 'utf-8')
    raw = JSON.parse(text)
    if (!Array.isArray(raw)) raw = [raw]
  } catch {
    return matchMap // no output file, CLI probably failed
  }

  const parsed = parseScrapedMatches(raw, sport, jobId)
  for (const m of parsed) {
    // Upsert: check for existing match by (homeTeam, awayTeam, matchDate, sport) to avoid duplicates
    const existing = m.matchDate
      ? await prisma.match.findFirst({
          where: { homeTeam: m.homeTeam, awayTeam: m.awayTeam, matchDate: m.matchDate, sport: m.sport },
          orderBy: { id: 'desc' },
        })
      : null

    let match: { id: number }
    if (existing) {
      match = await prisma.match.update({
        where: { id: existing.id },
        data: {
          jobId: m.jobId,
          ...(m.homeScore != null ? { homeScore: m.homeScore } : {}),
          ...(m.awayScore != null ? { awayScore: m.awayScore } : {}),
          ...(m.matchUrl ? { matchUrl: m.matchUrl } : {}),
        },
      })
    } else {
      match = await prisma.match.create({
        data: {
          jobId: m.jobId,
          sport: m.sport,
          league: m.league,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          matchDate: m.matchDate,
          matchUrl: m.matchUrl,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
        },
      })
    }
    if (m.odds.length > 0) {
      if (existing) {
        // Remove old odds for this match before inserting new ones
        await prisma.oddsEntry.deleteMany({ where: { matchId: match.id } })
      }
      await prisma.oddsEntry.createMany({
        data: m.odds.map((o) => ({ ...o, matchId: match.id })),
      })
    }
    await tagMatchSource(match.id, m.matchUrl)
    matchMap.set(`${m.homeTeam}|${m.awayTeam}`, match.id)
  }

  // Also save to ScrapedDataset for unified history
  const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } })
  if (job && parsed.length > 0) {
    const rows = parsed.map((m) => ({
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      matchDate: m.matchDate,
      league: m.league,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      oddsCount: m.odds.length,
    }))
    await prisma.scrapedDataset.create({
      data: {
        source: 'OddsHarvester',
        operation: job.command,
        sport,
        league: job.league,
        season: job.season,
        date: job.date,
        rowCount: rows.length,
        data: JSON.stringify(rows),
        summary: JSON.stringify({
          jobId,
          sport,
          command: job.command,
          markets: job.markets,
          matchCount: parsed.length,
        }),
      },
    })
  }

  return matchMap
}

// Add odds entries from an extra-period output file to already-created match rows
export async function persistPeriodOdds(
  jsonPath: string,
  sport: string,
  matchMap: Map<string, number>,
): Promise<void> {
  let raw: unknown[]
  try {
    const text = await readFile(jsonPath, 'utf-8')
    raw = JSON.parse(text)
    if (!Array.isArray(raw)) raw = [raw]
  } catch {
    return // output file missing or parse error
  }

  const parsed = parseScrapedMatches(raw, sport, 0)
  for (const m of parsed) {
    const matchId = matchMap.get(`${m.homeTeam}|${m.awayTeam}`)
    if (!matchId || m.odds.length === 0) continue
    await prisma.oddsEntry.createMany({
      data: m.odds.map((o) => ({ ...o, matchId })),
    })
  }
}
