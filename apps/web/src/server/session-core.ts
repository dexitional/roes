// Session tokens and the signed-in user (server only).
import { sign, verify } from 'hono/jwt'
import { getPool } from '@roes/db'
import type { UserRole } from '@roes/db'
import type { RowDataPacket } from 'mysql2'
import { SESSION_TTL_SECONDS } from './session'

function secret(): string {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters.')
  return value
}

export async function signSessionToken(userId: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return sign({ sub: userId, iat: now, exp: now + SESSION_TTL_SECONDS }, secret(), 'HS256')
}

async function readUserId(token: string | undefined): Promise<number | null> {
  if (!token) return null
  try {
    const payload = await verify(token, secret(), 'HS256')
    const id = Number(payload.sub)
    return Number.isFinite(id) ? id : null
  } catch {
    return null
  }
}

export interface SessionUser {
  id: number
  fullName: string
  email: string
  phone: string | null
  avatarUrl: string | null
  role: UserRole
}

export async function loadUser(id: number): Promise<SessionUser | null> {
  const [rows] = await getPool().query<Array<RowDataPacket>>(
    'SELECT id, full_name, email, phone, avatar_url, role FROM users WHERE id = ? AND is_active = 1',
    [id],
  )
  const r = rows[0]
  if (!r) return null
  return { id: r.id, fullName: r.full_name, email: r.email, phone: r.phone, avatarUrl: r.avatar_url, role: r.role }
}

export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  const id = await readUserId(token)
  return id ? loadUser(id) : null
}
