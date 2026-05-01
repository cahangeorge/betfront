import type { APIRoute } from 'astro'
import { z } from 'zod'
import { prisma } from '#/db'
import { verifyPassword } from '#/server/auth/password'
import { createSession, SESSION_COOKIE, SESSION_DURATION_MS } from '#/server/auth/session'

const schema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(200),
})

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400 })
  }
  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401 })
  }
  const session = await createSession(user.id)
  cookies.set(SESSION_COOKIE, session.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  })
  return new Response(JSON.stringify({ ok: true, user: { id: user.id, email: user.email, name: user.name } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
