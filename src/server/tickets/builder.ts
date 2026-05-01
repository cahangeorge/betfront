import { prisma } from '#/db'
import { buildLegCandidates } from './candidates'
import { pickDiverseTicket } from './diversity'
import { scoreLegs } from './strategies'
import { generateBatchSchema, type GenerateBatchInput, type ScoredLeg } from './types'

function combinedOdds(legs: ScoredLeg[]) {
  return legs.reduce((acc, l) => acc * l.odds, 1)
}
function combinedProbability(legs: ScoredLeg[]) {
  return legs.reduce((acc, l) => acc * l.modelProb, 1)
}

async function persistTicket(
  batchId: number,
  bankrollId: number,
  strategy: string,
  stake: number,
  legs: ScoredLeg[],
  bankrollBalance: number,
) {
  const cOdds = combinedOdds(legs)
  const cProb = combinedProbability(legs)
  const ev = cOdds * cProb - 1
  const potentialReturn = stake * cOdds

  return prisma.ticket.create({
    data: {
      bankrollId,
      batchId,
      strategy,
      stake,
      bankroll: bankrollBalance,
      combinedOdds: cOdds,
      combinedProbability: cProb,
      expectedValue: ev,
      potentialReturn,
      selections: JSON.stringify(
        legs.map((l) => ({
          matchId: l.matchId,
          homeTeam: l.homeTeam,
          awayTeam: l.awayTeam,
          market: l.market,
          outcome: l.outcome,
          odds: l.odds,
          modelProb: l.modelProb,
        })),
      ),
      legs: {
        create: legs.map((l) => ({
          matchId: l.matchId,
          homeTeam: l.homeTeam,
          awayTeam: l.awayTeam,
          matchDate: l.matchDate,
          sport: l.sport,
          league: l.league,
          market: l.market,
          submarket: l.market === 'ou_2_5' ? '2.5' : null,
          outcome: l.outcome,
          label: l.label,
          odds: l.odds,
          bookmaker: l.bookmaker,
          modelProb: l.modelProb,
          legResult: 'pending',
        })),
      },
    },
  })
}

export async function generateTicketBatch(_input: unknown) {
  const data = generateBatchSchema.parse(_input)

  const bankroll = await prisma.bankroll.findUnique({ where: { id: data.bankrollId } })
  if (!bankroll) throw new Error('Bankroll not found')

  const { getCurrentUserId } = await import('#/server/auth/context')
  const userId = getCurrentUserId()
  if (userId && bankroll.userId !== userId) {
    throw new Error('Bankroll does not belong to current user')
  }

  const legs = await buildLegCandidates(data)
  if (legs.length === 0) {
    throw new Error('No leg candidates found — run a prediction first or widen filters.')
  }

  const scored = scoreLegs(data.strategy, legs, data)
  if (scored.length < data.legsPerTicket) {
    throw new Error(
      `Only ${scored.length} eligible leg(s) for this strategy — need ${data.legsPerTicket}.`,
    )
  }

  const batch = await prisma.ticketBatch.create({
    data: {
      bankrollId: data.bankrollId,
      name: data.name ?? `${data.strategy} ${new Date().toISOString().slice(0, 16)}`,
      strategy: data.strategy,
      params: JSON.stringify(data),
    },
  })

  const built: ScoredLeg[][] = []
  let attempts = 0
  const maxOverlap = data.swapMatches
    ? Math.max(0, Math.min(data.minLegOverlap, data.legsPerTicket - 1))
    : data.legsPerTicket // no diversity constraint
  let cursor = 0

  while (built.length < data.ticketCount && attempts < data.ticketCount * 6) {
    const ticket = pickDiverseTicket(scored, data.legsPerTicket, built, maxOverlap, cursor % scored.length)
    if (!ticket) break
    built.push(ticket)
    cursor += data.legsPerTicket
    attempts += 1
  }

  if (built.length === 0) {
    await prisma.ticketBatch.delete({ where: { id: batch.id } })
    throw new Error('Could not assemble any ticket meeting diversity constraints.')
  }

  for (const legs of built) {
    await persistTicket(batch.id, data.bankrollId, data.strategy, data.stake, legs, bankroll.balance)
  }

  await prisma.ticketBatch.update({
    where: { id: batch.id },
    data: { ticketCount: built.length },
  })

  return { batchId: batch.id, ticketCount: built.length, attempted: data.ticketCount }
}

export async function listTicketBatches(_input?: unknown) {
  const { getCurrentUserId } = await import('#/server/auth/context')
  const userId = getCurrentUserId()
  return prisma.ticketBatch.findMany({
    where: userId ? { bankroll: { userId } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      bankroll: { select: { name: true, currency: true } },
      tickets: {
        select: { id: true, status: true, combinedOdds: true, combinedProbability: true, expectedValue: true, potentialReturn: true },
      },
    },
  })
}

import { z } from 'zod'

const batchDetailSchema = z.object({ batchId: z.number().int().positive() })

export async function getTicketBatch(_input: unknown) {
  const { batchId } = batchDetailSchema.parse(_input)
  const batch = await prisma.ticketBatch.findUnique({
    where: { id: batchId },
    include: {
      bankroll: true,
      tickets: { include: { legs: true, placements: { include: { settlement: true, bookmakerAccount: true } } } },
    },
  })
  if (!batch) throw new Error('Batch not found')
  return batch
}

export async function deleteTicketBatch(_input: unknown) {
  const { batchId } = batchDetailSchema.parse(_input)
  await prisma.ticketBatch.delete({ where: { id: batchId } })
  return { ok: true }
}

export async function listGenerationStrategies() {
  const { STRATEGIES, STRATEGY_LABELS } = await import('./types')
  return STRATEGIES.map((s) => ({ value: s, label: STRATEGY_LABELS[s] }))
}
