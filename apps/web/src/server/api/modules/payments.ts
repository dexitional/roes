// Paystack return and webhook (only used once Paystack is switched on).
//   GET  /api/payments/paystack/callback?reference=...
//   POST /api/payments/paystack/webhook
import { Hono } from 'hono'
import { one } from '../lib/db'
import { markOrderPaid } from '../lib/orders'
import { paystackConfigured, verifyPaystack, verifyWebhookSignature } from '../lib/paystack'

async function settle(reference: string) {
  const result = await verifyPaystack(reference)
  if (result?.paid) await markOrderPaid(result.orderId, { userId: null, channel: 'paystack' })
  return result
}

export const paymentsRoute = new Hono()
  .get('/paystack/callback', async (c) => {
    const reference = c.req.query('reference') ?? c.req.query('trxref') ?? ''
    if (!paystackConfigured() || !reference) return c.redirect('/account', 302)
    const result = await settle(reference)
    const order = result ? await one<{ reference: string }>('SELECT reference FROM orders WHERE id = ?', [result.orderId]) : null
    return c.redirect(order ? `/account/orders/${order.reference}?paid=1` : '/account', 302)
  })
  .post('/paystack/webhook', async (c) => {
    const raw = await c.req.text()
    if (!verifyWebhookSignature(raw, c.req.header('x-paystack-signature'))) return c.json({ ok: false }, 401)
    const event = JSON.parse(raw) as { event?: string; data?: { reference?: string } }
    if (event.event === 'charge.success' && event.data?.reference) await settle(event.data.reference)
    return c.json({ ok: true })
  })
