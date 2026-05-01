import { randomBytes } from 'node:crypto'
import { prisma } from '#/db'

export const SESSION_COOKIE = 'betfront_session'
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function generateSessionId(): string {
  return randomBytes(32).toString('hex')
}

export async function createSession(userId: number): Promise<{ id: string; expiresAt: Date }> {
  const id = generateSessionId()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  await prisma.session.create({ data: { id, userId, expiresAt } })
  return { id, expiresAt }
}

export async function getSessionUser(sessionId: string | null | undefined) {
  if (!sessionId) return null
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {})
    return null
  }
  return { sessionId: session.id, userId: session.userId, user: session.user }
}

export async function destroySession(sessionId: string) {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {})
}

export async function purgeExpiredSessions() {
  await prisma.session
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {})
}
