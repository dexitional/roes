// Prices a bag from the database (never from what the browser says): current
// prices and stock, the delivery fee for the chosen method/region, and any
// coupon. Used for the live quote in the bag and checkout, and again inside
// the checkout transaction.
import type { PoolConnection } from 'mysql2/promise'
import { getPool } from '@roes/db'
import type { StoreSettings } from '@roes/db'
import { rows } from './db'

export interface CartLine {
  productId: number
  variantId?: number | null
  quantity: number
}

export interface PricedLine {
  productId: number
  variantId: number | null
  slug: string
  name: string
  variantLabel: string | null
  image: string | null
  unitPrice: number
  compareAtPrice: number | null
  quantity: number
  available: number
  lineTotal: number
  issue: string | null
}

export interface Quote {
  lines: Array<PricedLine>
  itemCount: number
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  coupon: { code: string; description: string | null } | null
  couponError: string | null
  freeDeliveryOver: number
  issues: Array<string>
}

const round = (n: number) => Math.round(n * 100) / 100

export async function priceCart(
  items: Array<CartLine>,
  opts: { couponCode?: string | null; deliveryMethod: 'delivery' | 'pickup'; region?: string | null },
  settings: StoreSettings,
  conn: PoolConnection | ReturnType<typeof getPool> = getPool(),
  lock = false,
): Promise<Quote> {
  // Merge duplicate lines (same product and option).
  const merged = new Map<string, CartLine>()
  for (const it of items) {
    const key = `${it.productId}:${it.variantId ?? 0}`
    const prev = merged.get(key)
    merged.set(key, { ...it, quantity: Math.min(50, (prev?.quantity ?? 0) + it.quantity) })
  }
  const list = [...merged.values()]
  const productIds = [...new Set(list.map((l) => l.productId))]
  const variantIds = list.map((l) => l.variantId).filter((v): v is number => Boolean(v))

  const products = productIds.length
    ? await rows<{
        id: number
        slug: string
        name: string
        price: number
        compareAtPrice: number | null
        stock: number
        trackStock: number
        status: string
        image: string | null
      }>(
        `SELECT p.id, p.slug, p.name, p.price, p.compare_at_price, p.stock, p.track_stock, p.status,
                (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image
           FROM products p WHERE p.id IN (?)${lock ? ' FOR UPDATE' : ''}`,
        [productIds],
        conn,
      )
    : []
  const variants = variantIds.length
    ? await rows<{ id: number; productId: number; optionName: string; optionValue: string; priceAdjustment: number; stock: number }>(
        `SELECT id, product_id, option_name, option_value, price_adjustment, stock FROM product_variants WHERE id IN (?)${lock ? ' FOR UPDATE' : ''}`,
        [variantIds],
        conn,
      )
    : []
  const byId = new Map(products.map((p) => [p.id, p]))
  const variantById = new Map(variants.map((v) => [v.id, v]))

  const lines: Array<PricedLine> = []
  const issues: Array<string> = []
  for (const l of list) {
    const p = byId.get(l.productId)
    if (!p || p.status !== 'active') {
      issues.push('An item in your bag is no longer available and was removed.')
      continue
    }
    const v = l.variantId ? variantById.get(l.variantId) : undefined
    if (l.variantId && (!v || v.productId !== p.id)) {
      issues.push(`The option you chose for ${p.name} is no longer available.`)
      continue
    }
    const unitPrice = round(Number(p.price) + Number(v?.priceAdjustment ?? 0))
    const available = !p.trackStock ? 999 : v ? Number(v.stock) : Number(p.stock)
    let issue: string | null = null
    if (available <= 0) issue = 'Sold out'
    else if (l.quantity > available) issue = `Only ${available} left`
    const quantity = available > 0 ? Math.min(l.quantity, available) : l.quantity
    lines.push({
      productId: p.id,
      variantId: v?.id ?? null,
      slug: p.slug,
      name: p.name,
      variantLabel: v ? `${v.optionName}: ${v.optionValue}` : null,
      image: p.image,
      unitPrice,
      compareAtPrice: p.compareAtPrice === null ? null : Number(p.compareAtPrice),
      quantity,
      available,
      lineTotal: round(unitPrice * quantity),
      issue,
    })
    if (issue) issues.push(`${p.name}: ${issue.toLowerCase()}.`)
  }

  const subtotal = round(lines.filter((l) => l.issue !== 'Sold out').reduce((s, l) => s + l.lineTotal, 0))
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0)

  // Coupon
  let discount = 0
  let coupon: Quote['coupon'] = null
  let couponError: string | null = null
  if (opts.couponCode) {
    const [c] = await rows<{
      code: string
      description: string | null
      kind: 'percent' | 'fixed'
      value: number
      minSubtotal: number
      usageLimit: number | null
      usedCount: number
    }>(
      `SELECT code, description, kind, value, min_subtotal, usage_limit, used_count FROM coupons
        WHERE code = ? AND is_active = 1 AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at >= NOW())`,
      [opts.couponCode.trim().toUpperCase()],
      conn,
    )
    if (!c) couponError = 'That code is not valid.'
    else if (c.usageLimit !== null && c.usedCount >= c.usageLimit) couponError = 'That code has been used up.'
    else if (subtotal < Number(c.minSubtotal)) couponError = `Spend GH₵${Number(c.minSubtotal).toFixed(0)} or more to use this code.`
    else {
      discount = c.kind === 'percent' ? round((subtotal * Number(c.value)) / 100) : Math.min(subtotal, Number(c.value))
      coupon = { code: c.code, description: c.description }
    }
  }

  // Delivery
  const d = settings.delivery
  let deliveryFee = 0
  if (opts.deliveryMethod === 'delivery' && subtotal > 0) {
    const region = d.regions.find((r) => r.name === opts.region)
    deliveryFee = region ? Number(region.fee) : Number(d.defaultFee)
    if (d.freeOver > 0 && subtotal - discount >= d.freeOver) deliveryFee = 0
  }

  return {
    lines,
    itemCount,
    subtotal,
    deliveryFee: round(deliveryFee),
    discount: round(discount),
    total: round(Math.max(0, subtotal - discount) + deliveryFee),
    coupon,
    couponError,
    freeDeliveryOver: Number(d.freeOver),
    issues,
  }
}
