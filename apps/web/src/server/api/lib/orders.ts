// Order lifecycle: payment confirmation, status changes, stock and SMS.
import type { OrderStatus } from '@roes/db'
import { ORDER_STATUS_LABELS } from '#/lib/labels'
import { exec, insert, one, rows, withTransaction } from './db'
import { bustCache } from './cache'
import { AppError, notFound } from './errors'
import { getSettings } from './settings'
import { sendSmsLater } from './sms'

export interface OrderRow {
  id: number
  reference: string
  userId: number | null
  customerName: string
  email: string
  phone: string
  total: number
  status: OrderStatus
  paymentStatus: string
  paymentMethod: string
  deliveryMethod: string
}

const cedis = (n: number) => `GHS ${Number(n).toFixed(2)}`
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name
const appUrl = () => (process.env.APP_URL ?? '').replace(/\/$/, '')

export async function findOrder(reference: string) {
  const order = await one<OrderRow>(
    'SELECT id, reference, user_id, customer_name, email, phone, total, status, payment_status, payment_method, delivery_method FROM orders WHERE reference = ?',
    [reference],
  )
  if (!order) throw notFound('Order')
  return order
}

export async function logOrderEvent(orderId: number, kind: string, note: string | null, userId: number | null = null) {
  await insert('order_events', { orderId, kind, note, userId })
}

// ---- Notifications ---------------------------------------------------------------------------

export async function notifyOrderPlaced(order: OrderRow) {
  const s = await getSettings()
  if (!s.notifications.smsEnabled) return
  const link = appUrl() ? ` Track it: ${appUrl()}/account/orders/${order.reference}` : ''
  if (s.notifications.orderPlaced) {
    const pay =
      order.paymentMethod === 'momo'
        ? ` Please send ${cedis(order.total)} by MoMo to ${s.payments.momoNumber} (${s.payments.momoName}) with reference ${order.reference}.`
        : ''
    sendSmsLater(
      [order.phone],
      `Hi ${firstName(order.customerName)}, thank you for shopping with ${s.store.name}! Order ${order.reference} (${cedis(order.total)}) is received.${pay}${link}`,
      { context: 'order_placed', orderId: order.id },
    )
  }
  if (s.notifications.adminPhones.length) {
    sendSmsLater(
      s.notifications.adminPhones,
      `New order ${order.reference}: ${cedis(order.total)} from ${order.customerName} (${order.phone}), ${order.deliveryMethod}. Payment: ${order.paymentMethod.toUpperCase()}.`,
      { context: 'admin_new_order', orderId: order.id },
    )
  }
}

export async function notifyPaymentSubmitted(order: OrderRow, transactionId: string) {
  const s = await getSettings()
  if (!s.notifications.smsEnabled || !s.notifications.adminPhones.length) return
  sendSmsLater(
    s.notifications.adminPhones,
    `MoMo payment sent for ${order.reference} (${cedis(order.total)}). Transaction ID: ${transactionId}. Confirm it in the admin.`,
    { context: 'admin_payment_submitted', orderId: order.id },
  )
}

async function notifyPaid(order: OrderRow) {
  const s = await getSettings()
  if (!s.notifications.smsEnabled || !s.notifications.paymentConfirmed) return
  sendSmsLater(
    [order.phone],
    `Payment received! ${s.store.name} has confirmed ${cedis(order.total)} for order ${order.reference}. We are preparing it now and will text you when it ships.`,
    { context: 'payment_confirmed', orderId: order.id },
  )
}

const STATUS_MESSAGES: Partial<Record<OrderStatus, (o: OrderRow, storeName: string, note: string | null) => string>> = {
  processing: (o, store) => `Good news ${firstName(o.customerName)}: ${store} is preparing order ${o.reference}.`,
  shipped: (o, store, note) =>
    o.deliveryMethod === 'pickup'
      ? `Order ${o.reference} is ready for pickup at ${store}.${note ? ` ${note}` : ''}`
      : `Order ${o.reference} is on its way!${note ? ` ${note}` : ''} Thank you for shopping with ${store}.`,
  delivered: (o, store) => `Order ${o.reference} has been delivered. Enjoy your new pieces, and thank you for choosing ${store}!`,
  cancelled: (o, store, note) => `Order ${o.reference} from ${store} has been cancelled.${note ? ` ${note}` : ''} Questions? Reply or call us.`,
  confirmed: (o, store) => `Order ${o.reference} is confirmed by ${store}. We will text you when it ships.`,
}

// ---- Transitions ------------------------------------------------------------------------------

/** Marks an order paid (once), confirms it and records the sale in analytics. */
export async function markOrderPaid(orderId: number, by: { userId: number | null; channel: string; note?: string | null }) {
  const paid = await withTransaction(async (conn) => {
    const r = await exec(
      "UPDATE orders SET payment_status = 'paid', paid_at = NOW(), status = IF(status = 'pending', 'confirmed', status) WHERE id = ? AND payment_status <> 'paid' AND status <> 'cancelled'",
      [orderId],
      conn,
    )
    if (!r.affectedRows) return false
    const items = await rows<{ productId: number | null; quantity: number; lineTotal: number }>(
      'SELECT product_id, quantity, line_total FROM order_items WHERE order_id = ?',
      [orderId],
      conn,
    )
    const order = await one<{ userId: number | null }>('SELECT user_id FROM orders WHERE id = ?', [orderId], conn)
    for (const it of items) {
      if (!it.productId) continue
      await exec('UPDATE products SET sold_count = sold_count + ? WHERE id = ?', [it.quantity, it.productId], conn)
      await insert(
        'product_events',
        { productId: it.productId, event: 'purchase', quantity: it.quantity, revenue: it.lineTotal, userId: order?.userId ?? null, source: by.channel },
        conn,
      )
    }
    await insert('order_events', { orderId, kind: 'paid', note: by.note ?? `Payment confirmed (${by.channel})`, userId: by.userId }, conn)
    return true
  })
  if (paid) {
    bustCache()
    const order = await one<OrderRow>(
      'SELECT id, reference, user_id, customer_name, email, phone, total, status, payment_status, payment_method, delivery_method FROM orders WHERE id = ?',
      [orderId],
    )
    if (order) await notifyPaid(order)
  }
  return paid
}

export async function changeOrderStatus(
  reference: string,
  status: OrderStatus,
  opts: { userId: number; note: string | null; notify: boolean },
) {
  const order = await findOrder(reference)
  if (order.status === status) return order
  if (order.status === 'cancelled') throw new AppError('This order was cancelled and cannot be changed.', 409)

  await withTransaction(async (conn) => {
    await exec('UPDATE orders SET status = ? WHERE id = ?', [status, order.id], conn)
    // Cancelling puts the pieces back on sale.
    if (status === 'cancelled') {
      const items = await rows<{ productId: number | null; variantId: number | null; quantity: number }>(
        'SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?',
        [order.id],
        conn,
      )
      for (const it of items) {
        if (it.productId) await exec('UPDATE products SET stock = stock + ? WHERE id = ? AND track_stock = 1', [it.quantity, it.productId], conn)
        if (it.variantId) await exec('UPDATE product_variants SET stock = stock + ? WHERE id = ?', [it.quantity, it.variantId], conn)
      }
    }
    await insert('order_events', { orderId: order.id, kind: status, note: opts.note ?? ORDER_STATUS_LABELS[status], userId: opts.userId }, conn)
  })
  bustCache()

  const s = await getSettings()
  const message = STATUS_MESSAGES[status]
  if (opts.notify && message && s.notifications.smsEnabled && s.notifications.statusChanged) {
    sendSmsLater([order.phone], message({ ...order, status }, s.store.name, opts.note), { context: `status_${status}`, orderId: order.id })
  }
  return { ...order, status }
}
