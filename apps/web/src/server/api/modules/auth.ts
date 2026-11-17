// Sign-in. Customers sign up and sign in with Google; staff can also use an
// email and password on /admin/login.
//
//   GET  /api/auth/config               which sign-in methods are available
//   GET  /api/auth/me                   the signed-in user (or null)
//   GET  /api/auth/google?next=/path    → Google consent screen
//   GET  /api/auth/google/callback      exchange the code, start a session
//   GET  /api/auth/dev?email=&next=     development only, when DEV_LOGIN=true
//   POST /api/auth/admin/login          staff email + password
//   POST /api/auth/logout
//   PATCH /api/auth/profile             name and phone
//   POST /api/auth/password             change own password (staff)
//
// Configure GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET and register
// {APP_URL}/api/auth/google/callback as an authorised redirect URI.
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { STAFF_ROLES } from '@roes/db'
import { adminLoginSchema, passwordSchema, profileSchema } from '#/lib/schemas'
import { normalizePhone } from '#/lib/phone'
import { loadUser } from '#/server/session-core'
import { endSession, requireStaff, requireUser, sessionUser, startSession } from '../lib/auth'
import { exec, insert, one } from '../lib/db'
import { AppError } from '../lib/errors'
import { rateLimit } from '../lib/rate-limit'
import { validate } from '../lib/validate'

const STATE_COOKIE = 'roes_oauth'
const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret } : null
}
const devLoginEnabled = () => process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN === 'true'

function redirectUri(c: Context) {
  const base = (process.env.APP_URL || new URL(c.req.url).origin).replace(/\/$/, '')
  return `${base}/api/auth/google/callback`
}

// Only same-site paths, so ?next= can't be used as an open redirect.
const safeNext = (value: string | undefined) =>
  value && value.startsWith('/') && !value.startsWith('//') ? value.slice(0, 300) : '/'

function decodeIdToken(idToken: string): Record<string, unknown> | null {
  try {
    const part = idToken.split('.')[1]
    return part ? (JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Finds the user by Google id, else links Google to the account with that email, else creates one. */
async function signInWithGoogle(profile: { sub: string; email: string; name: string | null; picture: string | null }) {
  const bySub = await one<{ id: number; isActive: number }>('SELECT id, is_active FROM users WHERE google_sub = ?', [profile.sub])
  if (bySub) {
    if (!bySub.isActive) return { error: 'account_disabled' as const }
    await exec('UPDATE users SET last_login_at = NOW(), avatar_url = COALESCE(?, avatar_url) WHERE id = ?', [profile.picture, bySub.id])
    return { id: bySub.id, isNew: false }
  }
  const byEmail = await one<{ id: number; isActive: number }>('SELECT id, is_active FROM users WHERE email = ?', [profile.email])
  if (byEmail) {
    if (!byEmail.isActive) return { error: 'account_disabled' as const }
    await exec('UPDATE users SET google_sub = ?, last_login_at = NOW(), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?', [
      profile.sub,
      profile.picture,
      byEmail.id,
    ])
    return { id: byEmail.id, isNew: false }
  }
  const id = await insert('users', {
    fullName: (profile.name || profile.email.split('@')[0] || 'Customer').slice(0, 150),
    email: profile.email,
    googleSub: profile.sub,
    avatarUrl: profile.picture,
    role: 'customer',
    lastLoginAt: new Date(),
  })
  return { id, isNew: true }
}

let dummyHash: string | null = null
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('not-a-real-password', 12))

export const authRoute = new Hono()
  .get('/config', (c) => c.json({ google: Boolean(googleConfig()), devLogin: devLoginEnabled() }))

  .get('/me', async (c) => {
    c.header('cache-control', 'private, no-store')
    return c.json({ user: await sessionUser(c) })
  })

  .get('/google', (c) => {
    const next = safeNext(c.req.query('next'))
    const config = googleConfig()
    if (!config) return c.redirect(`/login?error=google_not_configured&next=${encodeURIComponent(next)}`, 302)
    const state = randomBytes(24).toString('base64url')
    setCookie(c, STATE_COOKIE, `${state}|${next}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/api/auth',
      maxAge: 600,
    })
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri(c),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    })
    return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302)
  })

  .get('/google/callback', async (c) => {
    const config = googleConfig()
    const [expected, nextRaw] = (getCookie(c, STATE_COOKIE) ?? '').split('|')
    const next = safeNext(nextRaw)
    deleteCookie(c, STATE_COOKIE, { path: '/api/auth' })
    const fail = (error: string) => c.redirect(`/login?error=${error}&next=${encodeURIComponent(next)}`, 302)
    if (!config) return fail('google_not_configured')
    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')
    if (error) return fail('cancelled')
    if (!code || !state || !expected || state !== expected) return fail('invalid_state')

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri(c),
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null)
    if (!res?.ok) return fail('google_failed')
    const tokens = (await res.json()) as { id_token?: string }
    // The id_token comes straight from Google's token endpoint over TLS in
    // exchange for our client secret, so (OpenID Connect Core 3.1.3.7) its
    // signature need not be re-verified; issuer and audience still are.
    const claims = tokens.id_token ? decodeIdToken(tokens.id_token) : null
    if (
      !claims ||
      claims.aud !== config.clientId ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(String(claims.iss)) ||
      typeof claims.sub !== 'string' ||
      typeof claims.email !== 'string' ||
      claims.email_verified !== true
    ) {
      return fail('google_failed')
    }
    const result = await signInWithGoogle({
      sub: claims.sub,
      email: claims.email.toLowerCase(),
      name: typeof claims.name === 'string' ? claims.name : null,
      picture: typeof claims.picture === 'string' ? claims.picture : null,
    })
    if ('error' in result) return fail(result.error ?? 'google_failed')
    await startSession(c, result.id)
    return c.redirect(result.isNew ? `/account?welcome=1&next=${encodeURIComponent(next)}` : next, 302)
  })

  .get('/dev', async (c) => {
    if (!devLoginEnabled()) return c.json({ error: 'Not found' }, 404)
    const email = (c.req.query('email') ?? '').trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ error: 'Pass ?email=' }, 400)
    const name = email.split('@')[0]!.replace(/[._-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
    const result = await signInWithGoogle({ sub: `dev:${email}`, email, name, picture: null })
    if ('error' in result) return c.json({ error: result.error }, 403)
    await startSession(c, result.id)
    return c.redirect(safeNext(c.req.query('next')), 302)
  })

  .post('/admin/login', rateLimit('admin-login', 20, 300), validate('json', adminLoginSchema), async (c) => {
    const { email, password } = c.req.valid('json')
    const user = await one<{ id: number; passwordHash: string | null; isActive: number; role: string; failedLoginAttempts: number; lockedUntil: string | null }>(
      'SELECT id, password_hash, is_active, role, failed_login_attempts, locked_until FROM users WHERE email = ?',
      [email],
    )
    const ok = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash())
    if (!user || !user.isActive || !user.passwordHash || !STAFF_ROLES.includes(user.role as never)) {
      throw new AppError('Incorrect email or password.', 401)
    }
    if (user.lockedUntil && new Date(user.lockedUntil.replace(' ', 'T')) > new Date()) {
      throw new AppError(`Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`, 423)
    }
    if (!ok) {
      const attempts = user.failedLoginAttempts + 1
      await exec(
        'UPDATE users SET failed_login_attempts = ?, locked_until = IF(? >= ?, NOW() + INTERVAL ? MINUTE, NULL) WHERE id = ?',
        [attempts >= MAX_ATTEMPTS ? 0 : attempts, attempts, MAX_ATTEMPTS, LOCK_MINUTES, user.id],
      )
      throw new AppError('Incorrect email or password.', 401)
    }
    await exec('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?', [user.id])
    await startSession(c, user.id)
    return c.json({ user: await loadUser(user.id) })
  })

  .post('/logout', (c) => {
    endSession(c)
    return c.json({ ok: true })
  })

  .patch('/profile', requireUser, validate('json', profileSchema), async (c) => {
    const me = c.get('user')
    const { fullName, phone } = c.req.valid('json')
    await exec('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [fullName, normalizePhone(phone) ?? null, me.id])
    return c.json({ user: await loadUser(me.id) })
  })

  .post('/password', requireStaff, validate('json', passwordSchema), async (c) => {
    const me = c.get('user')
    const { currentPassword, newPassword } = c.req.valid('json')
    const row = await one<{ passwordHash: string | null }>('SELECT password_hash FROM users WHERE id = ?', [me.id])
    if (!row?.passwordHash || !(await bcrypt.compare(currentPassword, row.passwordHash))) {
      throw new AppError('Your current password is incorrect.', 422)
    }
    await exec('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 12), me.id])
    return c.json({ ok: true })
  })
