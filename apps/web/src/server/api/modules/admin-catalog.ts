// Admin: products and categories.
//   GET/POST /api/admin/products        GET/PUT/DELETE /api/admin/products/:id
//   POST     /api/admin/products/bulk   { ids, action }
//   GET/POST /api/admin/categories      PUT/DELETE /api/admin/categories/:id
import { Hono } from 'hono'
import { z } from 'zod'
import type { PoolConnection } from 'mysql2/promise'
import { categorySchema, productSchema } from '#/lib/schemas'
import { slugify } from '#/lib/format'
import { requireStaff } from '../lib/auth'
import { bustCache } from '../lib/cache'
import { exec, insert, like, one, paging, parseId, rows, scalar, update, withTransaction } from '../lib/db'
import { AppError, notFound } from '../lib/errors'
import { cleanHtml } from '../lib/rich-text'
import { validate } from '../lib/validate'

async function uniqueSlug(table: 'products' | 'categories', wanted: string, exceptId = 0, conn?: PoolConnection) {
  const base = slugify(wanted) || 'item'
  let slug = base
  for (let i = 2; await one(`SELECT id FROM ${table} WHERE slug = ? AND id <> ?`, [slug, exceptId], conn); i++) slug = `${base}-${i}`
  return slug
}

const PRODUCT_SORTS: Record<string, string> = {
  newest: 'p.created_at DESC',
  oldest: 'p.created_at ASC',
  name: 'p.name ASC',
  'price-asc': 'p.price ASC',
  'price-desc': 'p.price DESC',
  stock: 'p.stock ASC',
  popular: 'p.view_count DESC',
  sales: 'p.sold_count DESC',
}

async function saveProduct(input: z.output<typeof productSchema>, id: number | null) {
  return withTransaction(async (conn) => {
    const slug = await uniqueSlug('products', input.slug || input.name, id ?? 0, conn)
    const fields = {
      name: input.name,
      slug,
      sku: input.sku,
      categoryId: input.categoryId ?? null,
      shortDescription: input.shortDescription,
      description: cleanHtml(input.description),
      price: input.price,
      compareAtPrice: input.compareAtPrice && input.compareAtPrice > input.price ? input.compareAtPrice : null,
      costPrice: input.costPrice ?? null,
      stock: input.variants.length ? input.variants.reduce((s, v) => s + v.stock, 0) : input.stock,
      trackStock: input.trackStock ? 1 : 0,
      material: input.material,
      finish: input.finish,
      gender: input.gender,
      tags: JSON.stringify(input.tags),
      isFeatured: input.isFeatured ? 1 : 0,
      isNew: input.isNew ? 1 : 0,
      status: input.status,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      focusKeyword: input.focusKeyword,
    }
    let productId = id
    if (productId) {
      await exec(
        `UPDATE products SET published_at = COALESCE(published_at, IF(? = 'active', NOW(), NULL)) WHERE id = ?`,
        [input.status, productId],
        conn,
      )
      await update('products', productId, fields, conn)
    } else {
      productId = await insert('products', { ...fields, publishedAt: input.status === 'active' ? new Date() : null }, conn)
    }

    // Images: replace the list, keeping the order given.
    await exec('DELETE FROM product_images WHERE product_id = ?', [productId], conn)
    for (const [i, img] of input.images.entries()) {
      await insert(
        'product_images',
        { productId, url: img.url, alt: img.alt || `${input.name}${i ? ` (view ${i + 1})` : ''}`, width: img.width ?? null, height: img.height ?? null, sortOrder: i },
        conn,
      )
    }

    // Variants: update by id, add new ones, remove the rest.
    const keep: Array<number> = []
    for (const [i, v] of input.variants.entries()) {
      const data = { optionName: v.optionName, optionValue: v.optionValue, priceAdjustment: v.priceAdjustment, stock: v.stock, sortOrder: i }
      if (v.id && (await one('SELECT id FROM product_variants WHERE id = ? AND product_id = ?', [v.id, productId], conn))) {
        await update('product_variants', v.id, data, conn)
        keep.push(v.id)
      } else {
        keep.push(await insert('product_variants', { productId, ...data }, conn))
      }
    }
    await exec(
      `DELETE FROM product_variants WHERE product_id = ?${keep.length ? ` AND id NOT IN (${keep.map(() => '?').join(',')})` : ''}`,
      [productId, ...keep],
      conn,
    )
    return productId
  })
}

export const adminCatalogRoute = new Hono()
  .use(requireStaff)

  // ---- Products ----
  .get('/products', async (c) => {
    const q = c.req.query()
    const { page, pageSize, limit, offset } = paging(q, 25)
    const where: Array<string> = []
    const params: Array<unknown> = []
    if (q.q) {
      where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.slug LIKE ?)')
      params.push(like(q.q), like(q.q), like(q.q))
    }
    if (q.categoryId) {
      where.push('(p.category_id = ? OR c.parent_id = ?)')
      params.push(parseId(q.categoryId), parseId(q.categoryId))
    }
    if (q.status) {
      where.push('p.status = ?')
      params.push(q.status)
    }
    if (q.stock === 'out') where.push('p.stock <= 0')
    if (q.stock === 'low') where.push('p.stock BETWEEN 1 AND 3')
    if (q.seo === 'missing') where.push("(p.seo_description IS NULL OR p.seo_description = '' OR p.seo_title IS NULL)")
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const [data, total, counts] = await Promise.all([
      rows(
        `SELECT p.id, p.name, p.slug, p.sku, p.price, p.compare_at_price, p.stock, p.status, p.is_featured, p.view_count, p.sold_count,
                p.seo_title, p.seo_description, p.updated_at, c.name AS category_name,
                (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image,
                (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) AS image_count
           FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereSql}
          ORDER BY ${PRODUCT_SORTS[q.sort ?? 'newest'] ?? PRODUCT_SORTS.newest}, p.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      scalar(`SELECT COUNT(*) FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereSql}`, params),
      rows<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM products GROUP BY status'),
    ])
    return c.json({
      data,
      total: Number(total),
      page,
      pageSize,
      counts: Object.fromEntries(counts.map((r) => [r.status, Number(r.n)])),
    })
  })

  .get('/products/:id', async (c) => {
    const id = parseId(c.req.param('id'))
    const product = await one<Record<string, any>>('SELECT * FROM products WHERE id = ?', [id])
    if (!product) throw notFound('Product')
    const [images, variants] = await Promise.all([
      rows('SELECT id, url, alt, width, height FROM product_images WHERE product_id = ? ORDER BY sort_order, id', [id]),
      rows('SELECT id, option_name, option_value, price_adjustment, stock FROM product_variants WHERE product_id = ? ORDER BY sort_order, id', [id]),
    ])
    return c.json({
      ...product,
      tags: typeof product.tags === 'string' ? JSON.parse(product.tags) : (product.tags ?? []),
      images,
      variants,
    })
  })

  .post('/products', validate('json', productSchema), async (c) => {
    const id = await saveProduct(c.req.valid('json'), null)
    bustCache()
    return c.json({ id }, 201)
  })

  .put('/products/:id', validate('json', productSchema), async (c) => {
    const id = parseId(c.req.param('id'))
    if (!(await one('SELECT id FROM products WHERE id = ?', [id]))) throw notFound('Product')
    await saveProduct(c.req.valid('json'), id)
    bustCache()
    return c.json({ id })
  })

  .delete('/products/:id', async (c) => {
    const id = parseId(c.req.param('id'))
    const sold = await one('SELECT id FROM order_items WHERE product_id = ? LIMIT 1', [id])
    // Products that were ordered stay for the order history; they are archived instead.
    if (sold) await exec("UPDATE products SET status = 'archived' WHERE id = ?", [id])
    else await exec('DELETE FROM products WHERE id = ?', [id])
    bustCache()
    return c.json({ archived: Boolean(sold) })
  })

  .post(
    '/products/bulk',
    validate(
      'json',
      z.object({
        ids: z.array(z.number().int().positive()).min(1).max(500),
        action: z.enum(['activate', 'draft', 'archive', 'feature', 'unfeature', 'delete', 'category']),
        categoryId: z.number().int().positive().nullish(),
      }),
    ),
    async (c) => {
      const { ids, action, categoryId } = c.req.valid('json')
      const sets: Record<string, string> = {
        activate: "status = 'active', published_at = COALESCE(published_at, NOW())",
        draft: "status = 'draft'",
        archive: "status = 'archived'",
        feature: 'is_featured = 1',
        unfeature: 'is_featured = 0',
      }
      if (action === 'category') {
        await exec('UPDATE products SET category_id = ? WHERE id IN (?)', [categoryId ?? null, ids])
      } else if (action === 'delete') {
        await exec("UPDATE products SET status = 'archived' WHERE id IN (?) AND id IN (SELECT product_id FROM order_items)", [ids])
        await exec('DELETE FROM products WHERE id IN (?) AND id NOT IN (SELECT product_id FROM order_items WHERE product_id IS NOT NULL)', [ids])
      } else {
        await exec(`UPDATE products SET ${sets[action]} WHERE id IN (?)`, [ids])
      }
      bustCache()
      return c.json({ ok: true })
    },
  )

  // ---- Categories ----
  .get('/categories', async (c) => {
    const list = await rows(
      `SELECT c.id, c.parent_id, c.name, c.slug, c.tagline, c.image_url, c.is_featured, c.is_active, c.sort_order,
              c.seo_title, c.seo_description, pc.name AS parent_name,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status <> 'archived') AS product_count
         FROM categories c LEFT JOIN categories pc ON pc.id = c.parent_id ORDER BY c.sort_order, c.name`,
    )
    return c.json(list)
  })

  .get('/categories/:id', async (c) => {
    const category = await one('SELECT * FROM categories WHERE id = ?', [parseId(c.req.param('id'))])
    if (!category) throw notFound('Category')
    return c.json(category)
  })

  .post('/categories', validate('json', categorySchema), async (c) => {
    const input = c.req.valid('json')
    const id = await insert('categories', {
      ...input,
      slug: await uniqueSlug('categories', input.slug || input.name),
      description: cleanHtml(input.description),
      isFeatured: input.isFeatured ? 1 : 0,
      isActive: input.isActive ? 1 : 0,
    })
    bustCache()
    return c.json({ id }, 201)
  })

  .put('/categories/:id', validate('json', categorySchema), async (c) => {
    const id = parseId(c.req.param('id'))
    const input = c.req.valid('json')
    if (input.parentId === id) throw new AppError('A collection cannot be inside itself.', 422)
    await update('categories', id, {
      ...input,
      slug: await uniqueSlug('categories', input.slug || input.name, id),
      description: cleanHtml(input.description),
      isFeatured: input.isFeatured ? 1 : 0,
      isActive: input.isActive ? 1 : 0,
    })
    bustCache()
    return c.json({ id })
  })

  .delete('/categories/:id', async (c) => {
    await exec('DELETE FROM categories WHERE id = ?', [parseId(c.req.param('id'))])
    bustCache()
    return c.json({ ok: true })
  })

  .post('/categories/reorder', validate('json', z.object({ ids: z.array(z.number().int().positive()).max(500) })), async (c) => {
    const { ids } = c.req.valid('json')
    for (const [i, id] of ids.entries()) await exec('UPDATE categories SET sort_order = ? WHERE id = ?', [i + 1, id])
    bustCache()
    return c.json({ ok: true })
  })
