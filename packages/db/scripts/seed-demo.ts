// DEMO DATA for trying out the dashboard and product analytics before real
// traffic arrives: 90 days of shopper activity (views, add-to-bags,
// wishlists, checkouts, purchases, searches), demo customers, paid orders and
// a few reviews. Everything is tagged so it can be removed again:
//
//   npm run db:demo              add demo data (replaces any earlier demo data)
//   npm run db:demo -- --clear   remove all demo data
//
// Demo customers use @demo.roesoutlet.com emails, demo orders start with RD-,
// and demo events/searches carry a visitor id starting with "demo". Stock is
// never changed. Do not run this against the live database.
import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { closePool, getPool } from '../src/pool'

const DAYS = 90
const DEMO_DOMAIN = 'demo.roesoutlet.com'
const pool = getPool()

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const int = (min: number, max: number) => Math.floor(rand(min, max + 1))
const pick = <T>(list: Array<T>): T => list[Math.floor(Math.random() * list.length)]!
function weighted<T>(items: Array<[T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [item, w] of items) if ((r -= w) <= 0) return item
  return items[0]![0]
}
const vid = () => `demo${randomBytes(10).toString('hex')}`
const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')

async function clear() {
  await pool.query("DELETE FROM product_events WHERE visitor_id LIKE 'demo%' OR user_id IN (SELECT id FROM users WHERE email LIKE ?)", [`%@${DEMO_DOMAIN}`])
  await pool.query("DELETE FROM search_queries WHERE visitor_id LIKE 'demo%'")
  await pool.query("DELETE FROM orders WHERE reference LIKE 'RD-%'")
  await pool.query('DELETE FROM users WHERE email LIKE ?', [`%@${DEMO_DOMAIN}`])
  // Counters back to what real activity says.
  await pool.query(`UPDATE products p SET
      view_count = (SELECT COUNT(*) FROM product_events e WHERE e.product_id = p.id AND e.event = 'view'),
      sold_count = (SELECT COALESCE(SUM(quantity), 0) FROM product_events e WHERE e.product_id = p.id AND e.event = 'purchase'),
      rating_avg = COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id AND r.status = 'approved'), 0),
      rating_count = (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.status = 'approved')`)
  console.log('Demo data removed.')
}

const FIRST = ['Akosua', 'Ama', 'Abena', 'Efua', 'Adwoa', 'Yaa', 'Afua', 'Esi', 'Naana', 'Dede', 'Kukua', 'Serwaa', 'Kwame', 'Kofi', 'Selorm', 'Elikem', 'Nana', 'Maame', 'Akua', 'Dzifa']
const LAST = ['Mensah', 'Owusu', 'Asante', 'Boateng', 'Appiah', 'Darko', 'Agyeman', 'Quaye', 'Tetteh', 'Ofori', 'Amoah', 'Addo', 'Sarpong', 'Nkrumah', 'Danso']
const REGIONS: Array<[string, number]> = [
  ['Greater Accra', 45],
  ['Central', 22],
  ['Ashanti', 18],
  ['Western', 8],
  ['Eastern', 7],
]
const SOURCES: Array<[string, number]> = [
  ['instagram', 34],
  ['direct', 20],
  ['tiktok', 16],
  ['whatsapp', 12],
  ['google', 10],
  ['snapchat', 4],
  ['facebook', 4],
]
const DEVICES: Array<['mobile' | 'desktop' | 'tablet', number]> = [
  ['mobile', 78],
  ['desktop', 17],
  ['tablet', 5],
]
// Browsing peaks at lunchtime and in the evening (Ghana time = UTC).
const HOURS: Array<[number, number]> = Array.from({ length: 24 }, (_, h) => [h, h < 6 ? 1 : h < 9 ? 3 : h < 12 ? 5 : h < 14 ? 8 : h < 18 ? 6 : h < 23 ? 11 : 4])
const SEARCHES: Array<[string, number]> = [
  ['earrings', 30],
  ['watch set', 18],
  ['necklace', 16],
  ['gold earrings', 12],
  ['brooch', 8],
  ['pearl', 6],
  ['anklet', 5],
  ['bracelet', 9],
  ['ear cuff', 6],
  ['rings', 7],
  ['men chain', 5],
  ['waist beads', 4],
]
const REVIEWS = [
  [5, 'Absolutely gorgeous', 'Even prettier in person and it came beautifully boxed. Delivery to Accra was next day.'],
  [5, 'My new favourite', 'I have worn these every day this week and they still look brand new.'],
  [4, 'Lovely quality', 'Great quality for the price. Slightly smaller than I expected but still beautiful.'],
  [5, 'Perfect gift', 'Bought it for my sister’s birthday and she loved it. The box is so classy.'],
  [5, 'Luxury on budget indeed', 'Looks so expensive! I get compliments every time I wear it.'],
  [4, 'Very nice', 'Nice shine and comfortable to wear. Will buy again.'],
]

async function main() {
  if (process.argv.includes('--clear')) return clear()
  await clear()

  const [products] = await pool.query<Array<RowDataPacket>>(
    `SELECT p.id, p.name, p.price, p.stock, p.created_at,
            (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS image
       FROM products p WHERE p.status = 'active'`,
  )
  if (!products.length) throw new Error('Import the catalogue first (npm run db:import).')

  // Each product gets an "appeal" (how often it's looked at) and a "desire"
  // (how likely a look becomes a bag), so the analytics have real winners,
  // hidden gems and leaky pages to find.
  const catalog = products.map((p) => ({
    id: p.id as number,
    name: p.name as string,
    price: Number(p.price),
    image: p.image as string | null,
    createdAt: new Date(p.created_at),
    appeal: Math.pow(Math.random(), 2.2) * (Number(p.stock) > 0 ? 1 : 0.35) + 0.02,
    desire: Math.random() < 0.12 ? rand(0.18, 0.3) : Math.random() < 0.15 ? rand(0.005, 0.02) : rand(0.04, 0.12),
  }))
  const appealTotal = catalog.reduce((s, p) => s + p.appeal, 0)
  const pickProduct = () => {
    let r = Math.random() * appealTotal
    for (const p of catalog) if ((r -= p.appeal) <= 0) return p
    return catalog[0]!
  }

  // Customers
  const customers: Array<{ id: number; name: string; phone: string }> = []
  for (let i = 1; i <= 60; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`
    const phone = `2332${int(0, 5)}${int(1000000, 9999999)}`
    const created = new Date(Date.now() - int(1, DAYS) * 86_400_000)
    const [r] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (full_name, email, phone, google_sub, role, created_at, last_login_at) VALUES (?, ?, ?, ?, 'customer', ?, ?)`,
      [name, `customer${i}@${DEMO_DOMAIN}`, phone, `demo:${i}`, fmt(created), fmt(created)],
    )
    customers.push({ id: r.insertId, name, phone })
  }

  const events: Array<Array<unknown>> = []
  const searches: Array<Array<unknown>> = []
  let orders = 0
  let orderSeq = 0
  const now = new Date()

  for (let d = DAYS - 1; d >= 0; d--) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - d))
    const dow = day.getUTCDay()
    const growth = 0.55 + (1 - d / DAYS) * 0.8
    const weekend = dow === 5 || dow === 6 ? 1.35 : dow === 0 ? 1.15 : 1
    const visitors = Math.round(rand(38, 62) * growth * weekend)

    for (let v = 0; v < visitors; v++) {
      const visitor = vid()
      const device = weighted(DEVICES)
      const source = weighted(SOURCES)
      const customer = Math.random() < 0.3 ? pick(customers) : null
      const at = new Date(day.getTime() + weighted(HOURS) * 3_600_000 + int(0, 3599) * 1000)
      if (at > now) continue
      const stamp = (offsetMin: number) => fmt(new Date(Math.min(now.getTime(), at.getTime() + offsetMin * 60_000)))
      const bag: Array<{ p: (typeof catalog)[number]; q: number }> = []

      if (Math.random() < 0.18) {
        const [term] = [weighted(SEARCHES)]
        const zero = ['rings', 'men chain', 'waist beads'].includes(term)
        searches.push([term, zero ? 0 : int(3, 40), visitor, stamp(0)])
      }

      const views = int(1, 6)
      for (let i = 0; i < views; i++) {
        const p = pickProduct()
        if (p.createdAt > at) continue
        events.push([p.id, 'view', 1, 0, visitor, customer?.id ?? null, source, device, stamp(i * 2)])
        if (Math.random() < p.desire) {
          const q = Math.random() < 0.85 ? 1 : 2
          bag.push({ p, q })
          events.push([p.id, 'add_to_cart', q, 0, visitor, customer?.id ?? null, source, device, stamp(i * 2 + 1)])
        }
        if (Math.random() < 0.025) events.push([p.id, 'wishlist', 1, 0, visitor, customer?.id ?? null, source, device, stamp(i * 2 + 1)])
      }

      if (!bag.length || Math.random() > 0.42) continue
      const buyer = customer ?? pick(customers)
      for (const b of bag) events.push([b.p.id, 'checkout', b.q, 0, visitor, buyer.id, 'checkout', device, stamp(15)])
      const paid = Math.random() < 0.72
      const subtotal = bag.reduce((s, b) => s + b.p.price * b.q, 0)
      const pickup = Math.random() < 0.3
      const region = pickup ? null : weighted(REGIONS)
      const fee = pickup ? 0 : subtotal >= 1000 ? 0 : region === 'Greater Accra' ? 35 : region === 'Central' ? 25 : 40
      const total = subtotal + fee
      const ageDays = (now.getTime() - at.getTime()) / 86_400_000
      const status = !paid ? (ageDays > 3 ? 'cancelled' : 'pending') : ageDays > 4 ? 'delivered' : ageDays > 2 ? 'shipped' : ageDays > 1 ? 'processing' : 'confirmed'
      const reference = `RD-${String(++orderSeq).padStart(5, '0')}`
      const [o] = await pool.query<ResultSetHeader>(
        `INSERT INTO orders (reference, user_id, customer_name, email, phone, delivery_method, region, city, address, subtotal, delivery_fee, total,
                             payment_method, payment_status, momo_sender, momo_transaction_id, status, paid_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'momo', ?, ?, ?, ?, ?, ?)`,
        [
          reference,
          buyer.id,
          buyer.name,
          `${buyer.name.split(' ')[0]!.toLowerCase()}@${DEMO_DOMAIN}`,
          buyer.phone,
          pickup ? 'pickup' : 'delivery',
          region,
          pickup ? null : region === 'Greater Accra' ? 'East Legon' : 'Town centre',
          pickup ? null : 'Demo address',
          subtotal,
          fee,
          total,
          paid ? 'paid' : 'pending',
          paid ? buyer.phone : null,
          paid ? String(int(10000000000, 99999999999)) : null,
          status,
          paid ? stamp(int(30, 240)) : null,
          stamp(16),
        ],
      )
      for (const b of bag) {
        await pool.query(
          'INSERT INTO order_items (order_id, product_id, name, image_url, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [o.insertId, b.p.id, b.p.name, b.p.image, b.p.price, b.q, b.p.price * b.q],
        )
        if (paid) events.push([b.p.id, 'purchase', b.q, b.p.price * b.q, visitor, buyer.id, source, device, stamp(int(30, 240))])
      }
      await pool.query('INSERT INTO order_events (order_id, kind, note, created_at) VALUES (?, ?, ?, ?)', [o.insertId, 'placed', 'Order placed (demo)', stamp(16)])
      if (paid) await pool.query('INSERT INTO order_events (order_id, kind, note, created_at) VALUES (?, ?, ?, ?)', [o.insertId, 'paid', 'Payment confirmed (demo)', stamp(60)])
      orders++
    }
  }

  for (let i = 0; i < events.length; i += 1000) {
    await pool.query(
      'INSERT INTO product_events (product_id, event, quantity, revenue, visitor_id, user_id, source, device, created_at) VALUES ?',
      [events.slice(i, i + 1000)],
    )
  }
  if (searches.length) await pool.query('INSERT INTO search_queries (term, results, visitor_id, created_at) VALUES ?', [searches])

  // Reviews on some of the best sellers.
  const [top] = await pool.query<Array<RowDataPacket>>(
    "SELECT product_id, COUNT(*) AS n FROM product_events WHERE event = 'purchase' AND visitor_id LIKE 'demo%' GROUP BY product_id ORDER BY n DESC LIMIT 12",
  )
  let reviews = 0
  for (const row of top) {
    for (let i = 0; i < int(1, 3); i++) {
      const [rating, title, body] = pick(REVIEWS)
      await pool.query(
        "INSERT IGNORE INTO reviews (product_id, user_id, rating, title, body, status, is_verified_buyer, created_at) VALUES (?, ?, ?, ?, ?, 'approved', 1, ?)",
        [row.product_id, pick(customers).id, rating, title, body, fmt(new Date(Date.now() - int(1, 60) * 86_400_000))],
      )
      reviews++
    }
  }

  await pool.query(`UPDATE products p SET
      view_count = (SELECT COUNT(*) FROM product_events e WHERE e.product_id = p.id AND e.event = 'view'),
      sold_count = (SELECT COALESCE(SUM(quantity), 0) FROM product_events e WHERE e.product_id = p.id AND e.event = 'purchase'),
      rating_avg = COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id AND r.status = 'approved'), 0),
      rating_count = (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.status = 'approved')`)

  console.log(`Demo data: ${customers.length} customers, ${events.length.toLocaleString()} events, ${searches.length} searches, ${orders} orders, ${reviews} reviews.`)
  console.log('Remove it any time with: npm run db:demo -- --clear')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => closePool())
