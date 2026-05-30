import { defineMiddleware } from 'astro:middleware'
import { SESSION_COOKIE, getSessionUser } from '#/server/auth/session'
import { requestContext } from '#/server/auth/context'

// Routes that don't require auth
const PUBLIC_PATHS = new Set([
  '/login',
  '/signup',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/logout',
])

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (pathname.startsWith('/_') || pathname.startsWith('/favicon') || pathname === '/manifest.json') return true
  // static assets
  if (/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|map)$/.test(pathname)) return true
  return false
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const sessionId = ctx.cookies.get(SESSION_COOKIE)?.value ?? null
  const session = await getSessionUser(sessionId)

  ctx.locals.user = session
    ? { id: session.user.id, email: session.user.email, name: session.user.name }
    : null
  ctx.locals.sessionId = session?.sessionId ?? null

  // Auth gate (HTML pages only — API routes handle their own 401)
  const url = new URL(ctx.request.url)
  if (!session && !isPublic(url.pathname) && ctx.request.method === 'GET') {
    return ctx.redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`)
  }

  // Inject context into AsyncLocalStorage for server actions
  return requestContext.run(
    { userId: session?.userId ?? null, sessionId: session?.sessionId ?? null },
    () => next(),
  )
})
