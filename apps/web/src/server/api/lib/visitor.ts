import { randomBytes } from 'node:crypto'
import type { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

// An anonymous, random visitor id (first-party cookie) so analytics can count
// unique shoppers and follow a view through to a purchase. Never personal data.
const COOKIE = 'roes_vid'

export function visitorId(c: Context): string {
  const existing = getCookie(c, COOKIE)
  if (existing && /^[a-f0-9]{24}$/.test(existing)) return existing
  const id = randomBytes(12).toString('hex')
  setCookie(c, COOKIE, id, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 60 * 60 * 24 * 365, secure: process.env.NODE_ENV === 'production' })
  return id
}

export function deviceOf(c: Context): 'mobile' | 'tablet' | 'desktop' {
  const ua = c.req.header('user-agent') ?? ''
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return 'tablet'
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile'
  return 'desktop'
}

const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|lighthouse|headless/i
export const isBot = (c: Context) => BOTS.test(c.req.header('user-agent') ?? '')

/** Where the shopper came from, from ?utm_source / the referrer the client reports. */
export function sourceOf(raw: string | null | undefined): string {
  const s = String(raw ?? '').toLowerCase()
  if (!s) return 'direct'
  if (/instagram/.test(s)) return 'instagram'
  if (/tiktok/.test(s)) return 'tiktok'
  if (/facebook|fb\./.test(s)) return 'facebook'
  if (/twitter|t\.co|x\.com/.test(s)) return 'twitter'
  if (/whatsapp|wa\.me/.test(s)) return 'whatsapp'
  if (/snapchat/.test(s)) return 'snapchat'
  if (/google/.test(s)) return 'google'
  if (/bing|yahoo|duckduckgo/.test(s)) return 'search'
  if (/^(internal|search|home|category|related|wishlist|cart)$/.test(s)) return s
  return 'referral'
}
