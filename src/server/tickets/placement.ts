import { prisma } from '#/db'
import { placeTicketSchema, settleTicketSchema } from './types'
import { getCurrentUserId } from '#/server/auth/context'

async function assertBankrollOwnership(bankrollId: number) {
  const userId = getCurrentUserId()
  if (!userId) return // legacy / dev fallback path: no enforcement
  const bankroll = await prisma.bankroll.findUnique({
    where: { id: bankrollId },
    select: { userId: true },
  })
  if (!bankroll || bankroll.userId !== userId) {
    throw new Error('Bankroll does not belong to current user')
  }
}

export async function placeTicket(_input: unknown) {
  const data = placeTicketSchema.parse(_input)

  const ticket = await prisma.ticket.findUnique({ where: { id: data.ticketId } })
  if (!ticket) throw new Error('Ticket not found')
  if (ticket.bankrollId == null) throw new Error('Ticket has no bankroll attached')
  await assertBankrollOwnership(ticket.bankrollId)

  const account = await prisma.bookmakerAccount.findUnique({ where: { id: data.bookmakerAccountId } })
  if (!account) throw new Error('Bookmaker account not found')
  if (account.bankrollId !== ticket.bankrollId)
    throw new Error('Bookmaker account does not belong to ticket bankroll')

  const bankroll = await prisma.bankroll.findUnique({ where: { id: ticket.bankrollId } })
  if (!bankroll) throw new Error('Bankroll not found')

  const result = await prisma.$transaction(async (tx) => {
    const placement = await tx.betPlacement.create({
      data: {
        ticketId: data.ticketId,
        bookmakerAccountId: data.bookmakerAccountId,
        externalRef: data.externalRef,
        stake: data.stake,
        status: 'placed',
      },
    })

    const newBalance = bankroll.balance - data.stake
    await tx.bankroll.update({
      where: { id: bankroll.id },
      data: { balance: newBalance },
    })

    await tx.ledgerEntry.create({
      data: {
        bankrollId: bankroll.id,
        ticketId: data.ticketId,
        placementId: placement.id,
        kind: 'stake',
        amount: -data.stake,
        balanceAfter: newBalance,
        notes: `Placed ticket #${data.ticketId} via account #${data.bookmakerAccountId}`,
      },
    })

    await tx.ticket.update({
      where: { id: data.ticketId },
      data: { status: 'placed' },
    })

    return placement
  })

  return { placementId: result.id, status: result.status }
}

export async function settleTicket(_input: unknown) {
  const data = settleTicketSchema.parse(_input)

  const ticket = await prisma.ticket.findUnique({
    where: { id: data.ticketId },
    include: { placements: { include: { settlement: true } } },
  })
  if (!ticket) throw new Error('Ticket not found')
  const placement = ticket.placements.find((p) => p.status === 'placed')
  if (!placement) throw new Error('Ticket has no active placement to settle')
  if (placement.settlement) throw new Error('Placement already settled')
  if (ticket.bankrollId == null) throw new Error('Ticket has no bankroll')
  await assertBankrollOwnership(ticket.bankrollId)

  const bankroll = await prisma.bankroll.findUnique({ where: { id: ticket.bankrollId } })
  if (!bankroll) throw new Error('Bankroll not found')

  const profitLoss = data.returnAmount - placement.stake

  await prisma.$transaction(async (tx) => {
    await tx.settlement.create({
      data: {
        placementId: placement.id,
        outcome: data.outcome,
        returnAmount: data.returnAmount,
        profitLoss,
        notes: data.notes,
      },
    })

    await tx.betPlacement.update({
      where: { id: placement.id },
      data: { status: 'settled' },
    })

    if (data.returnAmount > 0) {
      const newBalance = bankroll.balance + data.returnAmount
      await tx.bankroll.update({
        where: { id: bankroll.id },
        data: { balance: newBalance },
      })
      await tx.ledgerEntry.create({
        data: {
          bankrollId: bankroll.id,
          ticketId: data.ticketId,
          placementId: placement.id,
          kind: data.outcome === 'won' ? 'win' : 'adjust',
          amount: data.returnAmount,
          balanceAfter: newBalance,
          notes: `Settled ticket #${data.ticketId} (${data.outcome})`,
        },
      })
    } else {
      await tx.ledgerEntry.create({
        data: {
          bankrollId: bankroll.id,
          ticketId: data.ticketId,
          placementId: placement.id,
          kind: 'loss',
          amount: 0,
          balanceAfter: bankroll.balance,
          notes: `Settled ticket #${data.ticketId} (${data.outcome})`,
        },
      })
    }

    // Update individual leg results — heuristic: all legs marked won/lost/void same.
    await tx.ticketLeg.updateMany({
      where: { ticketId: data.ticketId },
      data: { legResult: data.outcome },
    })

    await tx.ticket.update({
      where: { id: data.ticketId },
      data: { status: 'settled' },
    })
  })

  return { ok: true, profitLoss }
}
