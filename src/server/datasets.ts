import { z } from 'zod'
import { prisma } from '#/db'

// ─── Save a scraped dataset ────────────────────────────────────────────────

const saveDatasetSchema = z.object({
  source: z.string(),
  operation: z.string(),
  sport: z.string().optional(),
  league: z.string().optional(),
  season: z.string().optional(),
  date: z.string().optional(),
  statType: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  rows: z.array(z.record(z.string(), z.unknown())),
  summary: z.record(z.string(), z.unknown()).optional(),
})

export async function saveScrapedDataset(_input: unknown) {
  const data = ((data: z.infer<typeof saveDatasetSchema>) => saveDatasetSchema.parse(data))(_input as any);

    const dataset = await prisma.scrapedDataset.create({
      data: {
        source: data.source,
        operation: data.operation,
        sport: data.sport ?? null,
        league: data.league ?? null,
        season: data.season ?? null,
        date: data.date ?? null,
        statType: data.statType ?? null,
        params: data.params ? JSON.stringify(data.params) : null,
        rowCount: data.rows.length,
        data: JSON.stringify(data.rows),
        summary: data.summary ? JSON.stringify(data.summary) : null,
      },
    })
    return { id: dataset.id, rowCount: dataset.rowCount }
  
}
// ─── List saved datasets (history) ────────────────────────────────────────

const listDatasetsSchema = z.object({
  source: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(100),
})

export type DatasetListItem = {
  id: number
  source: string
  operation: string
  sport: string | null
  league: string | null
  season: string | null
  date: string | null
  statType: string | null
  rowCount: number
  createdAt: string
}

export async function listScrapedDatasets(_input: unknown) {
  const data = ((data: z.infer<typeof listDatasetsSchema>) => listDatasetsSchema.parse(data))(_input as any);

    const datasets = await prisma.scrapedDataset.findMany({
      where: data.source ? { source: data.source } : undefined,
      select: {
        id: true,
        source: true,
        operation: true,
        sport: true,
        league: true,
        season: true,
        date: true,
        statType: true,
        rowCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: data.limit,
    })
    return datasets.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
    }))
  
}
// ─── Get a single dataset with full data ──────────────────────────────────

export async function getScrapedDataset(_input: unknown) {
  const data = ((data: { id: number }) => z.object({ id: z.number().int() }).parse(data))(_input as any);

    const dataset = await prisma.scrapedDataset.findUnique({
      where: { id: data.id },
    })
    if (!dataset) throw new Error('Dataset not found')
    return {
      ...dataset,
      data: JSON.parse(dataset.data) as Record<string, string | number | boolean | null>[],
      summary: dataset.summary ? (JSON.parse(dataset.summary) as Record<string, string | number | boolean | null>) : null,
      params: dataset.params ? (JSON.parse(dataset.params) as Record<string, string | number | boolean | null>) : null,
      createdAt: dataset.createdAt.toISOString(),
    }
  
}
// ─── Delete a scraped dataset ─────────────────────────────────────────────

export async function deleteScrapedDataset(_input: unknown) {
  const data = ((data: { id: number }) => z.object({ id: z.number().int() }).parse(data))(_input as any);

    await prisma.scrapedDataset.delete({ where: { id: data.id } })
    return { ok: true }
  
}
