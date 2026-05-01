import { spawnLogged as spawn } from '#/server/dev-log'
import { readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

const SOCCERDATA_PYTHON = path.resolve(`${import.meta.dirname}/../../../soccerdata/.venv/bin/python`)
const SOCCERDATA_BRIDGE = path.resolve(`${import.meta.dirname}/../../scripts/soccerdata_bridge.py`)

export type SoccerDataCatalog = {
  espnLeagues: Array<{ label: string; value: string; sourceId: string }>
  clubEloLeagues: Array<{ label: string; value: string }>
  matchHistoryLeagues: Array<{ label: string; value: string; sourceId: string }>
  fbrefLeagues: Array<{ label: string; value: string; sourceId: string }>
  sofascoreLeagues: Array<{ label: string; value: string; sourceId: string }>
  understatLeagues: Array<{ label: string; value: string }>
  sofifaLeagues: Array<{ label: string; value: string }>
  whoscoredLeagues: Array<{ label: string; value: string; sourceId: string }>
}

export type EspnScheduleRow = {
  league: string
  season: string
  game: string
  date: string
  homeTeam: string
  awayTeam: string
  gameId: number
  leagueId: string
}

export type ClubEloRow = {
  team: string
  rank: number | null
  elo: number | null
  league: string | null
  country: string | null
  from: string | null
  to: string | null
}

export type MatchHistoryRow = {
  league: string
  season: string
  game: string
  date: string
  homeTeam: string
  awayTeam: string
  homeGoals: number | null
  awayGoals: number | null
  result: string | null
}

export type FBrefScheduleRow = {
  league: string
  season: string
  game: string
  date: string
  time: string | null
  homeTeam: string
  awayTeam: string
  score: string | null
  venue: string | null
  week: number | string | null
  attendance: number | null
  homeXg: number | null
  awayXg: number | null
}

export type EspnScheduleResult = {
  rows: EspnScheduleRow[]
  summary: {
    league: string
    season: string
    count: number
    source: 'ESPN'
    refresh: boolean
  }
}

export type ClubEloResult = {
  rows: ClubEloRow[]
  summary: {
    date: string
    league?: string
    count: number
    source: 'ClubElo'
    refresh: boolean
  }
}

export type MatchHistoryResult = {
  rows: MatchHistoryRow[]
  summary: {
    league: string
    season: string
    count: number
    source: 'MatchHistory'
    refresh: boolean
  }
}

export type FBrefScheduleResult = {
  rows: FBrefScheduleRow[]
  summary: {
    league: string
    season: string
    count: number
    source: 'FBref'
    refresh: boolean
  }
}

export type FBrefTeamStatsRow = Record<string, string | number | null>

export type FBrefTeamStatsResult = {
  rows: FBrefTeamStatsRow[]
  columns: string[]
  summary: {
    league: string
    season: string
    statType: string
    count: number
    source: 'FBref'
    refresh: boolean
  }
}

export type ClubEloHistoryRow = {
  date: string | null
  team: string
  elo: number | null
  rank: number | null
  league: string | null
  country: string | null
}

export type ClubEloHistoryResult = {
  rows: ClubEloHistoryRow[]
  summary: {
    team: string
    count: number
    source: 'ClubElo'
    refresh: boolean
  }
}

export type SofascoreStandingsRow = {
  pos: number
  team: string
  mp: number | null
  won: number | null
  drawn: number | null
  lost: number | null
  gf: number | null
  ga: number | null
  gd: number | null
  pts: number | null
}

export type SofascoreStandingsResult = {
  rows: SofascoreStandingsRow[]
  summary: {
    league: string
    season: string
    count: number
    source: 'Sofascore'
    refresh: boolean
  }
}

export type FBrefShotRow = {
  game: string | null
  date: string | null
  team: string | null
  player: string | null
  minute: number | string | null
  xg: number | null
  psxg: number | null
  outcome: string | null
  distance: number | null
  bodyPart: string | null
  notes: string | null
}

export type FBrefShotResult = {
  rows: FBrefShotRow[]
  summary: {
    league: string
    season: string
    gameId: string | null
    count: number
    source: 'FBref'
    refresh: boolean
  }
}

const espnScheduleSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  limit: z.number().int().min(1).max(100).default(20),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

const clubEloSchema = z.object({
  date: z.string().min(10),
  league: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

const matchHistorySchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  limit: z.number().int().min(1).max(100).default(20),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

const fbrefScheduleSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  limit: z.number().int().min(1).max(100).default(20),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

async function runBridge<T>(payload: Record<string, unknown>): Promise<T> {
  const outputPath = `/tmp/frontbet_soccerdata_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
  console.log('[bridge] starting:', payload.operation, 'output:', outputPath)

  return new Promise((resolve, reject) => {
    const proc = spawn(SOCCERDATA_PYTHON, [SOCCERDATA_BRIDGE, '--payload', JSON.stringify(payload), '--output', outputPath], {
      detached: true,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
    })

    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    // Detached process group — kill with negative PID to reach all children
    const timeout = setTimeout(() => {
      try { process.kill(-proc.pid!, 'SIGTERM') } catch { /* already exited */ }
      reject(new Error('soccerdata request timed out'))
    }, 180_000)

    proc.on('close', async (code) => {
      clearTimeout(timeout)
      console.log('[bridge] close:', payload.operation, 'code:', code, 'stderr:', stderr.slice(0, 200))

      // Process killed by signal (code === null) — no output file exists
      if (code === null) {
        reject(new Error(stderr.trim() || `soccerdata bridge killed by signal (${payload.operation})`))
        return
      }

      try {
        const text = await readFile(outputPath, 'utf-8')
        const parsed = JSON.parse(text) as { ok: boolean; result?: T; error?: string }
        await unlink(outputPath).catch(() => undefined)

        if (!parsed.ok || code !== 0) {
          console.log('[bridge] error:', parsed.error ?? stderr.trim())
          reject(new Error(parsed.error ?? (stderr.trim() || 'soccerdata bridge failed')))
          return
        }

        console.log('[bridge] success:', payload.operation, 'result keys:', Object.keys(parsed.result as object).join(','))
        resolve(parsed.result as T)
      } catch (error) {
        console.log('[bridge] read error:', error)
        reject(error instanceof Error ? error : new Error('Failed to read soccerdata response'))
      }
    })

    proc.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

export async function getSoccerDataCatalog() {
  return runBridge<SoccerDataCatalog>({ operation: 'catalog' })

}
export async function getEspnSchedule(_input: unknown) {
  const data = ((data: z.infer<typeof espnScheduleSchema>) => espnScheduleSchema.parse(data))(_input as any);

    try {
      return await runBridge<EspnScheduleResult>({
        operation: 'espn_schedule',
        ...data,
      })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load ESPN schedule')
    }
  
}
export async function getClubEloRatings(_input: unknown) {
  const data = ((data: z.infer<typeof clubEloSchema>) => clubEloSchema.parse(data))(_input as any);

    try {
      return await runBridge<ClubEloResult>({
        operation: 'clubelo_ratings',
        ...data,
      })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load ClubElo ratings')
    }
  
}
export async function getMatchHistoryGames(_input: unknown) {
  const data = ((data: z.infer<typeof matchHistorySchema>) => matchHistorySchema.parse(data))(_input as any);

    try {
      return await runBridge<MatchHistoryResult>({
        operation: 'matchhistory_games',
        ...data,
      })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load MatchHistory games')
    }
  
}
export async function getFBrefSchedule(_input: unknown) {
  const data = ((data: z.infer<typeof fbrefScheduleSchema>) => fbrefScheduleSchema.parse(data))(_input as any);

    try {
      return await runBridge<FBrefScheduleResult>({
        operation: 'fbref_schedule',
        ...data,
      })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load FBref schedule')
    }
  
}
const fbrefTeamStatsSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  stat_type: z.enum(['standard', 'keeper', 'keeper_adv', 'shooting', 'passing', 'passing_types', 'goal_shot_creation', 'defense', 'possession', 'playing_time', 'misc']).default('standard'),
  limit: z.number().int().min(1).max(100).default(40),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getFBrefTeamStats(_input: unknown) {
  const data = ((data: z.infer<typeof fbrefTeamStatsSchema>) => fbrefTeamStatsSchema.parse(data))(_input as any);

    try {
      return await runBridge<FBrefTeamStatsResult>({
        operation: 'fbref_team_stats',
        ...data,
      })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load FBref team stats')
    }
  
}
const clubEloHistorySchema = z.object({
  team: z.string().min(1),
  limit: z.number().int().min(1).max(200).default(50),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getClubEloTeamHistory(_input: unknown) {
  const data = ((data: z.infer<typeof clubEloHistorySchema>) => clubEloHistorySchema.parse(data))(_input as any);

    try {
      return await runBridge<ClubEloHistoryResult>({
        operation: 'clubelo_team_history',
        ...data,
      })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load ClubElo team history')
    }
  
}
const sofascoreStandingsSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getSofascoreStandings(_input: unknown) {
  const data = ((data: z.infer<typeof sofascoreStandingsSchema>) => sofascoreStandingsSchema.parse(data))(_input as any);

    try {
      return await runBridge<SofascoreStandingsResult>({
        operation: 'sofascore_standings',
        ...data,
      })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load Sofascore standings')
    }
  
}
const fbrefShotEventsSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  game_id: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(100),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getFBrefShotEvents(_input: unknown) {
  const data = ((data: z.infer<typeof fbrefShotEventsSchema>) => fbrefShotEventsSchema.parse(data))(_input as any);

    try {
      return await runBridge<FBrefShotResult>({
        operation: 'fbref_shot_events',
        ...data,
      })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load FBref shot events')
    }
  
}
// ─── Sofascore Schedule ───────────────────────────────────────────────────────

export type SofascoreScheduleRow = {
  game: string | null
  date: string | null
  homeTeam: string | null
  awayTeam: string | null
  homeScore: number | null
  awayScore: number | null
  status: string | null
  round: number | null
}
export type SofascoreScheduleResult = {
  rows: SofascoreScheduleRow[]
  summary: { league: string; season: string; count: number; source: string }
}

const sofascoreScheduleSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getSofascoreSchedule(_input: unknown) {
  const data = ((data: z.infer<typeof sofascoreScheduleSchema>) => sofascoreScheduleSchema.parse(data))(_input as any);

    try {
      return await runBridge<SofascoreScheduleResult>({ operation: 'sofascore_schedule', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load Sofascore schedule')
    }
  
}
// ─── Understat Schedule ───────────────────────────────────────────────────────

export type UnderstatScheduleRow = {
  game: string | null
  gameId: number | null
  date: string | null
  homeTeam: string | null
  awayTeam: string | null
  homeGoals: number | null
  awayGoals: number | null
  homeXg: number | null
  awayXg: number | null
  isResult: boolean | null
}
export type UnderstatScheduleResult = {
  rows: UnderstatScheduleRow[]
  summary: { league: string; season: string; count: number; source: string }
}

const understatScheduleSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getUnderstatSchedule(_input: unknown) {
  const data = ((data: z.infer<typeof understatScheduleSchema>) => understatScheduleSchema.parse(data))(_input as any);

    try {
      return await runBridge<UnderstatScheduleResult>({ operation: 'understat_schedule', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load Understat schedule')
    }
  
}
// ─── Understat Team Match Stats ───────────────────────────────────────────────

export type UnderstatTeamMatchRow = {
  game: string | null
  date: string | null
  homeTeam: string | null
  awayTeam: string | null
  homeXg: number | null
  awayXg: number | null
  homeNpXg: number | null
  awayNpXg: number | null
  homePpda: number | null
  awayPpda: number | null
  homeDeep: number | null
  awayDeep: number | null
  homeGoals: number | null
  awayGoals: number | null
}
export type UnderstatTeamMatchResult = {
  rows: UnderstatTeamMatchRow[]
  summary: { league: string; season: string; count: number; source: string }
}

const understatTeamMatchSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getUnderstatTeamMatchStats(_input: unknown) {
  const data = ((data: z.infer<typeof understatTeamMatchSchema>) => understatTeamMatchSchema.parse(data))(_input as any);

    try {
      return await runBridge<UnderstatTeamMatchResult>({ operation: 'understat_team_match_stats', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load Understat team match stats')
    }
  
}
// ─── Understat Player Season Stats ───────────────────────────────────────────

export type UnderstatPlayerRow = {
  player: string | null
  team: string | null
  games: number | null
  goals: number | null
  assists: number | null
  xg: number | null
  xa: number | null
  shots: number | null
  keyPasses: number | null
  yellowCards: number | null
  redCards: number | null
  minutes: number | null
  npg: number | null
  npxg: number | null
}
export type UnderstatPlayerResult = {
  rows: UnderstatPlayerRow[]
  summary: { league: string; season: string; count: number; source: string }
}

const understatPlayerSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getUnderstatPlayerSeasonStats(_input: unknown) {
  const data = ((data: z.infer<typeof understatPlayerSchema>) => understatPlayerSchema.parse(data))(_input as any);

    try {
      return await runBridge<UnderstatPlayerResult>({ operation: 'understat_player_season_stats', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load Understat player season stats')
    }
  
}
// ─── Understat Shot Events ────────────────────────────────────────────────────

export type UnderstatShotRow = {
  game: string | null
  player: string | null
  team: string | null
  minute: number | null
  xg: number | null
  result: string | null
  situation: string | null
  shotType: string | null
  x: number | null
  y: number | null
  lastAction: string | null
}
export type UnderstatShotResult = {
  rows: UnderstatShotRow[]
  summary: { league: string; season: string; matchId: string | null; count: number; source: string }
}

const understatShotSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  match_id: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(200),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getUnderstatShotEvents(_input: unknown) {
  const data = ((data: z.infer<typeof understatShotSchema>) => understatShotSchema.parse(data))(_input as any);

    try {
      return await runBridge<UnderstatShotResult>({ operation: 'understat_shot_events', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load Understat shot events')
    }
  
}
// ─── FBref Player Season Stats ────────────────────────────────────────────────

export type FBrefPlayerSeasonResult = {
  rows: any[]
  summary: { league: string; season: string; statType: string; count: number; source: string }
}

const fbrefPlayerSeasonSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  stat_type: z.enum(['standard', 'shooting', 'passing', 'passing_types', 'goal_shot_creation', 'defense', 'possession', 'playing_time', 'misc', 'keeper', 'keeper_adv']).default('standard'),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getFBrefPlayerSeasonStats(_input: unknown) {
  const data = ((data: z.infer<typeof fbrefPlayerSeasonSchema>) => fbrefPlayerSeasonSchema.parse(data))(_input as any);

    try {
      return await runBridge<FBrefPlayerSeasonResult>({ operation: 'fbref_player_season_stats', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load FBref player season stats')
    }
  
}
// ─── FBref Team Match Stats ───────────────────────────────────────────────────

export type FBrefTeamMatchResult = {
  rows: any[]
  summary: { league: string; season: string; statType: string; count: number; source: string }
}

const fbrefTeamMatchSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  stat_type: z.enum(['schedule', 'keeper', 'shooting', 'passing', 'passing_types', 'goal_shot_creation', 'defense', 'possession', 'misc']).default('schedule'),
  team: z.string().optional(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getFBrefTeamMatchStats(_input: unknown) {
  const data = ((data: z.infer<typeof fbrefTeamMatchSchema>) => fbrefTeamMatchSchema.parse(data))(_input as any);

    try {
      return await runBridge<FBrefTeamMatchResult>({ operation: 'fbref_team_match_stats', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load FBref team match stats')
    }
  
}
// ─── ESPN Matchsheet ──────────────────────────────────────────────────────────

export type EspnMatchsheetResult = {
  rows: any[]
  summary: { league: string; season: string; matchId: string | null; count: number; source: string }
}

const espnMatchsheetSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(1),
  match_id: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(100),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getEspnMatchsheet(_input: unknown) {
  const data = ((data: z.infer<typeof espnMatchsheetSchema>) => espnMatchsheetSchema.parse(data))(_input as any);

    try {
      return await runBridge<EspnMatchsheetResult>({ operation: 'espn_matchsheet', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load ESPN matchsheet')
    }
  
}
// ─── ESPN Lineup ──────────────────────────────────────────────────────────────

export type EspnLineupResult = {
  rows: any[]
  summary: { league: string; season: string; matchId: string | null; count: number; source: string }
}

const espnLineupSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(1),
  match_id: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(200),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getEspnLineup(_input: unknown) {
  const data = ((data: z.infer<typeof espnLineupSchema>) => espnLineupSchema.parse(data))(_input as any);

    try {
      return await runBridge<EspnLineupResult>({ operation: 'espn_lineup', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load ESPN lineup')
    }
  
}
// ─── FBref Team Season Stats ──────────────────────────────────────────────────

export type FBrefTeamSeasonResult = {
  rows: any[]
  summary: { league: string; season: string; statType: string; count: number; source: string }
}

const fbrefTeamSeasonSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  stat_type: z.enum(['standard', 'keeper', 'keeper_adv', 'shooting', 'passing', 'passing_types', 'goal_shot_creation', 'defense', 'possession', 'playing_time', 'misc']).default('standard'),
  opponent_stats: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(40),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getFBrefTeamSeasonStats(_input: unknown) {
  const data = ((data: z.infer<typeof fbrefTeamSeasonSchema>) => fbrefTeamSeasonSchema.parse(data))(_input as any);

    try {
      return await runBridge<FBrefTeamSeasonResult>({ operation: 'fbref_team_season_stats', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load FBref team season stats')
    }
  
}
// ─── FBref Player Match Stats ─────────────────────────────────────────────────

export type FBrefPlayerMatchResult = {
  rows: any[]
  summary: { league: string; season: string; statType: string; matchId: string | null; count: number; source: string }
}

const fbrefPlayerMatchSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  stat_type: z.enum(['summary', 'keepers', 'passing', 'passing_types', 'defense', 'possession', 'misc']).default('summary'),
  match_id: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(200),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getFBrefPlayerMatchStats(_input: unknown) {
  const data = ((data: z.infer<typeof fbrefPlayerMatchSchema>) => fbrefPlayerMatchSchema.parse(data))(_input as any);

    try {
      return await runBridge<FBrefPlayerMatchResult>({ operation: 'fbref_player_match_stats', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load FBref player match stats')
    }
  
}
// ─── FBref Lineup ─────────────────────────────────────────────────────────────

export type FBrefLineupResult = {
  rows: any[]
  summary: { league: string; season: string; matchId: string | null; count: number; source: string }
}

const fbrefLineupSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  match_id: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(200),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getFBrefLineup(_input: unknown) {
  const data = ((data: z.infer<typeof fbrefLineupSchema>) => fbrefLineupSchema.parse(data))(_input as any);

    try {
      return await runBridge<FBrefLineupResult>({ operation: 'fbref_lineup', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load FBref lineup')
    }
  
}
// ─── FBref Events ─────────────────────────────────────────────────────────────

export type FBrefEventsResult = {
  rows: any[]
  summary: { league: string; season: string; matchId: string | null; count: number; source: string }
}

const fbrefEventsSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  match_id: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(200),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getFBrefEvents(_input: unknown) {
  const data = ((data: z.infer<typeof fbrefEventsSchema>) => fbrefEventsSchema.parse(data))(_input as any);

    try {
      return await runBridge<FBrefEventsResult>({ operation: 'fbref_events', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load FBref events')
    }
  
}
// ─── Understat Player Match Stats ─────────────────────────────────────────────

export type UnderstatPlayerMatchResult = {
  rows: any[]
  summary: { league: string; season: string; matchId: string | null; count: number; source: string }
}

const understatPlayerMatchSchema = z.object({
  league: z.string().min(1),
  season: z.string().min(2),
  match_id: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(200),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getUnderstatPlayerMatchStats(_input: unknown) {
  const data = ((data: z.infer<typeof understatPlayerMatchSchema>) => understatPlayerMatchSchema.parse(data))(_input as any);

    try {
      return await runBridge<UnderstatPlayerMatchResult>({ operation: 'understat_player_match_stats', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load Understat player match stats')
    }
  
}
// ─── SoFIFA Leagues ───────────────────────────────────────────────────────────

export type SoFIFALeaguesResult = {
  rows: any[]
  summary: { count: number; source: string }
}

const sofifaLeaguesSchema = z.object({
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getSoFIFALeagues(_input: unknown) {
  const data = ((data: z.infer<typeof sofifaLeaguesSchema>) => sofifaLeaguesSchema.parse(data))(_input as any);

    try {
      return await runBridge<SoFIFALeaguesResult>({ operation: 'sofifa_leagues', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load SoFIFA leagues')
    }
  
}
// ─── SoFIFA Versions ─────────────────────────────────────────────────────────

export type SoFIFAVersionsResult = {
  rows: any[]
  summary: { count: number; source: string }
}

const sofifaVersionsSchema = z.object({
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getSoFIFAVersions(_input: unknown) {
  const data = ((data: z.infer<typeof sofifaVersionsSchema>) => sofifaVersionsSchema.parse(data))(_input as any);

    try {
      return await runBridge<SoFIFAVersionsResult>({ operation: 'sofifa_versions', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load SoFIFA versions')
    }
  
}
// ─── SoFIFA Teams ─────────────────────────────────────────────────────────────

export type SoFIFATeamsResult = {
  rows: any[]
  summary: { league: string | null; count: number; source: string }
}

const sofifaTeamsSchema = z.object({
  league: z.string().optional(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getSoFIFATeams(_input: unknown) {
  const data = ((data: z.infer<typeof sofifaTeamsSchema>) => sofifaTeamsSchema.parse(data))(_input as any);

    try {
      return await runBridge<SoFIFATeamsResult>({ operation: 'sofifa_teams', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load SoFIFA teams')
    }
  
}
// ─── SoFIFA Players ───────────────────────────────────────────────────────────

export type SoFIFAPlayersResult = {
  rows: any[]
  summary: { league: string | null; count: number; source: string }
}

const sofifaPlayersSchema = z.object({
  league: z.string().optional(),
  team: z.string().optional(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getSoFIFAPlayers(_input: unknown) {
  const data = ((data: z.infer<typeof sofifaPlayersSchema>) => sofifaPlayersSchema.parse(data))(_input as any);

    try {
      return await runBridge<SoFIFAPlayersResult>({ operation: 'sofifa_players', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load SoFIFA players')
    }
  
}
// ─── SoFIFA Team Ratings ──────────────────────────────────────────────────────

export type SoFIFATeamRatingsResult = {
  rows: any[]
  summary: { league: string | null; count: number; source: string }
}

const sofifaTeamRatingsSchema = z.object({
  league: z.string().optional(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getSoFIFATeamRatings(_input: unknown) {
  const data = ((data: z.infer<typeof sofifaTeamRatingsSchema>) => sofifaTeamRatingsSchema.parse(data))(_input as any);

    try {
      return await runBridge<SoFIFATeamRatingsResult>({ operation: 'sofifa_team_ratings', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load SoFIFA team ratings')
    }
  
}
// ─── SoFIFA Player Ratings ────────────────────────────────────────────────────

export type SoFIFAPlayerRatingsResult = {
  rows: any[]
  summary: { league: string | null; count: number; source: string }
}

const sofifaPlayerRatingsSchema = z.object({
  league: z.string().optional(),
  team: z.string().optional(),
  player: z.string().optional(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getSoFIFAPlayerRatings(_input: unknown) {
  const data = ((data: z.infer<typeof sofifaPlayerRatingsSchema>) => sofifaPlayerRatingsSchema.parse(data))(_input as any);

    try {
      return await runBridge<SoFIFAPlayerRatingsResult>({ operation: 'sofifa_player_ratings', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load SoFIFA player ratings')
    }
  
}
// ─── FBref Leagues ────────────────────────────────────────────────────────────

export type FBrefLeaguesResult = {
  rows: any[]
  summary: { league: string | null; count: number; source: string }
}

const fbrefLeaguesSchema = z.object({
  league: z.string().optional(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getFBrefLeagues(_input: unknown) {
  const data = ((data: z.infer<typeof fbrefLeaguesSchema>) => fbrefLeaguesSchema.parse(data))(_input as any);

    try {
      return await runBridge<FBrefLeaguesResult>({ operation: 'fbref_leagues', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load FBref leagues')
    }
  
}
// ─── FBref Seasons ────────────────────────────────────────────────────────────

export type FBrefSeasonsResult = {
  rows: any[]
  summary: { league: string | null; count: number; source: string }
}

const fbrefSeasonsSchema = z.object({
  league: z.string().optional(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getFBrefSeasons(_input: unknown) {
  const data = ((data: z.infer<typeof fbrefSeasonsSchema>) => fbrefSeasonsSchema.parse(data))(_input as any);

    try {
      return await runBridge<FBrefSeasonsResult>({ operation: 'fbref_seasons', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load FBref seasons')
    }
  
}
// ─── Sofascore Leagues ────────────────────────────────────────────────────────

export type SofascoreLeaguesResult = {
  rows: any[]
  summary: { league: string | null; count: number; source: string }
}

const sofascoreLeaguesSchema = z.object({
  league: z.string().optional(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getSofascoreLeagues(_input: unknown) {
  const data = ((data: z.infer<typeof sofascoreLeaguesSchema>) => sofascoreLeaguesSchema.parse(data))(_input as any);

    try {
      return await runBridge<SofascoreLeaguesResult>({ operation: 'sofascore_leagues', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load Sofascore leagues')
    }
  
}
// ─── Sofascore Seasons ────────────────────────────────────────────────────────

export type SofascoreSeasonsResult = {
  rows: any[]
  summary: { league: string | null; count: number; source: string }
}

const sofascoreSeasonsSchema = z.object({
  league: z.string().optional(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getSofascoreSeasons(_input: unknown) {
  const data = ((data: z.infer<typeof sofascoreSeasonsSchema>) => sofascoreSeasonsSchema.parse(data))(_input as any);

    try {
      return await runBridge<SofascoreSeasonsResult>({ operation: 'sofascore_seasons', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load Sofascore seasons')
    }
  
}
// ─── Understat Leagues ────────────────────────────────────────────────────────

export type UnderstatLeaguesResult = {
  rows: any[]
  summary: { league: string | null; count: number; source: string }
}

const understatLeaguesSchema = z.object({
  league: z.string().optional(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getUnderstatLeagues(_input: unknown) {
  const data = ((data: z.infer<typeof understatLeaguesSchema>) => understatLeaguesSchema.parse(data))(_input as any);

    try {
      return await runBridge<UnderstatLeaguesResult>({ operation: 'understat_leagues', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load Understat leagues')
    }
  
}
// ─── Understat Seasons ────────────────────────────────────────────────────────

export type UnderstatSeasonsResult = {
  rows: any[]
  summary: { league: string | null; count: number; source: string }
}

const understatSeasonsSchema = z.object({
  league: z.string().optional(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getUnderstatSeasons(_input: unknown) {
  const data = ((data: z.infer<typeof understatSeasonsSchema>) => understatSeasonsSchema.parse(data))(_input as any);

    try {
      return await runBridge<UnderstatSeasonsResult>({ operation: 'understat_seasons', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load Understat seasons')
    }
  
}
// ─── WhoScored Leagues ────────────────────────────────────────────────────────

export type WhoScoredLeaguesResult = {
  rows: any[]
  summary: { league: string | null; count: number; source: string }
}

const whoScoredLeaguesSchema = z.object({
  league: z.string().optional(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getWhoScoredLeagues(_input: unknown) {
  const data = ((data: z.infer<typeof whoScoredLeaguesSchema>) => whoScoredLeaguesSchema.parse(data))(_input as any);

    try {
      return await runBridge<WhoScoredLeaguesResult>({ operation: 'whoscored_leagues', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load WhoScored leagues')
    }
  
}
// ─── WhoScored Seasons ────────────────────────────────────────────────────────

export type WhoScoredSeasonsResult = {
  rows: any[]
  summary: { league: string | null; count: number; source: string }
}

const whoScoredSeasonsSchema = z.object({
  league: z.string().optional(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getWhoScoredSeasons(_input: unknown) {
  const data = ((data: z.infer<typeof whoScoredSeasonsSchema>) => whoScoredSeasonsSchema.parse(data))(_input as any);

    try {
      return await runBridge<WhoScoredSeasonsResult>({ operation: 'whoscored_seasons', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load WhoScored seasons')
    }
  
}
// ─── WhoScored Season Stages ──────────────────────────────────────────────────

export type WhoScoredSeasonStagesResult = {
  rows: any[]
  summary: { league: string; season: string; count: number; source: string }
}

const whoScoredSeasonStagesSchema = z.object({
  league: z.string(),
  season: z.string(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getWhoScoredSeasonStages(_input: unknown) {
  const data = ((data: z.infer<typeof whoScoredSeasonStagesSchema>) => whoScoredSeasonStagesSchema.parse(data))(_input as any);

    try {
      return await runBridge<WhoScoredSeasonStagesResult>({ operation: 'whoscored_season_stages', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load WhoScored season stages')
    }
  
}
// ─── WhoScored Schedule ───────────────────────────────────────────────────────

export type WhoScoredScheduleResult = {
  rows: any[]
  summary: { league: string; season: string; count: number; source: string }
}

const whoScoredScheduleSchema = z.object({
  league: z.string(),
  season: z.string(),
  limit: z.number().default(100),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getWhoScoredSchedule(_input: unknown) {
  const data = ((data: z.infer<typeof whoScoredScheduleSchema>) => whoScoredScheduleSchema.parse(data))(_input as any);

    try {
      return await runBridge<WhoScoredScheduleResult>({ operation: 'whoscored_schedule', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load WhoScored schedule')
    }
  
}
// ─── WhoScored Missing Players ────────────────────────────────────────────────

export type WhoScoredMissingPlayersResult = {
  rows: any[]
  summary: { league: string; season: string; matchId: string | null; count: number; source: string }
}

const whoScoredMissingPlayersSchema = z.object({
  league: z.string(),
  season: z.string(),
  match_id: z.string().optional(),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getWhoScoredMissingPlayers(_input: unknown) {
  const data = ((data: z.infer<typeof whoScoredMissingPlayersSchema>) => whoScoredMissingPlayersSchema.parse(data))(_input as any);

    try {
      return await runBridge<WhoScoredMissingPlayersResult>({ operation: 'whoscored_missing_players', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load WhoScored missing players')
    }
  
}
// ─── WhoScored Events ─────────────────────────────────────────────────────────

export type WhoScoredEventsResult = {
  rows: any[]
  summary: { league: string; season: string; matchId: string | null; count: number; source: string }
}

const whoScoredEventsSchema = z.object({
  league: z.string(),
  season: z.string(),
  match_id: z.string().optional(),
  limit: z.number().default(500),
  refresh: z.boolean().default(false),
  no_store: z.boolean().default(false),
  proxy: z.string().optional(),
})

export async function getWhoScoredEvents(_input: unknown) {
  const data = ((data: z.infer<typeof whoScoredEventsSchema>) => whoScoredEventsSchema.parse(data))(_input as any);

    try {
      return await runBridge<WhoScoredEventsResult>({ operation: 'whoscored_events', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load WhoScored events')
    }
  
}
// ── Team Name Mapping ─────────────────────────────────────────────────────────

type TeamMappingResult = { mappings: Record<string, string[]> }

export async function getTeamMapping() {
    try {
      return await runBridge<TeamMappingResult>({ operation: 'team_mapping_get' })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to load team mappings')
    }
  
}
const teamMappingSetSchema = z.object({
  mappings: z.record(z.string(), z.array(z.string())),
})

export async function setTeamMapping(_input: unknown) {
  const data = ((data: z.infer<typeof teamMappingSetSchema>) => teamMappingSetSchema.parse(data))(_input as any);

    try {
      return await runBridge<{ ok: boolean; path: string }>({ operation: 'team_mapping_set', ...data })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to save team mappings')
    }
  
}
