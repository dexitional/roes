// Signed-in customer: checkout, orders, MoMo payment proof, wishlist, reviews.
//
//   POST /api/me/orders                     place an order (checkout)
//   GET  /api/me/orders                     my orders
//   GET  /api/me/orders/:reference          one of my orders
//   POST /api/me/orders/:reference/momo     "I've paid": MoMo sender + transaction ID
//   GET  /api/me/wishlist                   POST /api/me/wishlist/:productId (toggle)
//   POST /api/me/reviews
import { Hono } from 'hono'
import { normalizePhone } from '#/lib/phone'
import { checkoutSchema, momoProofSchema, reviewSchema } from '#/lib/schemas'
import { requireUser } from '../lib/auth'
import { bustCache } from '../lib/cache'
import { cards } from '../lib/catalog'
import { orderReference } from '../lib/codes'
import { exec, insert, one, parseId, rows, withTransaction } from '../lib/db'
import { AppError, notFound } from '../lib/errors'
import { findOrder, logOrderEvent, notifyOrderPlaced, notifyPaymentSubmitted } from '../lib/orders'
import { paystackConfigured, startPaystack } from '../lib/paystack'
import { priceCart } from '../lib/pricing'
import { rateLimit } from '../lib/rate-limit'
import { getSettings } from '../lib/settings'
import { validate } from '../lib/validate'
import { deviceOf, visitorId } from '../lib/visitor'

async function orderDetail(reference: string, userId: number) {
  const order = await one<Record<string, any>>('SELECT * FROM orders WHERE reference = ? AND user_id = ?', [reference, userId])
  if (!order) throw notFound('Order')
  const [items, events] = await Promise.all([
    rows(
      `SELECT oi.id, oi.product_id, oi.name, oi.variant_label, oi.image_url, oi.unit_price, oi.quantity, oi.line_total, p.slug
         FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`,
      [order.id],
    ),
    rows('SELECT kind, note, created_at FROM order_events WHERE order_id = ? ORDER BY created_at, id', [order.id]),
  ])
  return { ...order, items, events }
}

export const accountRoute = new Hono()
  .use(requireUser)

  .post('/orders', rateLimit('checkout', 15, 600), validate('json', checkoutSchema), async (c) => {
    const me = c.get('user')
    const input = c.req.valid('json')
    const settings = await getSettings()
    const usePaystack = input.paymentMethod === 'paystack'
    if (usePaystack && !(settings.payments.paystackEnabled && paystackConfigured())) {
      throw new AppError('Card payments are not available yet. Please pay by MoMo.', 422)
    }
    if (input.deliveryMethod === 'delivery' && (!input.address || !input.region)) {
      throw new AppError('Enter your region and delivery address, or choose pickup.', 422)
    }
    const phone = normalizePhone(input.phone)!

    const placed = await withTransaction(async (conn) => {
      const quote = await priceCart(input.items, input, settings, conn, true)
      const blocked = quote.lines.filter((l) => l.issue)
      if (!quote.lines.length) throw new AppError('Your bag is empty.', 422)
      if (blocked.length) {
        throw new AppError(`Some items changed: ${blocked.map((l) => `${l.name} (${l.issue?.toLowerCase()})`).join(', ')}. Please review your bag.`, 409)
      }
      if (input.couponCode && quote.couponError) throw new AppError(quote.couponError, 422)

      let reference = orderReference()
      for (let i = 0; i < 3 && (await one('SELECT id FROM orders WHERE reference = ?', [reference], conn)); i++) reference = orderReference()

      const orderId = await insert(
        'orders',
        {
          reference,
          userId: me.id,
          customerName: input.customerName,
          email: me.email,
          phone,
          deliveryMethod: input.deliveryMethod,
          region: input.deliveryMethod === 'delivery' ? input.region : null,
          city: input.deliveryMethod === 'delivery' ? input.city : null,
          address: input.deliveryMethod === 'delivery' ? input.address : null,
          notes: input.notes,
          subtotal: quote.subtotal,
          deliveryFee: quote.deliveryFee,
          discount: quote.discount,
          total: quote.total,
          couponCode: quote.coupon?.code ?? null,
          paymentMethod: input.paymentMethod,
        },
        conn,
      )
      const vid = visitorId(c)
      const device = deviceOf(c)
      for (const l of quote.lines) {
        await insert(
          'order_items',
          {
            orderId,
            productId: l.productId,
            variantId: l.variantId,
            name: l.name,
            variantLabel: l.variantLabel,
            imageUrl: l.image,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            lineTotal: l.lineTotal,
          },
          conn,
        )
        // Stock is held from the moment the order is placed (and released if it's cancelled).
        await exec('UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ? AND track_stock = 1', [l.quantity, l.productId], conn)
        if (l.variantId) await exec('UPDATE product_variants SET stock = GREATEST(0, stock - ?) WHERE id = ?', [l.quantity, l.variantId], conn)
        await insert('product_events', { productId: l.productId, event: 'checkout', quantity: l.quantity, visitorId: vid, userId: me.id, device, source: 'checkout' }, conn)
      }
      if (quote.coupon) await exec('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?', [quote.coupon.code], conn)
      await insert('order_events', { orderId, kind: 'placed', note: 'Order placed', userId: me.id }, conn)
      // Remember the phone for next time.
      await exec('UPDATE users SET phone = COALESCE(phone, ?) WHERE id = ?', [phone, me.id], conn)
      return { orderId, reference, total: quote.total }
    })
    bustCache()

    const order = await findOrder(placed.reference)
    void notifyOrderPlaced(order).catch((err) => console.error('[orders] notify failed:', err))
    let paymentUrl: string | null = null
    if (usePaystack) paymentUrl = await startPaystack({ id: placed.orderId, reference: placed.reference, total: placed.total, email: me.email })
    return c.json({ reference: placed.reference, paymentUrl }, 201)
  })

  .get('/orders', async (c) => {
    const me = c.get('user')
    const list = await rows(
      `SELECT o.reference, o.total, o.status, o.payment_status, o.payment_method, o.created_at,
              (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS item_count,
              (SELECT image_url FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS image
         FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 100`,
      [me.id],
    )
    return c.json(list)
  })

  .get('/orders/:reference', async (c) => c.json(await orderDetail(c.req.param('reference'), c.get('user').id)))

  .post('/orders/:reference/momo', rateLimit('momo', 10, 600), validate('json', momoProofSchema), async (c) => {
    const me = c.get('user')
    const { sender, transactionId } = c.req.valid('json')
    const order = await findOrder(c.req.param('reference'))
    if (order.userId !== me.id) throw notFound('Order')
    if (order.paymentStatus === 'paid') throw new AppError('This order is already paid.', 409)
    if (order.status === 'cancelled') throw new AppError('This order was cancelled.', 409)
    await exec("UPDATE orders SET payment_status = 'submitted', momo_sender = ?, momo_transaction_id = ? WHERE id = ?", [
      normalizePhone(sender),
      transactionId,
      order.id,
    ])
    await logOrderEvent(order.id, 'payment_submitted', `MoMo payment sent from ${sender}, transaction ${transactionId}`, me.id)
    void notifyPaymentSubmitted(order, transactionId).catch(() => undefined)
    return c.json(await orderDetail(order.reference, me.id))
  })

  .get('/wishlist', async (c) => {
    const me = c.get('user')
    const ids = await rows<{ productId: number }>('SELECT product_id FROM wishlists WHERE user_id = ? ORDER BY created_at DESC', [me.id])
    const list = ids.length
      ? await cards(`p.id IN (${ids.map(() => '?').join(',')})`, ids.map((r) => r.productId), 'p.name', 200)
      : []
    return c.json({ ids: ids.map((r) => r.productId), products: list })
  })

  .post('/wishlist/:productId', async (c) => {
    const me = c.get('user')
    const productId = parseId(c.req.param('productId'))
    const existing = await one('SELECT product_id FROM wishlists WHERE user_id = ? AND product_id = ?', [me.id, productId])
    if (existing) {
      await exec('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?', [me.id, productId])
      return c.json({ saved: false })
    }
    if (!(await one("SELECT id FROM products WHERE id = ? AND status = 'active'", [productId]))) throw notFound('Product')
    await exec('INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)', [me.id, productId])
    await insert('product_events', { productId, event: 'wishlist', userId: me.id, visitorId: visitorId(c), device: deviceOf(c) })
    return c.json({ saved: true })
  })

  .post('/reviews', rateLimit('review', 10, 3600), validate('json', reviewSchema), async (c) => {
    const me = c.get('user')
    const input = c.req.valid('json')
    const bought = await one(
      `SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.user_id = ? AND oi.product_id = ? AND o.payment_status = 'paid' LIMIT 1`,
      [me.id, input.productId],
    )
    await exec(
      `INSERT INTO reviews (product_id, user_id, rating, title, body, is_verified_buyer, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), title = VALUES(title), body = VALUES(body), status = 'pending'`,
      [input.productId, me.id, input.rating, input.title, input.body, bought ? 1 : 0],
    )
    return c.json({ ok: true, message: 'Thank you! Your review will appear once it has been checked.' }, 201)
  })
