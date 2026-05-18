import type { APIRoute } from 'astro'
import { destroySession, SESSION_COOKIE } from '#/server/auth/session'

export const POST: APIRoute = async ({ cookies }) => {
  const id = cookies.get(SESSION_COOKIE)?.value
  if (id) await destroySession(id)
  cookies.delete(SESSION_COOKIE, { path: '/betfront' })
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
