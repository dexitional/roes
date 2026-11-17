// Paystack, provisioned for later. It is used only when PAYSTACK_SECRET_KEY is
// set AND "Accept Paystack" is switched on in Admin › Settings › Payments.
// Until then every order is paid by MoMo to the number set in the admin.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { AppError } from './errors'
import { exec, one } from './db'
import { paymentReference } from './codes'

const API = 'https://api.paystack.co'
export const paystackConfigured = () => Boolean(process.env.PAYSTACK_SECRET_KEY)
const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3020').replace(/\/$/, '')

export async function startPaystack(order: { id: number; reference: string; total: number; email: string }) {
  const reference = paymentReference()
  await exec('INSERT INTO payments (reference, order_id, amount) VALUES (?, ?, ?)', [reference, order.id, order.total])
  const res = await fetch(`${API}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: order.email,
      amount: Math.round(order.total * 100),
      currency: 'GHS',
      reference,
      callback_url: `${appUrl()}/api/payments/paystack/callback`,
      metadata: { order: order.reference },
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null)
  const json = (await res?.json().catch(() => null)) as { status?: boolean; data?: { authorization_url?: string } } | null
  if (!json?.status || !json.data?.authorization_url) {
    await exec("UPDATE payments SET status = 'failed' WHERE reference = ?", [reference])
    throw new AppError("Couldn't start the card payment. Please try again or pay by MoMo.", 400)
  }
  return json.data.authorization_url
}

/** Asks Paystack for the truth (never trusts the redirect alone). Returns the order id when newly paid. */
export async function verifyPaystack(reference: string): Promise<{ orderId: number; paid: boolean } | null> {
  const payment = await one<{ id: number; orderId: number; amount: number; status: string }>(
    'SELECT id, order_id, amount, status FROM payments WHERE reference = ?',
    [reference],
  )
  if (!payment) return null
  if (payment.status !== 'pending') return { orderId: payment.orderId, paid: false }
  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null)
  const json = (await res?.json().catch(() => null)) as {
    data?: { status?: string; amount?: number; currency?: string; channel?: string }
  } | null
  const data = json?.data
  if (!data) return { orderId: payment.orderId, paid: false }
  if (data.status === 'success' && data.amount === Math.round(payment.amount * 100) && data.currency === 'GHS') {
    const claim = await exec(
      "UPDATE payments SET status = 'success', channel = ?, paid_at = NOW() WHERE id = ? AND status = 'pending'",
      [data.channel ?? null, payment.id],
    )
    return { orderId: payment.orderId, paid: claim.affectedRows > 0 }
  }
  if (data.status === 'failed' || data.status === 'abandoned') {
    await exec("UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'pending'", [payment.id])
  }
  return { orderId: payment.orderId, paid: false }
}

export function verifyWebhookSignature(rawBody: string, signature: string | undefined) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret || !signature) return false
  const a = Buffer.from(createHmac('sha512', secret).update(rawBody).digest('hex'))
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}
