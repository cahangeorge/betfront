import { z } from 'zod'

export const STRATEGIES = [
  'highest-prob',
  'highest-odds',
  'highest-ev',
  'value',
  'kelly',
  'edge-conf',
  'weighted-rand',
  'arbitrage',
] as const
export type Strategy = (typeof STRATEGIES)[number]

export const STRATEGY_LABELS: Record<Strategy, string> = {
  'highest-prob': 'Highest probability',
  'highest-odds': 'Highest odds',
  'highest-ev': 'Highest EV',
  value: 'Value (model > implied)',
  kelly: 'Kelly stake',
  'edge-conf': 'Edge × confidence',
  'weighted-rand': 'Weighted random',
  arbitrage: 'Arbitrage scan',
}

export const generateBatchSchema = z.object({
  bankrollId: z.number().int().positive(),
  strategy: z.enum(STRATEGIES),
  ticketCount: z.number().int().min(1).max(50).default(5),
  legsPerTicket: z.number().int().min(1).max(8).default(3),
  swapMatches: z.boolean().default(true), // diversify: rotate legs across tickets
  minLegOverlap: z.number().int().min(0).default(0), // max shared legs between any 2 tickets
  league: z.string().optional(),
  windowStart: z.string().optional(),
  windowEnd: z.string().optional(),
  predictionRunId: z.number().int().positive().optional(), // pin to a specific run
  markets: z.array(z.string()).default(['1x2', 'btts', 'ou_2_5']),
  bookmaker: z.string().optional(),
  stake: z.number().positive().default(10),
  // strategy-specific params
  edgeThreshold: z.number().default(0.05), // for value / edge-conf
  kellyCap: z.number().default(0.05), // max fraction
  randomTemperature: z.number().default(1.0),
  name: z.string().optional(),
})
export type GenerateBatchInput = z.infer<typeof generateBatchSchema>

export const placeTicketSchema = z.object({
  ticketId: z.number().int().positive(),
  bookmakerAccountId: z.number().int().positive(),
  externalRef: z.string().optional(),
  stake: z.number().positive(),
})

export const settleTicketSchema = z.object({
  ticketId: z.number().int().positive(),
  outcome: z.enum(['won', 'lost', 'void']),
  returnAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
})

export type LegCandidate = {
  matchId: number
  homeTeam: string
  awayTeam: string
  matchDate: string | null
  league: string | null
  sport: string | null
  market: string
  outcome: string
  label: string
  modelProb: number
  odds: number
  bookmaker: string
  impliedProb: number
  edge: number // modelProb - impliedProb
  ev: number // odds * modelProb - 1
  source: 'ensemble' | 'single'
  modelKey?: string
}

export type ScoredLeg = LegCandidate & { score: number }
