import { AsyncLocalStorage } from 'node:async_hooks'

export type RequestContext = {
  userId: number | null
  sessionId: string | null
}

export const requestContext = new AsyncLocalStorage<RequestContext>()

export function getContext(): RequestContext {
  return requestContext.getStore() ?? { userId: null, sessionId: null }
}

export function getCurrentUserId(): number | null {
  return getContext().userId
}
