// Admin dashboard and product analytics.
//   GET /api/admin/dashboard
//   GET /api/admin/analytics?days=30 | from=&to=
//   GET /api/admin/analytics/products?sort=&q=&categoryId=
//   GET /api/admin/analytics/products/:id
import { Hono } from 'hono'
import { requireStaff } from '../lib/auth'
import { analyticsOverview, eachDay, productDrilldown, productInsights, productMetrics, rangeFrom, searchInsights } from '../lib/analytics'
import { one, parseId, rows } from '../lib/db'
import { notFound } from '../lib/errors'
import { smsBalance, smsStatus } from '../lib/sms'

export const adminInsightsRoute = new Hono()
  .use(requireStaff)

  .get('/badges', async (c) => {
    const r = await one<{ orders: number; reviews: number }>(
      `SELECT (SELECT COUNT(*) FROM orders WHERE payment_status = 'submitted' AND status <> 'cancelled') AS orders,
              (SELECT COUNT(*) FROM reviews WHERE status = 'pending') AS reviews`,
    )
    return c.json({ orders: Number(r?.orders ?? 0), reviews: Number(r?.reviews ?? 0) })
  })

  .get('/dashboard', async (c) => {
    const r = rangeFrom({ days: c.req.query('days') ?? '30' })
    const [kpi, prevKpi, today, daily, byStatus, recent, lowStock, attention, top, customers] = await Promise.all([
      one<Record<string, number>>(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue, COUNT(DISTINCT user_id) AS customers
           FROM orders WHERE payment_status = 'paid' AND paid_at >= ? AND paid_at < ? + INTERVAL 1 DAY`,
        [r.from, r.to],
      ),
      one<Record<string, number>>(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue FROM orders
          WHERE payment_status = 'paid' AND paid_at >= ? AND paid_at < ? + INTERVAL 1 DAY`,
        [r.prevFrom, r.prevTo],
      ),
      one<Record<string, number>>(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(IF(payment_status = 'paid', total, 0)), 0) AS revenue FROM orders WHERE DATE(created_at) = CURDATE()`,
      ),
      rows<{ day: string; orders: number; revenue: number }>(
        `SELECT DATE(paid_at) AS day, COUNT(*) AS orders, SUM(total) AS revenue FROM orders
          WHERE payment_status = 'paid' AND paid_at >= ? AND paid_at < ? + INTERVAL 1 DAY GROUP BY DATE(paid_at)`,
        [r.from, r.to],
      ),
      rows<{ status: string; n: number }>(
        'SELECT status, COUNT(*) AS n FROM orders WHERE created_at >= ? AND created_at < ? + INTERVAL 1 DAY GROUP BY status',
        [r.from, r.to],
      ),
      rows(
        `SELECT reference, customer_name, total, status, payment_status, payment_method, created_at,
                (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS item_count
           FROM orders o ORDER BY created_at DESC LIMIT 8`,
      ),
      rows(
        `SELECT p.id, p.name, p.slug, p.stock, (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS image
           FROM products p WHERE p.status = 'active' AND p.track_stock = 1 AND p.stock <= 2 ORDER BY p.sold_count DESC, p.stock ASC LIMIT 6`,
      ),
      one<Record<string, number>>(
        `SELECT (SELECT COUNT(*) FROM orders WHERE payment_status = 'submitted' AND status <> 'cancelled') AS payments_to_confirm,
                (SELECT COUNT(*) FROM orders WHERE payment_status = 'paid' AND status IN ('confirmed', 'processing')) AS to_ship,
                (SELECT COUNT(*) FROM reviews WHERE status = 'pending') AS reviews_pending,
                (SELECT COUNT(*) FROM orders WHERE payment_status = 'pending' AND status = 'pending' AND created_at < NOW() - INTERVAL 1 DAY) AS stale_unpaid`,
      ),
      productMetrics(r, { sort: 'revenue', limit: 6 }),
      one<Record<string, number>>(
        `SELECT COUNT(*) AS total, SUM(created_at >= ?) AS new_customers FROM users WHERE role = 'customer'`,
        [r.from],
      ),
    ])
    const byDay = new Map(daily.map((d) => [String(d.day).slice(0, 10), d]))
    const n = (v: unknown) => Number(v ?? 0)
    return c.json({
      range: r,
      kpi: {
        revenue: n(kpi?.revenue),
        orders: n(kpi?.orders),
        aov: n(kpi?.orders) ? n(kpi?.revenue) / n(kpi?.orders) : 0,
        prevRevenue: n(prevKpi?.revenue),
        prevOrders: n(prevKpi?.orders),
        todayOrders: n(today?.orders),
        todayRevenue: n(today?.revenue),
        customers: n(customers?.total),
        newCustomers: n(customers?.newCustomers),
      },
      series: eachDay(r.from, r.to).map((day) => ({ day, revenue: n(byDay.get(day)?.revenue), orders: n(byDay.get(day)?.orders) })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: n(s.n) })),
      recent,
      lowStock,
      attention: {
        paymentsToConfirm: n(attention?.paymentsToConfirm),
        toShip: n(attention?.toShip),
        reviewsPending: n(attention?.reviewsPending),
        staleUnpaid: n(attention?.staleUnpaid),
      },
      top: top.filter((p) => p.units > 0 || p.revenue > 0),
      sms: { ...smsStatus(), balance: await smsBalance() },
    })
  })

  .get('/analytics', async (c) => {
    const r = rangeFrom(c.req.query())
    const [overview, insights, searches] = await Promise.all([analyticsOverview(r), productInsights(r), searchInsights(r)])
    return c.json({ ...overview, insights, searches })
  })

  .get('/analytics/products', async (c) => {
    const q = c.req.query()
    const r = rangeFrom(q)
    const list = await productMetrics(r, {
      sort: q.sort,
      limit: Number(q.limit) || 100,
      categoryId: parseId(q.categoryId) || undefined,
      q: q.q?.trim() || undefined,
    })
    return c.json({ range: r, data: list })
  })

  .get('/analytics/products/:id', async (c) => {
    const id = parseId(c.req.param('id'))
    const product = await one(
      `SELECT p.id, p.name, p.slug, p.price, p.stock, p.sold_count, p.view_count, p.rating_avg, p.rating_count, c.name AS category,
              (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS image
         FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
      [id],
    )
    if (!product) throw notFound('Product')
    const r = rangeFrom(c.req.query())
    return c.json({ product, ...(await productDrilldown(id, r)) })
  })
