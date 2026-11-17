// Public storefront API (no sign-in needed). Reads are cached in-process and
// marked cacheable for browsers/CDNs; every admin write busts the cache.
//
//   GET  /api/store/bootstrap            settings, navigation, footer pages
//   GET  /api/store/home                 slides, collections, product rails, journal
//   GET  /api/store/products             list/search with filters
//   GET  /api/store/products/:slug       product page
//   GET  /api/store/products/:slug/reviews
//   GET  /api/store/categories/:slug
//   GET  /api/store/pages/:slug          GET /api/store/journal(/:slug)
//   POST /api/store/quote                price a bag
//   POST /api/store/track                analytics event
//   POST /api/store/subscribe            newsletter
import { Hono } from 'hono'
import { PUBLIC_CACHE, cached } from '../lib/cache'
import { cards, listProducts } from '../lib/catalog'
import type { ProductCard } from '../lib/catalog'
import { exec, insert, one, rows } from '../lib/db'
import { notFound } from '../lib/errors'
import { priceCart } from '../lib/pricing'
import { rateLimit } from '../lib/rate-limit'
import { getSettings } from '../lib/settings'
import { validate } from '../lib/validate'
import { deviceOf, isBot, sourceOf, visitorId } from '../lib/visitor'
import { optionalUser, userOrNull } from '../lib/auth'
import { paystackConfigured } from '../lib/paystack'
import { quoteSchema, subscribeSchema, trackSchema } from '#/lib/schemas'
import { normalizePhone } from '#/lib/phone'

const num = (v: string | undefined) => (v === undefined || v === '' ? undefined : Number(v))

export const storeRoute = new Hono()
  .get('/bootstrap', async (c) => {
    const data = await cached('bootstrap', 120, async () => {
      const s = await getSettings()
      const categories = await rows<{ id: number; parentId: number | null; name: string; slug: string; imageUrl: string | null; productCount: number }>(
        `SELECT c.id, c.parent_id, c.name, c.slug, c.image_url,
                (SELECT COUNT(*) FROM products p WHERE p.status = 'active' AND (p.category_id = c.id OR p.category_id IN (SELECT id FROM categories WHERE parent_id = c.id))) AS product_count
           FROM categories c WHERE c.is_active = 1 ORDER BY c.sort_order, c.name`,
      )
      const footerPages = await rows<{ title: string; slug: string }>(
        "SELECT title, slug FROM pages WHERE kind = 'page' AND status = 'published' AND show_in_footer = 1 ORDER BY id",
      )
      return {
        store: s.store,
        announcement: s.announcement,
        seo: s.seo,
        delivery: s.delivery,
        payments: {
          momoNumber: s.payments.momoNumber,
          momoName: s.payments.momoName,
          momoNetwork: s.payments.momoNetwork,
          instructions: s.payments.instructions,
          paystack: s.payments.paystackEnabled && paystackConfigured(),
        },
        categories: categories.map((cat) => ({ ...cat, productCount: Number(cat.productCount) })),
        footerPages,
      }
    })
    c.header('cache-control', PUBLIC_CACHE)
    return c.json(data)
  })

  .get('/home', async (c) => {
    const data = await cached('home', 120, async () => {
      // Rails favour pieces in stock and avoid repeating near-identical items
      // (the catalogue has several pieces with the same name).
      const varied = (list: Array<ProductCard>, n: number) => {
        const seen = new Set<string>()
        const first = list.filter((p) => !seen.has(p.name.toLowerCase()) && seen.add(p.name.toLowerCase()))
        return [...first, ...list.filter((p) => !first.includes(p))].slice(0, n)
      }
      const [slides, collections, featured, newest, bestSellers, onSale, posts, stats] = await Promise.all([
        rows(
          'SELECT id, eyebrow, title, subtitle, image_url, cta_label, cta_url, align FROM slides WHERE is_active = 1 ORDER BY sort_order, id',
        ),
        rows(
          `SELECT c.name, c.slug, c.tagline, c.image_url,
                  (SELECT COUNT(*) FROM products p WHERE p.status = 'active' AND p.category_id = c.id) AS product_count
             FROM categories c WHERE c.is_active = 1 AND c.is_featured = 1 ORDER BY c.sort_order LIMIT 12`,
        ),
        cards('p.stock > 0', [], 'p.is_featured DESC, (p.sold_count * 5 + p.view_count) DESC, p.created_at DESC', 40).then((l) => varied(l, 8)),
        cards('p.stock > 0', [], 'p.created_at DESC, p.id DESC', 40).then((l) => varied(l, 10)),
        cards('p.stock > 0', [], '(p.sold_count * 5 + p.view_count) DESC, p.rating_avg DESC, p.id DESC', 40).then((l) => varied(l, 8)),
        cards('p.compare_at_price > p.price AND p.stock > 0', [], '(p.compare_at_price - p.price) / p.compare_at_price DESC', 30).then((l) => varied(l, 10)),
        rows(
          `SELECT title, slug, excerpt, cover_url, published_at FROM pages WHERE kind = 'post' AND status = 'published'
            ORDER BY published_at DESC LIMIT 3`,
        ),
        one<{ products: number; collections: number }>(
          `SELECT (SELECT COUNT(*) FROM products WHERE status = 'active') AS products, (SELECT COUNT(*) FROM categories WHERE is_active = 1) AS collections`,
        ),
      ])
      const priceFloor = await one<{ min: number }>("SELECT MIN(price) AS min FROM products WHERE status = 'active'")
      return { slides, collections, featured, newest, bestSellers, onSale, posts, stats: { products: Number(stats?.products ?? 0), collections: Number(stats?.collections ?? 0) }, priceFloor: Number(priceFloor?.min ?? 0) }
    })
    c.header('cache-control', PUBLIC_CACHE)
    return c.json(data)
  })

  .get('/products', async (c) => {
    const q = c.req.query()
    const filters = {
      q: q.q?.trim().slice(0, 100) || undefined,
      category: q.category || undefined,
      min: num(q.min),
      max: num(q.max),
      material: q.material || undefined,
      sale: q.sale === '1',
      inStock: q.instock === '1',
      isNew: q.new === '1',
      sort: q.sort,
      page: num(q.page),
      pageSize: num(q.pageSize),
    }
    const key = `products:${JSON.stringify(filters)}`
    const result = await cached(key, 60, async () => {
      const [list, facets] = await Promise.all([listProducts(filters), facetsFor()])
      return { ...list, facets }
    })
    // Search terms feed the analytics (what people look for, and what they can't find).
    if (filters.q && (filters.page ?? 1) === 1 && !isBot(c)) {
      void exec('INSERT INTO search_queries (term, results, visitor_id) VALUES (?, ?, ?)', [
        filters.q.toLowerCase(),
        result.total,
        visitorId(c),
      ]).catch(() => undefined)
    }
    c.header('cache-control', filters.q ? 'private, no-store' : PUBLIC_CACHE)
    return c.json(result)
  })

  .get('/products/:slug', async (c) => {
    const slug = c.req.param('slug')
    const data = await cached(`product:${slug}`, 120, async () => {
      const product = await one<Record<string, any>>(
        `SELECT p.id, p.slug, p.name, p.sku, p.short_description, p.description, p.price, p.compare_at_price, p.stock,
                p.track_stock, p.material, p.finish, p.gender, p.tags, p.is_new, p.is_featured, p.rating_avg, p.rating_count,
                p.seo_title, p.seo_description, p.focus_keyword, p.sold_count, p.updated_at, p.created_at,
                c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
                pc.name AS parent_name, pc.slug AS parent_slug
           FROM products p
           LEFT JOIN categories c ON c.id = p.category_id
           LEFT JOIN categories pc ON pc.id = c.parent_id
          WHERE p.slug = ? AND p.status = 'active'`,
        [slug],
      )
      if (!product) return null
      const [images, variants, related, reviewStats] = await Promise.all([
        rows('SELECT id, url, alt, width, height FROM product_images WHERE product_id = ? ORDER BY sort_order, id', [product.id]),
        rows(
          'SELECT id, option_name, option_value, price_adjustment, stock FROM product_variants WHERE product_id = ? ORDER BY sort_order, id',
          [product.id],
        ),
        product.categoryId
          ? cards(
              'p.category_id = ? AND p.id <> ?',
              // The last value fills the ORDER BY placeholder: closest in price first.
              [product.categoryId, product.id, product.price],
              '(p.stock > 0) DESC, p.is_featured DESC, ABS(p.price - ?) ASC',
              8,
            )
          : Promise.resolve([]),
        rows<{ rating: number; n: number }>(
          "SELECT rating, COUNT(*) AS n FROM reviews WHERE product_id = ? AND status = 'approved' GROUP BY rating",
          [product.id],
        ),
      ])
      return {
        ...product,
        price: Number(product.price),
        compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
        ratingAvg: Number(product.ratingAvg),
        tags: typeof product.tags === 'string' ? JSON.parse(product.tags) : (product.tags ?? []),
        images,
        variants: variants.map((v) => ({ ...v, priceAdjustment: Number(v.priceAdjustment), stock: Number(v.stock) })),
        related,
        ratingBreakdown: Object.fromEntries(reviewStats.map((r) => [r.rating, Number(r.n)])),
      }
    })
    if (!data) throw notFound('Product')
    c.header('cache-control', PUBLIC_CACHE)
    return c.json(data)
  })

  .get('/products/:slug/reviews', async (c) => {
    const product = await one<{ id: number }>("SELECT id FROM products WHERE slug = ? AND status = 'active'", [c.req.param('slug')])
    if (!product) throw notFound('Product')
    const list = await rows(
      `SELECT r.id, r.rating, r.title, r.body, r.is_verified_buyer, r.created_at, u.full_name, u.avatar_url
         FROM reviews r JOIN users u ON u.id = r.user_id
        WHERE r.product_id = ? AND r.status = 'approved' ORDER BY r.created_at DESC LIMIT 50`,
      [product.id],
    )
    return c.json(
      list.map((r) => ({
        ...r,
        // First name and initial only.
        fullName: String(r.fullName).split(/\s+/).slice(0, 2).map((p, i) => (i ? `${p[0]}.` : p)).join(' '),
      })),
    )
  })

  .get('/categories/:slug', async (c) => {
    const slug = c.req.param('slug')
    const data = await cached(`category:${slug}`, 300, async () => {
      const category = await one<Record<string, any>>(
        `SELECT c.id, c.name, c.slug, c.tagline, c.description, c.image_url, c.seo_title, c.seo_description, c.updated_at,
                pc.name AS parent_name, pc.slug AS parent_slug
           FROM categories c LEFT JOIN categories pc ON pc.id = c.parent_id
          WHERE c.slug = ? AND c.is_active = 1`,
        [slug],
      )
      if (!category) return null
      const children = await rows('SELECT name, slug, image_url FROM categories WHERE parent_id = ? AND is_active = 1 ORDER BY sort_order', [
        category.id,
      ])
      const siblings = category.parentSlug
        ? await rows(
            'SELECT name, slug FROM categories WHERE parent_id = (SELECT id FROM categories WHERE slug = ?) AND is_active = 1 ORDER BY sort_order',
            [category.parentSlug],
          )
        : []
      return { ...category, children, siblings }
    })
    if (!data) throw notFound('Collection')
    c.header('cache-control', PUBLIC_CACHE)
    return c.json(data)
  })

  .get('/pages/:slug', async (c) => {
    const slug = c.req.param('slug')
    const page = await cached(`page:${slug}`, 300, () =>
      one(
        "SELECT title, slug, excerpt, cover_url, body, seo_title, seo_description, updated_at FROM pages WHERE kind = 'page' AND slug = ? AND status = 'published'",
        [slug],
      ),
    )
    if (!page) throw notFound('Page')
    c.header('cache-control', PUBLIC_CACHE)
    return c.json(page)
  })

  .get('/journal', async (c) => {
    const list = await cached('journal', 300, () =>
      rows(
        "SELECT title, slug, excerpt, cover_url, published_at FROM pages WHERE kind = 'post' AND status = 'published' ORDER BY published_at DESC LIMIT 60",
      ),
    )
    c.header('cache-control', PUBLIC_CACHE)
    return c.json(list)
  })

  .get('/journal/:slug', async (c) => {
    const slug = c.req.param('slug')
    const post = await cached(`post:${slug}`, 300, async () => {
      const p = await one(
        `SELECT p.title, p.slug, p.excerpt, p.cover_url, p.body, p.seo_title, p.seo_description, p.published_at, p.updated_at, u.full_name AS author
           FROM pages p LEFT JOIN users u ON u.id = p.author_id
          WHERE p.kind = 'post' AND p.slug = ? AND p.status = 'published'`,
        [slug],
      )
      if (!p) return null
      const more = await rows(
        "SELECT title, slug, excerpt, cover_url, published_at FROM pages WHERE kind = 'post' AND status = 'published' AND slug <> ? ORDER BY published_at DESC LIMIT 3",
        [slug],
      )
      return { ...p, more }
    })
    if (!post) throw notFound('Article')
    c.header('cache-control', PUBLIC_CACHE)
    return c.json(post)
  })

  .post('/quote', rateLimit('quote', 120, 60), validate('json', quoteSchema), async (c) => {
    const input = c.req.valid('json')
    const quote = await priceCart(input.items, input, await getSettings())
    return c.json(quote)
  })

  .post('/track', rateLimit('track', 240, 60), optionalUser, validate('json', trackSchema), async (c) => {
    if (isBot(c)) return c.body(null, 204)
    const { productId, event, quantity, source } = c.req.valid('json')
    const user = userOrNull(c)
    const vid = visitorId(c)
    // One view per visitor per product per 30 minutes, so refreshes don't inflate it.
    if (event === 'view') {
      const recent = await one(
        "SELECT id FROM product_events WHERE product_id = ? AND visitor_id = ? AND event = 'view' AND created_at > NOW() - INTERVAL 30 MINUTE LIMIT 1",
        [productId, vid],
      )
      if (recent) return c.body(null, 204)
    }
    await insert('product_events', {
      productId,
      event,
      quantity: quantity ?? 1,
      visitorId: vid,
      userId: user?.id ?? null,
      source: sourceOf(source),
      device: deviceOf(c),
    }).catch(() => undefined)
    if (event === 'view') void exec('UPDATE products SET view_count = view_count + 1 WHERE id = ?', [productId]).catch(() => undefined)
    return c.body(null, 204)
  })

  .post('/subscribe', rateLimit('subscribe', 10, 600), validate('json', subscribeSchema), async (c) => {
    const { email, phone } = c.req.valid('json')
    await exec('INSERT IGNORE INTO subscribers (email, phone) VALUES (?, ?)', [email ?? null, normalizePhone(phone) ?? null])
    return c.json({ ok: true })
  })

async function facetsFor() {
  return cached('facets', 300, async () => {
    const [materials, range] = await Promise.all([
      rows<{ material: string; n: number }>(
        "SELECT material, COUNT(*) AS n FROM products WHERE status = 'active' AND material IS NOT NULL GROUP BY material ORDER BY n DESC",
      ),
      one<{ min: number; max: number }>("SELECT MIN(price) AS min, MAX(price) AS max FROM products WHERE status = 'active'"),
    ])
    return {
      materials: materials.map((m) => ({ value: m.material, count: Number(m.n) })),
      priceRange: { min: Math.floor(Number(range?.min ?? 0)), max: Math.ceil(Number(range?.max ?? 0)) },
    }
  })
}
