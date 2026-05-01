import { z } from 'zod'
import { prisma } from '#/db'
import { PREDICT_MODELS, PREDICT_MARKETS } from './types'

const listSchema = z.object({
  league: z.string().optional(),
  source: z.enum(['single', 'ensemble']).optional(),
  status: z.enum(['pending', 'running', 'success', 'failed']).optional(),
  limit: z.number().int().min(1).max(200).default(50),
})

export async function listPredictionRuns(_input: unknown) {
  const data = listSchema.parse(_input ?? {})
  const { getCurrentUserId } = await import('#/server/auth/context')
  const userId = getCurrentUserId()
  return prisma.predictionRun.findMany({
    where: {
      ...(userId ? { OR: [{ userId }, { userId: null }] } : {}),
      ...(data.league ? { league: { contains: data.league } } : {}),
      ...(data.source ? { source: data.source } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: data.limit,
  })
}

const detailSchema = z.object({ runId: z.number().int().positive() })

export async function getPredictionRun(_input: unknown) {
  const { runId } = detailSchema.parse(_input)
  const run = await prisma.predictionRun.findUnique({ where: { id: runId } })
  if (!run) throw new Error('PredictionRun not found')

  const [singleRows, ensembleRows] = await Promise.all([
    prisma.modelPrediction.findMany({
      where: { runId },
      include: {
        match: { select: { id: true, homeTeam: true, awayTeam: true, matchDate: true, league: true, homeScore: true, awayScore: true } },
      },
    }),
    prisma.ensemblePrediction.findMany({
      where: { runId },
      include: {
        match: { select: { id: true, homeTeam: true, awayTeam: true, matchDate: true, league: true, homeScore: true, awayScore: true } },
      },
    }),
  ])

  return { run, modelPredictions: singleRows, ensemblePredictions: ensembleRows }
}

export async function deletePredictionRun(_input: unknown) {
  const { runId } = detailSchema.parse(_input)
  await prisma.predictionRun.delete({ where: { id: runId } })
  return { ok: true }
}

export async function getPredictCatalog() {
  return {
    models: PREDICT_MODELS,
    markets: PREDICT_MARKETS,
  }
}
