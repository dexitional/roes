// Product analytics over product_events (views, add-to-carts, wishlists,
// checkouts, purchases), orders and search_queries.
import { one, rows } from './db'

export interface Range {
  from: string // inclusive, YYYY-MM-DD
  to: string // inclusive, YYYY-MM-DD
  prevFrom: string
  prevTo: string
  days: number
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)

export function rangeFrom(query: Record<string, string | undefined>): Range {
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null)
  let to = valid(query.to) ?? ymd(new Date())
  let from = valid(query.from)
  if (!from) {
    const days = Math.min(730, Math.max(1, Number(query.days) || 30))
    const d = new Date(`${to}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - (days - 1))
    from = ymd(d)
  }
  if (from > to) [from, to] = [to, from]
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  const prevTo = new Date(`${from}T00:00:00Z`)
  prevTo.setUTCDate(prevTo.getUTCDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1))
  return { from, to, prevFrom: ymd(prevFrom), prevTo: ymd(prevTo), days }
}

const between = (col: string) => `${col} >= ? AND ${col} < ? + INTERVAL 1 DAY`

export function eachDay(from: string, to: string) {
  const out: Array<string> = []
  const d = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (d <= end) {
    out.push(ymd(d))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

async function totals(from: string, to: string) {
  const [ev, orders] = await Promise.all([
    one<Record<string, number>>(
      `SELECT
         SUM(event = 'view') AS views,
         COUNT(DISTINCT IF(event = 'view', visitor_id, NULL)) AS visitors,
         SUM(IF(event = 'add_to_cart', quantity, 0)) AS carts,
         COUNT(DISTINCT IF(event = 'add_to_cart', visitor_id, NULL)) AS cart_visitors,
         SUM(event = 'wishlist') AS wishlists,
         SUM(IF(event = 'checkout', quantity, 0)) AS checkouts,
         SUM(IF(event = 'purchase', quantity, 0)) AS units
       FROM product_events WHERE ${between('created_at')}`,
      [from, to],
    ),
    one<Record<string, number>>(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue, COUNT(DISTINCT user_id) AS buyers
         FROM orders WHERE payment_status = 'paid' AND ${between('paid_at')}`,
      [from, to],
    ),
  ])
  const n = (v: unknown) => Number(v ?? 0)
  const views = n(ev?.views)
  const visitors = n(ev?.visitors)
  const orderCount = n(orders?.orders)
  const revenue = n(orders?.revenue)
  return {
    views,
    visitors,
    carts: n(ev?.carts),
    cartVisitors: n(ev?.cartVisitors),
    wishlists: n(ev?.wishlists),
    checkouts: n(ev?.checkouts),
    units: n(ev?.units),
    orders: orderCount,
    revenue,
    buyers: n(orders?.buyers),
    aov: orderCount ? revenue / orderCount : 0,
    cartRate: views ? (n(ev?.carts) / views) * 100 : 0,
    conversionRate: visitors ? (orderCount / visitors) * 100 : 0,
  }
}

export async function analyticsOverview(r: Range) {
  const [current, previous] = await Promise.all([totals(r.from, r.to), totals(r.prevFrom, r.prevTo)])

  const [daily, dailyOrders] = await Promise.all([
    rows<{ day: string; views: number; visitors: number; carts: number; units: number }>(
      `SELECT DATE(created_at) AS day, SUM(event = 'view') AS views, COUNT(DISTINCT IF(event = 'view', visitor_id, NULL)) AS visitors,
              SUM(IF(event = 'add_to_cart', quantity, 0)) AS carts, SUM(IF(event = 'purchase', quantity, 0)) AS units
         FROM product_events WHERE ${between('created_at')} GROUP BY DATE(created_at)`,
      [r.from, r.to],
    ),
    rows<{ day: string; orders: number; revenue: number }>(
      `SELECT DATE(paid_at) AS day, COUNT(*) AS orders, SUM(total) AS revenue FROM orders
        WHERE payment_status = 'paid' AND ${between('paid_at')} GROUP BY DATE(paid_at)`,
      [r.from, r.to],
    ),
  ])
  const byDay = new Map(daily.map((d) => [String(d.day).slice(0, 10), d]))
  const ordersByDay = new Map(dailyOrders.map((d) => [String(d.day).slice(0, 10), d]))
  const series = eachDay(r.from, r.to).map((day) => ({
    day,
    views: Number(byDay.get(day)?.views ?? 0),
    visitors: Number(byDay.get(day)?.visitors ?? 0),
    carts: Number(byDay.get(day)?.carts ?? 0),
    units: Number(byDay.get(day)?.units ?? 0),
    orders: Number(ordersByDay.get(day)?.orders ?? 0),
    revenue: Number(ordersByDay.get(day)?.revenue ?? 0),
  }))

  // Funnel by unique visitor: viewed → added to bag → checked out → bought.
  const funnelRow = await one<Record<string, number>>(
    `SELECT COUNT(DISTINCT IF(event = 'view', visitor_id, NULL)) AS viewed,
            COUNT(DISTINCT IF(event = 'add_to_cart', visitor_id, NULL)) AS carted,
            COUNT(DISTINCT IF(event = 'checkout', COALESCE(visitor_id, CONCAT('u', user_id)), NULL)) AS checked_out,
            COUNT(DISTINCT IF(event = 'purchase', COALESCE(visitor_id, CONCAT('u', user_id)), NULL)) AS purchased
       FROM product_events WHERE ${between('created_at')}`,
    [r.from, r.to],
  )
  const funnel = [
    { stage: 'Viewed a product', value: Number(funnelRow?.viewed ?? 0) },
    { stage: 'Added to bag', value: Number(funnelRow?.carted ?? 0) },
    { stage: 'Started checkout', value: Number(funnelRow?.checkedOut ?? 0) },
    { stage: 'Purchased', value: Number(funnelRow?.purchased ?? 0) },
  ]

  const [categories, devices, sources, heatmap] = await Promise.all([
    rows<{ name: string; views: number; carts: number; units: number; revenue: number }>(
      `SELECT COALESCE(c.name, 'Uncategorised') AS name,
              SUM(e.event = 'view') AS views, SUM(IF(e.event = 'add_to_cart', e.quantity, 0)) AS carts,
              SUM(IF(e.event = 'purchase', e.quantity, 0)) AS units, SUM(IF(e.event = 'purchase', e.revenue, 0)) AS revenue
         FROM product_events e JOIN products p ON p.id = e.product_id LEFT JOIN categories c ON c.id = p.category_id
        WHERE ${between('e.created_at')} GROUP BY c.id, c.name ORDER BY revenue DESC, views DESC`,
      [r.from, r.to],
    ),
    rows<{ device: string; views: number; carts: number }>(
      `SELECT COALESCE(device, 'desktop') AS device, SUM(event = 'view') AS views, SUM(event = 'add_to_cart') AS carts
         FROM product_events WHERE ${between('created_at')} AND event IN ('view', 'add_to_cart') GROUP BY device`,
      [r.from, r.to],
    ),
    rows<{ source: string; views: number; carts: number }>(
      `SELECT COALESCE(source, 'direct') AS source, SUM(event = 'view') AS views, SUM(event = 'add_to_cart') AS carts
         FROM product_events WHERE ${between('created_at')} AND event IN ('view', 'add_to_cart') GROUP BY source ORDER BY views DESC LIMIT 12`,
      [r.from, r.to],
    ),
    rows<{ dow: number; hour: number; views: number }>(
      `SELECT DAYOFWEEK(created_at) AS dow, HOUR(created_at) AS hour, COUNT(*) AS views
         FROM product_events WHERE event = 'view' AND ${between('created_at')} GROUP BY dow, hour`,
      [r.from, r.to],
    ),
  ])

  return {
    range: r,
    current,
    previous,
    series,
    funnel,
    categories: categories.map((c) => ({
      name: c.name,
      views: Number(c.views),
      carts: Number(c.carts),
      units: Number(c.units),
      revenue: Number(c.revenue),
    })),
    devices: devices.map((d) => ({ device: d.device, views: Number(d.views), carts: Number(d.carts) })),
    sources: sources.map((s) => ({ source: s.source, views: Number(s.views), carts: Number(s.carts) })),
    heatmap: heatmap.map((h) => ({ dow: Number(h.dow), hour: Number(h.hour), views: Number(h.views) })),
  }
}

export interface ProductMetric {
  id: number
  name: string
  slug: string
  image: string | null
  category: string | null
  price: number
  stock: number
  status: string
  views: number
  visitors: number
  carts: number
  wishlists: number
  checkouts: number
  units: number
  revenue: number
  viewToCart: number
  cartToPurchase: number
  conversion: number
  prevViews: number
  trend: number
}

const PRODUCT_SORTS: Record<string, string> = {
  views: 'views DESC',
  revenue: 'revenue DESC, units DESC',
  units: 'units DESC, revenue DESC',
  carts: 'carts DESC',
  conversion: '(units / NULLIF(views, 0)) DESC, units DESC',
  wishlists: 'wishlists DESC',
}

export async function productMetrics(r: Range, opts: { sort?: string; limit?: number; categoryId?: number; q?: string } = {}) {
  const where: Array<string> = ["p.status <> 'archived'"]
  const params: Array<unknown> = [r.from, r.to, r.prevFrom, r.prevTo]
  if (opts.categoryId) {
    where.push('p.category_id = ?')
    params.push(opts.categoryId)
  }
  if (opts.q) {
    where.push('p.name LIKE ?')
    params.push(`%${opts.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
  }
  const list = await rows<Record<string, any>>(
    `SELECT p.id, p.name, p.slug, p.price, p.stock, p.status, c.name AS category,
            (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image,
            COALESCE(m.views, 0) AS views, COALESCE(m.visitors, 0) AS visitors, COALESCE(m.carts, 0) AS carts,
            COALESCE(m.wishlists, 0) AS wishlists, COALESCE(m.checkouts, 0) AS checkouts,
            COALESCE(m.units, 0) AS units, COALESCE(m.revenue, 0) AS revenue, COALESCE(pm.views, 0) AS prev_views
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN (
         SELECT product_id, SUM(event = 'view') AS views, COUNT(DISTINCT IF(event = 'view', visitor_id, NULL)) AS visitors,
                SUM(IF(event = 'add_to_cart', quantity, 0)) AS carts, SUM(event = 'wishlist') AS wishlists,
                SUM(IF(event = 'checkout', quantity, 0)) AS checkouts,
                SUM(IF(event = 'purchase', quantity, 0)) AS units, SUM(IF(event = 'purchase', revenue, 0)) AS revenue
           FROM product_events WHERE ${between('created_at')} GROUP BY product_id
       ) m ON m.product_id = p.id
       LEFT JOIN (
         SELECT product_id, SUM(event = 'view') AS views FROM product_events
          WHERE ${between('created_at')} GROUP BY product_id
       ) pm ON pm.product_id = p.id
      WHERE ${where.join(' AND ')}
      ORDER BY ${PRODUCT_SORTS[opts.sort ?? 'revenue'] ?? PRODUCT_SORTS.revenue}, p.id DESC
      LIMIT ?`,
    [...params, Math.min(500, opts.limit ?? 100)],
  )
  return list.map((p): ProductMetric => {
    const views = Number(p.views)
    const carts = Number(p.carts)
    const units = Number(p.units)
    const prevViews = Number(p.prevViews)
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      image: p.image,
      category: p.category,
      price: Number(p.price),
      stock: Number(p.stock),
      status: p.status,
      views,
      visitors: Number(p.visitors),
      carts,
      wishlists: Number(p.wishlists),
      checkouts: Number(p.checkouts),
      units,
      revenue: Number(p.revenue),
      viewToCart: views ? (carts / views) * 100 : 0,
      cartToPurchase: carts ? (units / carts) * 100 : 0,
      conversion: views ? (units / views) * 100 : 0,
      prevViews,
      trend: prevViews ? ((views - prevViews) / prevViews) * 100 : views ? 100 : 0,
    }
  })
}

/** Actionable lists: where attention (or promotion) pays off. */
export async function productInsights(r: Range) {
  const all = await productMetrics(r, { sort: 'views', limit: 500 })
  const active = all.filter((p) => p.status === 'active')
  const viewed = active.filter((p) => p.views > 0)
  const medianViews = viewed.length ? [...viewed].sort((a, b) => a.views - b.views)[Math.floor(viewed.length / 2)]!.views : 0
  return {
    // Lots of interest, nobody adds it to the bag: check price, photos, description.
    leaky: active
      .filter((p) => p.views >= Math.max(5, medianViews * 2) && p.viewToCart < 2)
      .sort((a, b) => b.views - a.views)
      .slice(0, 8),
    // Converts well but few people see it: feature it, share it.
    hiddenGems: active
      .filter((p) => p.units > 0 && p.views > 0 && p.views <= Math.max(medianViews, 3) && p.conversion >= 10)
      .sort((a, b) => b.conversion - a.conversion)
      .slice(0, 8),
    // Selling and almost gone.
    restock: active
      .filter((p) => p.units > 0 && p.stock <= 3)
      .sort((a, b) => b.units - a.units)
      .slice(0, 8),
    // Rising fastest against the previous period.
    trending: active
      .filter((p) => p.views >= 5 && p.trend > 25)
      .sort((a, b) => b.trend - a.trend)
      .slice(0, 8),
    unseen: active.filter((p) => p.views === 0).length,
    activeCount: active.length,
  }
}

export async function searchInsights(r: Range) {
  const [top, zero] = await Promise.all([
    rows<{ term: string; searches: number; results: number }>(
      `SELECT term, COUNT(*) AS searches, ROUND(AVG(results)) AS results FROM search_queries
        WHERE ${between('created_at')} GROUP BY term ORDER BY searches DESC LIMIT 20`,
      [r.from, r.to],
    ),
    rows<{ term: string; searches: number }>(
      `SELECT term, COUNT(*) AS searches FROM search_queries WHERE results = 0 AND ${between('created_at')}
        GROUP BY term ORDER BY searches DESC LIMIT 15`,
      [r.from, r.to],
    ),
  ])
  return {
    top: top.map((t) => ({ term: t.term, searches: Number(t.searches), results: Number(t.results) })),
    zero: zero.map((t) => ({ term: t.term, searches: Number(t.searches) })),
  }
}

export async function productDrilldown(productId: number, r: Range) {
  const [daily, sources, devices, totalsRow, rank] = await Promise.all([
    rows<{ day: string; views: number; carts: number; units: number; revenue: number }>(
      `SELECT DATE(created_at) AS day, SUM(event = 'view') AS views, SUM(IF(event = 'add_to_cart', quantity, 0)) AS carts,
              SUM(IF(event = 'purchase', quantity, 0)) AS units, SUM(IF(event = 'purchase', revenue, 0)) AS revenue
         FROM product_events WHERE product_id = ? AND ${between('created_at')} GROUP BY DATE(created_at)`,
      [productId, r.from, r.to],
    ),
    rows<{ source: string; views: number }>(
      `SELECT COALESCE(source, 'direct') AS source, COUNT(*) AS views FROM product_events
        WHERE product_id = ? AND event = 'view' AND ${between('created_at')} GROUP BY source ORDER BY views DESC`,
      [productId, r.from, r.to],
    ),
    rows<{ device: string; views: number }>(
      `SELECT COALESCE(device, 'desktop') AS device, COUNT(*) AS views FROM product_events
        WHERE product_id = ? AND event = 'view' AND ${between('created_at')} GROUP BY device`,
      [productId, r.from, r.to],
    ),
    one<Record<string, number>>(
      `SELECT SUM(event = 'view') AS views, COUNT(DISTINCT IF(event = 'view', visitor_id, NULL)) AS visitors,
              SUM(IF(event = 'add_to_cart', quantity, 0)) AS carts, SUM(event = 'wishlist') AS wishlists,
              SUM(IF(event = 'purchase', quantity, 0)) AS units, SUM(IF(event = 'purchase', revenue, 0)) AS revenue
         FROM product_events WHERE product_id = ? AND ${between('created_at')}`,
      [productId, r.from, r.to],
    ),
    one<{ position: number; total: number }>(
      `SELECT (SELECT COUNT(*) + 1 FROM (
                 SELECT product_id, SUM(event = 'view') AS v FROM product_events WHERE ${between('created_at')} GROUP BY product_id
               ) x WHERE x.v > (SELECT COUNT(*) FROM product_events WHERE product_id = ? AND event = 'view' AND ${between('created_at')})) AS position,
              (SELECT COUNT(*) FROM products WHERE status = 'active') AS total`,
      [r.from, r.to, productId, r.from, r.to],
    ),
  ])
  const byDay = new Map(daily.map((d) => [String(d.day).slice(0, 10), d]))
  const t = totalsRow ?? {}
  const views = Number(t.views ?? 0)
  const carts = Number(t.carts ?? 0)
  const units = Number(t.units ?? 0)
  return {
    totals: {
      views,
      visitors: Number(t.visitors ?? 0),
      carts,
      wishlists: Number(t.wishlists ?? 0),
      units,
      revenue: Number(t.revenue ?? 0),
      viewToCart: views ? (carts / views) * 100 : 0,
      conversion: views ? (units / views) * 100 : 0,
    },
    rank: { position: Number(rank?.position ?? 0), total: Number(rank?.total ?? 0) },
    series: eachDay(r.from, r.to).map((day) => ({
      day,
      views: Number(byDay.get(day)?.views ?? 0),
      carts: Number(byDay.get(day)?.carts ?? 0),
      units: Number(byDay.get(day)?.units ?? 0),
      revenue: Number(byDay.get(day)?.revenue ?? 0),
    })),
    sources: sources.map((s) => ({ source: s.source, views: Number(s.views) })),
    devices: devices.map((d) => ({ device: d.device, views: Number(d.views) })),
  }
}
