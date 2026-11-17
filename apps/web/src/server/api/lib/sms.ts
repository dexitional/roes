// SMS through SMSOnlineGH (HTTP REST API v5, https://dev.smsonlinegh.com/docs/v5/http/rest):
//   POST https://api.smsonlinegh.com/v5/message/sms/send   Authorization: key <API key>
// The sender ID (Admin › Settings › Notifications) must be registered in the
// SMSOnlineGH account. Every message is recorded in sms_logs.
//
// SMS_SIMULATE=true (ignored in production) logs messages instead of sending
// them when no API key is set, so the flow can be tried locally.
import { normalizePhone } from '#/lib/phone'
import { exec } from './db'
import { getSettings } from './settings'

const SMS_URL = 'https://api.smsonlinegh.com/v5/message/sms/send'
const simulate = () => process.env.NODE_ENV !== 'production' && process.env.SMS_SIMULATE === 'true'

export function smsStatus() {
  const configured = Boolean(process.env.SMSONLINEGH_API_KEY)
  return { configured, simulated: !configured && simulate() }
}

export interface SmsResult {
  to: string
  ok: boolean
  status: string
  ref?: string | null
  error?: string | null
}

// GSM-7 only: swap characters that would force the costlier Unicode encoding.
const plain = (text: string) =>
  text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/₵/g, 'C')
    .replace(/[^\x20-\x7E\n£¥èéùìòÇØøÅå_ÆæßÉ¡ÄÖÑÜ§¿äöñüà]/g, '')

export async function sendSms(
  recipients: Array<string>,
  text: string,
  opts: { context?: string; orderId?: number | null; sender?: string } = {},
): Promise<Array<SmsResult>> {
  const numbers = [...new Set(recipients.map(normalizePhone).filter((n): n is string => Boolean(n)))]
  if (!numbers.length) return []
  const settings = await getSettings()
  const sender = (opts.sender || settings.notifications.smsSender || 'RoesOutlet').slice(0, 11)
  const message = plain(text).slice(0, 640)
  const key = process.env.SMSONLINEGH_API_KEY
  let results: Array<SmsResult>

  if (!key) {
    if (!simulate()) {
      results = numbers.map((to) => ({ to, ok: false, status: 'failed', error: 'SMSONLINEGH_API_KEY is not set' }))
    } else {
      console.log(`[sms:simulated] ${sender} → ${numbers.join(', ')}: ${message}`)
      results = numbers.map((to) => ({ to, ok: true, status: 'simulated' }))
    }
  } else {
    const res = await fetch(SMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `key ${key}` },
      body: JSON.stringify({ text: message, type: 0, sender, destinations: numbers }),
      signal: AbortSignal.timeout(30_000),
    }).catch((err: unknown) => {
      console.error("[sms] couldn't reach SMSOnlineGH:", err)
      return null
    })
    const json = (await res?.json().catch(() => null)) as {
      handshake?: { id: number; label: string }
      data?: { batch?: string; destinations?: Array<{ id?: string; to?: string; status?: { label: string } }> }
    } | null
    if (!res?.ok || !json || json.handshake?.id !== 0) {
      const reason = json?.handshake?.label ?? (res ? `HTTP ${res.status}` : 'network error')
      results = numbers.map((to) => ({ to, ok: false, status: 'failed', error: `Gateway rejected the request (${reason})` }))
    } else {
      const byNumber = new Map((json.data?.destinations ?? []).map((d) => [String(d.to ?? ''), d]))
      results = numbers.map((to) => {
        const d = byNumber.get(to)
        const label = d?.status?.label ?? 'DS_PENDING_ENROUTE'
        const failed = /REJECT|ERR|INVALID|FAIL|BLACKLIST|BARRED/i.test(label)
        return { to, ok: !failed, status: failed ? 'failed' : 'sent', ref: d?.id ?? json.data?.batch ?? null, error: failed ? label : null }
      })
    }
  }

  for (const r of results) {
    await exec(
      'INSERT INTO sms_logs (recipient, message, context, order_id, status, provider_ref, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [r.to, message, opts.context ?? null, opts.orderId ?? null, r.status, r.ref ?? null, r.error?.slice(0, 300) ?? null],
    ).catch((err) => console.error("[sms] couldn't log:", err))
  }
  return results
}

/** Fire-and-forget: notifications must never hold up (or fail) the request. */
export function sendSmsLater(recipients: Array<string>, text: string, opts: Parameters<typeof sendSms>[2] = {}) {
  void sendSms(recipients, text, opts).catch((err) => console.error('[sms] send failed:', err))
}

let lastBalance: { at: number; value: { balance: number; model: string } | null } | undefined

export async function smsBalance() {
  const key = process.env.SMSONLINEGH_API_KEY
  if (!key) return null
  if (lastBalance && Date.now() - lastBalance.at < 60_000) return lastBalance.value
  const res = await fetch('https://api.smsonlinegh.com/v5/account/balance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `key ${key}` },
    signal: AbortSignal.timeout(4_000),
  }).catch(() => null)
  const json = (await res?.json().catch(() => null)) as { handshake?: { id: number }; data?: { balance: number; model: string } } | null
  const value = json?.handshake?.id === 0 && json.data ? json.data : null
  lastBalance = { at: Date.now(), value }
  return value
}
