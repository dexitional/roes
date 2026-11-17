import type { Context, Next } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { STAFF_ROLES } from '@roes/db'
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from '#/server/session'
import { signSessionToken, userFromToken } from '#/server/session-core'
import type { SessionUser } from '#/server/session-core'
import { AppError } from './errors'

declare module 'hono' {
  interface ContextVariableMap {
    user: SessionUser
  }
}

export const sessionUser = (c: Context) => userFromToken(getCookie(c, SESSION_COOKIE))

export async function startSession(c: Context, userId: number) {
  setCookie(c, SESSION_COOKIE, await signSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export const endSession = (c: Context) => deleteCookie(c, SESSION_COOKIE, { path: '/' })

export async function requireUser(c: Context, next: Next) {
  const user = await sessionUser(c)
  if (!user) throw new AppError('Please sign in to continue.', 401)
  c.set('user', user)
  await next()
}

export async function requireStaff(c: Context, next: Next) {
  const user = await sessionUser(c)
  if (!user) throw new AppError('Please sign in to continue.', 401)
  if (!STAFF_ROLES.includes(user.role)) throw new AppError('You do not have access to the admin.', 403)
  c.set('user', user)
  await next()
}

export async function requireAdmin(c: Context, next: Next) {
  const user = await sessionUser(c)
  if (!user) throw new AppError('Please sign in to continue.', 401)
  if (user.role !== 'admin') throw new AppError('Only administrators can do this.', 403)
  c.set('user', user)
  await next()
}

export async function optionalUser(c: Context, next: Next) {
  const user = await sessionUser(c)
  if (user) c.set('user', user)
  await next()
}

export const userOrNull = (c: Context): SessionUser | null => c.get('user') ?? null
