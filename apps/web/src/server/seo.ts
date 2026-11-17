// /sitemap.xml and /robots.txt for search engines. Server-only Nitro handlers.
import { getPool } from '@roes/db'
import type { RowDataPacket } from 'mysql2'

const baseUrl = (request: Request) => process.env.APP_URL?.replace(/\/$/, '') || new URL(request.url).origin
const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function handleRobots(request: Request) {
  const body = [
    'User-agent: *',
    'Allow: /',
    ...['/admin', '/api/', '/account', '/checkout', '/cart', '/login', '/wishlist', '/shop?*q='].map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${baseUrl(request)}/sitemap.xml`,
    '',
  ].join('\n')
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}

// Google image sitemap extension: product photos are indexed with their page.
export async function handleSitemap(request: Request) {
  const base = baseUrl(request)
  const pool = getPool()
  const [[products], [categories], [pages]] = await Promise.all([
    pool.query<Array<RowDataPacket>>(
      `SELECT p.slug, p.name, DATE_FORMAT(p.updated_at, '%Y-%m-%d') AS d,
              (SELECT GROUP_CONCAT(url ORDER BY sort_order SEPARATOR '|') FROM product_images WHERE product_id = p.id) AS images
         FROM products p WHERE p.status = 'active' ORDER BY p.id`,
    ),
    pool.query<Array<RowDataPacket>>("SELECT slug, DATE_FORMAT(updated_at, '%Y-%m-%d') AS d FROM categories WHERE is_active = 1"),
    pool.query<Array<RowDataPacket>>(
      "SELECT kind, slug, DATE_FORMAT(updated_at, '%Y-%m-%d') AS d FROM pages WHERE status = 'published'",
    ),
  ])
  const url = (loc: string, lastmod?: string, priority?: string, extra = '') =>
    `  <url><loc>${escapeXml(base + loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}${priority ? `<priority>${priority}</priority>` : ''}${extra}</url>`
  const entries = [
    url('/', undefined, '1.0'),
    url('/shop', undefined, '0.9'),
    url('/journal', undefined, '0.5'),
    ...categories.map((c) => url(`/collections/${c.slug}`, c.d, '0.8')),
    ...products.map((p) => {
      const images = String(p.images ?? '')
        .split('|')
        .filter(Boolean)
        .slice(0, 6)
        .map((i) => `<image:image><image:loc>${escapeXml(base + i)}</image:loc><image:title>${escapeXml(p.name)}</image:title></image:image>`)
        .join('')
      return url(`/p/${p.slug}`, p.d, '0.7', images)
    }),
    ...pages.map((p) => url(p.kind === 'post' ? `/journal/${p.slug}` : `/pages/${p.slug}`, p.d, '0.4')),
  ]
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join('\n')}\n</urlset>\n`,
    { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } },
  )
}
