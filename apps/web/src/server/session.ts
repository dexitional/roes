// Client-safe session surface, imported by route guards, which the route tree
// bundles for BOTH client and server. Keep DB/JWT imports out of this file;
// the work happens in session-core.ts, loaded dynamically so the browser
// never fetches it.
import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

export const SESSION_COOKIE = 'roes_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

export type { SessionUser } from './session-core'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { userFromToken } = await import('./session-core')
  return userFromToken(getCookie(SESSION_COOKIE))
})
