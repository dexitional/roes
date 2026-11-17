// Catalogue queries shared by the storefront modules.
import { like, one, rows } from './db'

export interface ProductCard {
  id: number
  slug: string
  name: string
  price: number
  compareAtPrice: number | null
  stock: number
  isNew: boolean
  isFeatured: boolean
  ratingAvg: number
  ratingCount: number
  categoryName: string | null
  categorySlug: string | null
  image: string | null
  imageAlt: string | null
  hoverImage: string | null
  variantCount: number
}

const CARD_COLUMNS = `
  p.id, p.slug, p.name, p.price, p.compare_at_price, p.stock, p.is_new, p.is_featured, p.rating_avg, p.rating_count,
  c.name AS category_name, c.slug AS category_slug,
  (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image,
  (SELECT alt FROM product_images WHERE product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image_alt,
  (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order, id LIMIT 1 OFFSET 1) AS hover_image,
  (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) AS variant_count`

function toCard(r: Record<string, any>): ProductCard {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    price: Number(r.price),
    compareAtPrice: r.compareAtPrice === null ? null : Number(r.compareAtPrice),
    stock: Number(r.stock),
    isNew: Boolean(r.isNew),
    isFeatured: Boolean(r.isFeatured),
    ratingAvg: Number(r.ratingAvg),
    ratingCount: Number(r.ratingCount),
    categoryName: r.categoryName,
    categorySlug: r.categorySlug,
    image: r.image,
    imageAlt: r.imageAlt,
    hoverImage: r.hoverImage,
    variantCount: Number(r.variantCount),
  }
}

export async function cards(where: string, params: Array<unknown>, orderBy: string, limit: number, offset = 0) {
  const list = await rows(
    `SELECT ${CARD_COLUMNS} FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'active' ${where ? `AND ${where}` : ''} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )
  return list.map(toCard)
}

export const SORTS: Record<string, string> = {
  featured: '(p.stock > 0) DESC, p.is_featured DESC, (p.sold_count * 5 + p.view_count) DESC, p.created_at DESC',
  newest: 'p.created_at DESC, p.id DESC',
  popular: '(p.sold_count * 5 + p.view_count) DESC, p.id DESC',
  'price-asc': 'p.price ASC, p.id DESC',
  'price-desc': 'p.price DESC, p.id DESC',
  relevance: 'relevance DESC, p.is_featured DESC, p.id DESC',
}

export interface ProductFilters {
  q?: string
  category?: string
  min?: number
  max?: number
  material?: string
  sale?: boolean
  inStock?: boolean
  isNew?: boolean
  sort?: string
  page?: number
  pageSize?: number
}

/** Category ids for a slug, including its sub-categories. */
export async function categoryTree(slug: string): Promise<Array<number>> {
  const root = await one<{ id: number }>('SELECT id FROM categories WHERE slug = ? AND is_active = 1', [slug])
  if (!root) return []
  const children = await rows<{ id: number }>('SELECT id FROM categories WHERE parent_id = ? AND is_active = 1', [root.id])
  return [root.id, ...children.map((c) => c.id)]
}

// Words shoppers use that the catalogue spells differently.
const SYNONYMS: Record<string, string> = {
  earing: 'earring',
  earings: 'earrings',
  neclace: 'necklace',
  necklesses: 'necklaces',
  braclet: 'bracelet',
  bracelets: 'bracelet',
  watches: 'watch',
  jewellery: 'jewelry',
  chain: 'necklace',
  chains: 'necklace',
  studs: 'earrings',
}

export function searchTerms(q: string) {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 6)
    .map((w) => SYNONYMS[w] ?? w)
}

export async function listProducts(f: ProductFilters) {
  const where: Array<string> = []
  const params: Array<unknown> = []
  let relevance = '0'
  const relevanceParams: Array<unknown> = []

  if (f.q) {
    const words = searchTerms(f.q)
    for (const w of words) {
      const stem = w.replace(/s$/, '')
      where.push('(p.name LIKE ? OR c.name LIKE ? OR p.material LIKE ? OR p.tags LIKE ? OR p.sku = ?)')
      params.push(like(stem), like(stem), like(stem), like(stem), w.toUpperCase())
    }
    if (words.length) {
      relevance = `(CASE WHEN p.name LIKE ? THEN 10 ELSE 0 END + CASE WHEN p.name LIKE ? THEN 4 ELSE 0 END + CASE WHEN c.name LIKE ? THEN 3 ELSE 0 END)`
      relevanceParams.push(`${words.join(' ')}%`, like(words.join(' ')), like(words[0]!))
    }
  }
  if (f.category) {
    const ids = await categoryTree(f.category)
    where.push(ids.length ? `p.category_id IN (${ids.map(() => '?').join(',')})` : '0')
    params.push(...ids)
  }
  if (f.min !== undefined && Number.isFinite(f.min)) {
    where.push('p.price >= ?')
    params.push(f.min)
  }
  if (f.max !== undefined && Number.isFinite(f.max)) {
    where.push('p.price <= ?')
    params.push(f.max)
  }
  if (f.material) {
    where.push('p.material = ?')
    params.push(f.material)
  }
  if (f.sale) where.push('p.compare_at_price > p.price')
  if (f.inStock) where.push('p.stock > 0')
  if (f.isNew) where.push('p.is_new = 1')

  const sortKey = f.sort && SORTS[f.sort] ? f.sort : f.q ? 'relevance' : 'featured'
  const pageSize = Math.min(48, Math.max(1, f.pageSize ?? 24))
  const page = Math.max(1, f.page ?? 1)
  const whereSql = where.join(' AND ')

  const [list, totalRow] = await Promise.all([
    rows(
      `SELECT ${CARD_COLUMNS}, ${relevance} AS relevance FROM products p LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.status = 'active' ${whereSql ? `AND ${whereSql}` : ''} ORDER BY ${SORTS[sortKey]} LIMIT ? OFFSET ?`,
      [...relevanceParams, ...params, pageSize, (page - 1) * pageSize],
    ),
    one<{ total: number; minPrice: number; maxPrice: number }>(
      `SELECT COUNT(*) AS total, MIN(p.price) AS min_price, MAX(p.price) AS max_price
         FROM products p LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.status = 'active' ${whereSql ? `AND ${whereSql}` : ''}`,
      params,
    ),
  ])
  return {
    data: list.map(toCard),
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    sort: sortKey,
  }
}
