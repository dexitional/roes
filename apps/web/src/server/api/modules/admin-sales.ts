// Admin: orders, customers, reviews and coupons.
import { Hono } from 'hono'
import { z } from 'zod'
import { couponSchema, orderStatusSchema, reviewStatusSchema } from '#/lib/schemas'
import { requireStaff } from '../lib/auth'
import { bustCache } from '../lib/cache'
import { exec, insert, like, one, paging, parseId, rows, scalar, update } from '../lib/db'
import { AppError, notFound } from '../lib/errors'
import { changeOrderStatus, findOrder, logOrderEvent, markOrderPaid } from '../lib/orders'
import { sendSms } from '../lib/sms'
import { validate } from '../lib/validate'

async function orderDetail(reference: string) {
  const order = await one<Record<string, any>>(
    `SELECT o.*, u.avatar_url, (SELECT COUNT(*) FROM orders WHERE user_id = o.user_id) AS customer_orders
       FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.reference = ?`,
    [reference],
  )
  if (!order) throw notFound('Order')
  const [items, events, sms] = await Promise.all([
    rows(
      `SELECT oi.*, p.slug, p.stock AS current_stock FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`,
      [order.id],
    ),
    rows(
      `SELECT e.kind, e.note, e.created_at, u.full_name AS by_name FROM order_events e LEFT JOIN users u ON u.id = e.user_id
        WHERE e.order_id = ? ORDER BY e.created_at, e.id`,
      [order.id],
    ),
    rows('SELECT recipient, message, status, error, created_at FROM sms_logs WHERE order_id = ? ORDER BY id', [order.id]),
  ])
  return { ...order, items, events, sms }
}

const recalcRating = (productId: number) =>
  exec(
    `UPDATE products p SET
       rating_avg = COALESCE((SELECT AVG(rating) FROM reviews WHERE product_id = p.id AND status = 'approved'), 0),
       rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = p.id AND status = 'approved')
     WHERE p.id = ?`,
    [productId],
  )

export const adminSalesRoute = new Hono()
  .use(requireStaff)

  // ---- Orders ----
  .get('/orders', async (c) => {
    const q = c.req.query()
    const { page, pageSize, limit, offset } = paging(q, 25)
    const where: Array<string> = []
    const params: Array<unknown> = []
    if (q.status) {
      where.push('o.status = ?')
      params.push(q.status)
    }
    if (q.payment) {
      where.push('o.payment_status = ?')
      params.push(q.payment)
    }
    if (q.q) {
      where.push('(o.reference LIKE ? OR o.customer_name LIKE ? OR o.phone LIKE ? OR o.email LIKE ? OR o.momo_transaction_id LIKE ?)')
      params.push(...Array(5).fill(like(q.q)))
    }
    if (q.from) {
      where.push('o.created_at >= ?')
      params.push(q.from)
    }
    if (q.to) {
      where.push('o.created_at < ? + INTERVAL 1 DAY')
      params.push(q.to)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const [data, total, counts] = await Promise.all([
      rows(
        `SELECT o.id, o.reference, o.customer_name, o.phone, o.total, o.status, o.payment_status, o.payment_method,
                o.delivery_method, o.region, o.created_at, o.momo_transaction_id,
                (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS item_count,
                (SELECT image_url FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS image
           FROM orders o ${whereSql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      scalar(`SELECT COUNT(*) FROM orders o ${whereSql}`, params),
      rows<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM orders GROUP BY status'),
    ])
    const toConfirm = await scalar("SELECT COUNT(*) FROM orders WHERE payment_status = 'submitted' AND status <> 'cancelled'")
    return c.json({
      data,
      total: Number(total),
      page,
      pageSize,
      counts: { ...Object.fromEntries(counts.map((r) => [r.status, Number(r.n)])), toConfirm: Number(toConfirm) },
    })
  })

  .get('/orders/:reference', async (c) => c.json(await orderDetail(c.req.param('reference'))))

  .post('/orders/:reference/confirm-payment', validate('json', z.object({ note: z.string().max(300).nullish() })), async (c) => {
    const me = c.get('user')
    const order = await findOrder(c.req.param('reference'))
    if (order.status === 'cancelled') throw new AppError('This order was cancelled.', 409)
    const done = await markOrderPaid(order.id, { userId: me.id, channel: order.paymentMethod, note: c.req.valid('json').note ?? null })
    if (!done) throw new AppError('This order is already marked as paid.', 409)
    return c.json(await orderDetail(order.reference))
  })

  .post('/orders/:reference/reject-payment', validate('json', z.object({ note: z.string().max(300).nullish() })), async (c) => {
    const me = c.get('user')
    const order = await findOrder(c.req.param('reference'))
    if (order.paymentStatus === 'paid') throw new AppError('This order is already paid.', 409)
    const note = c.req.valid('json').note || 'We could not find this MoMo payment.'
    await exec("UPDATE orders SET payment_status = 'pending' WHERE id = ?", [order.id])
    await logOrderEvent(order.id, 'payment_rejected', note, me.id)
    void sendSms([order.phone], `We could not confirm the MoMo payment for order ${order.reference}. ${note} Please check and send it again.`, {
      context: 'payment_rejected',
      orderId: order.id,
    }).catch(() => undefined)
    return c.json(await orderDetail(order.reference))
  })

  .patch('/orders/:reference/status', validate('json', orderStatusSchema), async (c) => {
    const me = c.get('user')
    const { status, note, notify } = c.req.valid('json')
    await changeOrderStatus(c.req.param('reference'), status, { userId: me.id, note, notify })
    return c.json(await orderDetail(c.req.param('reference')))
  })

  .post('/orders/:reference/note', validate('json', z.object({ note: z.string().trim().min(1).max(500) })), async (c) => {
    const order = await findOrder(c.req.param('reference'))
    await logOrderEvent(order.id, 'note', c.req.valid('json').note, c.get('user').id)
    return c.json(await orderDetail(order.reference))
  })

  .post('/orders/:reference/sms', validate('json', z.object({ message: z.string().trim().min(2).max(480) })), async (c) => {
    const order = await findOrder(c.req.param('reference'))
    const [result] = await sendSms([order.phone], c.req.valid('json').message, { context: 'manual', orderId: order.id })
    if (!result?.ok) throw new AppError(`The SMS was not sent: ${result?.error ?? 'unknown error'}`, 422)
    return c.json(await orderDetail(order.reference))
  })

  // ---- Customers ----
  .get('/customers', async (c) => {
    const q = c.req.query()
    const { page, pageSize, limit, offset } = paging(q, 25)
    const where = ["u.role = 'customer'"]
    const params: Array<unknown> = []
    if (q.q) {
      where.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)')
      params.push(like(q.q), like(q.q), like(q.q))
    }
    const sort: Record<string, string> = { recent: 'u.created_at DESC', spent: 'spent DESC', orders: 'orders DESC', name: 'u.full_name' }
    const [data, total] = await Promise.all([
      rows(
        `SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url, u.created_at, u.last_login_at, u.is_active,
                COUNT(o.id) AS orders, COALESCE(SUM(IF(o.payment_status = 'paid', o.total, 0)), 0) AS spent, MAX(o.created_at) AS last_order_at,
                (SELECT COUNT(*) FROM wishlists w WHERE w.user_id = u.id) AS wishlist
           FROM users u LEFT JOIN orders o ON o.user_id = u.id
          WHERE ${where.join(' AND ')} GROUP BY u.id ORDER BY ${sort[q.sort ?? 'recent'] ?? sort.recent} LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      scalar(`SELECT COUNT(*) FROM users u WHERE ${where.join(' AND ')}`, params),
    ])
    return c.json({ data, total: Number(total), page, pageSize })
  })

  .get('/customers/:id', async (c) => {
    const id = parseId(c.req.param('id'))
    const customer = await one('SELECT id, full_name, email, phone, avatar_url, created_at, last_login_at, is_active FROM users WHERE id = ?', [id])
    if (!customer) throw notFound('Customer')
    const [orders, wishlist, viewed] = await Promise.all([
      rows('SELECT reference, total, status, payment_status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC', [id]),
      rows(
        `SELECT p.id, p.name, p.slug, (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS image
           FROM wishlists w JOIN products p ON p.id = w.product_id WHERE w.user_id = ? ORDER BY w.created_at DESC LIMIT 12`,
        [id],
      ),
      rows(
        `SELECT p.id, p.name, p.slug, COUNT(*) AS views FROM product_events e JOIN products p ON p.id = e.product_id
          WHERE e.user_id = ? AND e.event = 'view' GROUP BY p.id ORDER BY views DESC LIMIT 8`,
        [id],
      ),
    ])
    return c.json({ ...customer, orders, wishlist, viewed })
  })

  .patch('/customers/:id', validate('json', z.object({ isActive: z.boolean() })), async (c) => {
    await exec("UPDATE users SET is_active = ? WHERE id = ? AND role = 'customer'", [c.req.valid('json').isActive ? 1 : 0, parseId(c.req.param('id'))])
    return c.json({ ok: true })
  })

  // ---- Reviews ----
  .get('/reviews', async (c) => {
    const status = c.req.query('status') || 'pending'
    const list = await rows(
      `SELECT r.id, r.rating, r.title, r.body, r.status, r.is_verified_buyer, r.created_at, u.full_name, u.email,
              p.id AS product_id, p.name AS product_name, p.slug AS product_slug,
              (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS image
         FROM reviews r JOIN users u ON u.id = r.user_id JOIN products p ON p.id = r.product_id
        WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200`,
      [status],
    )
    const counts = await rows<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM reviews GROUP BY status')
    return c.json({ data: list, counts: Object.fromEntries(counts.map((r) => [r.status, Number(r.n)])) })
  })

  .patch('/reviews/:id', validate('json', reviewStatusSchema), async (c) => {
    const id = parseId(c.req.param('id'))
    const review = await one<{ productId: number }>('SELECT product_id FROM reviews WHERE id = ?', [id])
    if (!review) throw notFound('Review')
    await exec('UPDATE reviews SET status = ? WHERE id = ?', [c.req.valid('json').status, id])
    await recalcRating(review.productId)
    bustCache()
    return c.json({ ok: true })
  })

  .delete('/reviews/:id', async (c) => {
    const id = parseId(c.req.param('id'))
    const review = await one<{ productId: number }>('SELECT product_id FROM reviews WHERE id = ?', [id])
    await exec('DELETE FROM reviews WHERE id = ?', [id])
    if (review) await recalcRating(review.productId)
    bustCache()
    return c.json({ ok: true })
  })

  // ---- Coupons ----
  .get('/coupons', async (c) => c.json(await rows('SELECT * FROM coupons ORDER BY created_at DESC')))
  .post('/coupons', validate('json', couponSchema), async (c) => {
    const input = c.req.valid('json')
    if (input.kind === 'percent' && input.value > 100) throw new AppError('A percentage cannot be over 100.', 422)
    const id = await insert('coupons', { ...input, isActive: input.isActive ? 1 : 0 })
    return c.json({ id }, 201)
  })
  .put('/coupons/:id', validate('json', couponSchema), async (c) => {
    const input = c.req.valid('json')
    if (input.kind === 'percent' && input.value > 100) throw new AppError('A percentage cannot be over 100.', 422)
    await update('coupons', parseId(c.req.param('id')), { ...input, isActive: input.isActive ? 1 : 0 })
    return c.json({ ok: true })
  })
  .delete('/coupons/:id', async (c) => {
    await exec('DELETE FROM coupons WHERE id = ?', [parseId(c.req.param('id'))])
    return c.json({ ok: true })
  })
