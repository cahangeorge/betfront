// Shared types & zod schemas for the scrape pillar.
// Public surface re-exported through #/server/scraper.

import { z } from 'zod'

export type LeagueCatalogItem = {
  sport: string
  country: string
  countryLabel: string
  league: string
  leagueLabel: string
  urlLeague: string // the league slug from the OddsPortal URL path (e.g. "serie-a-betano")
  value: string
}

const baseRunFields = {
  sport: z.string(),
  markets: z.string().optional(),
  league: z.string().optional(),
  headless: z.boolean().default(true),
  concurrency: z.number().int().min(1).max(10).default(3),
  requestDelay: z.number().min(0).max(30).default(1),
  previewOnly: z.boolean().default(false),
  bookiesFilter: z.enum(['all', 'classic', 'crypto']).default('all'),
  oddsFormat: z.string().default('Decimal Odds'),
  oddsHistory: z.boolean().default(false),
  period: z.string().optional(),
  proxyUrl: z.string().optional(),
  proxyUser: z.string().optional(),
  proxyPass: z.string().optional(),
  browserUserAgent: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  matchLinks: z.array(z.string()).optional(),
  targetBookmaker: z.string().optional(),
  outputFormat: z.enum(['json', 'csv']).default('json'),
}

export const upcomingParamsSchema = z.object({
  ...baseRunFields,
  date: z.string().optional(),
})

export const historicParamsSchema = z.object({
  ...baseRunFields,
  season: z.string(),
  maxPages: z.number().int().min(1).optional(),
})

export type UpcomingParams = z.infer<typeof upcomingParamsSchema>
export type UpcomingInput = z.input<typeof upcomingParamsSchema>
export type HistoricParams = z.infer<typeof historicParamsSchema>
export type HistoricInput = z.input<typeof historicParamsSchema>
