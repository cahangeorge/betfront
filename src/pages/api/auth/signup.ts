import type { APIRoute } from 'astro'
import { z } from 'zod'
import { prisma } from '#/db'
import { hashPassword } from '#/server/auth/password'
import { createSession, SESSION_COOKIE, SESSION_DURATION_MS } from '#/server/auth/session'

const schema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120).optional(),
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
    return new Response(
      JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
      { status: 400 },
    )
  }
  const { email, password, name } = parsed.data
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return new Response(JSON.stringify({ error: 'Email already registered' }), { status: 409 })
  }
  const user = await prisma.user.create({
    data: { email, name: name ?? null, passwordHash: hashPassword(password) },
  })
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
