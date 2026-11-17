// Imports the catalogue of the old store (www.roesoutlet.com) from
// seed/legacy-catalog.json: categories, products, option stock and photos.
//
// Photos are downloaded once, re-encoded as WebP (longest edge 1600px) and
// written to local storage (STORAGE_DIR, default apps/web/storage), where the
// web app serves them from /files/... and the /img optimiser resizes them.
//
// Idempotent: products and categories are matched by their legacy id, and a
// photo that is already on disk is not downloaded again.
//
//   npm run db:import              import everything that isn't there yet
//   npm run db:import -- --refresh also rewrite names, copy and SEO of imported rows
import 'dotenv/config'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { closePool, getPool } from '../src/pool'

interface LegacyImage {
  url: string
  name: string
  thumbnail: string
}
interface LegacyCategory {
  id: number
  name: string
  description: string | null
  featured: boolean
  icon: LegacyImage | null
}
interface LegacyProduct {
  id: number
  name: string
  description: string | null
  price: number
  sellAt: number | null
  categoryId: number
  features: Array<{ type: string; options: Array<string> }>
  combinationCount: Record<string, number>
  images: Array<LegacyImage>
  count: number
  featured: boolean
  createdAt: string
  updatedAt: string
  category?: LegacyCategory
}

const REFRESH = process.argv.includes('--refresh')
const ROOT = path.resolve(import.meta.dirname, '..')
const STORAGE = path.resolve(process.env.STORAGE_DIR || path.join(ROOT, '../../apps/web/storage'))

// ---- Category copy -----------------------------------------------------------------------

const CATEGORY_META: Record<
  number,
  { name: string; slug: string; tagline: string; intro: string; parent?: number; sort: number; featured?: boolean }
> = {
  206: {
    name: 'Earrings',
    slug: 'earrings',
    tagline: 'Studs, drops and hoops for every day',
    intro:
      'From delicate studs to bold drops, our earrings are made to be worn every day and remembered every time. Gold-plated, silver-tone and crystal styles, gift-boxed and delivered across Ghana.',
    sort: 1,
    featured: true,
  },
  211: {
    name: 'Luxe Earrings',
    slug: 'luxe-earrings',
    tagline: 'Statement earrings with a luxury finish',
    intro:
      'Floral, crystal and sculptural statement earrings that look far more expensive than they are. Our best-selling luxe earrings lift a simple outfit in seconds.',
    parent: 206,
    sort: 2,
    featured: true,
  },
  498: {
    name: 'Ear Cuffs',
    slug: 'ear-cuffs',
    tagline: 'No piercing needed',
    intro: 'Slip-on ear cuffs for an edgy, layered look without an extra piercing.',
    parent: 206,
    sort: 3,
  },
  80: {
    name: 'Earring Sets',
    slug: 'earrings-set',
    tagline: 'Several pairs, one box',
    intro: 'Curated sets of studs and hoops, so you have the right pair for every day of the week.',
    parent: 206,
    sort: 4,
  },
  84: {
    name: 'Necklaces',
    slug: 'necklaces',
    tagline: 'Gold and silver necklaces in quality materials',
    intro:
      'Zirconia pendants, layered chains and statement necklaces in gold plate and silver tone. Quality materials, finished to last.',
    sort: 5,
    featured: true,
  },
  82: {
    name: 'Matching Necklace & Earrings',
    slug: 'matching-necklace-and-earrings',
    tagline: 'Perfectly paired sets',
    intro: 'Necklace and earring sets designed together, so your look is finished the moment you put them on.',
    sort: 6,
    featured: true,
  },
  83: {
    name: 'Matching Sets',
    slug: 'matching-sets',
    tagline: 'Head-to-toe coordination',
    intro: 'Complete matching jewelry sets for weddings, parties and every special occasion.',
    sort: 7,
    featured: true,
  },
  85: {
    name: 'Rich Aunty Statement Sets',
    slug: 'rich-aunty-statement-sets',
    tagline: 'Bold, glamorous, unapologetic',
    intro: 'Big, bold statement sets for the woman who loves to make an entrance. Rich aunty energy, budget-friendly price.',
    sort: 8,
  },
  81: {
    name: 'Jewelry Combos',
    slug: 'jewelry-combos',
    tagline: 'Styled bundles at bundle prices',
    intro: 'Hand-styled combinations of necklaces, earrings and bracelets, bundled at a better price than buying separately.',
    sort: 9,
    featured: true,
  },
  193: {
    name: 'Bracelet Sets',
    slug: 'bracelets-sets',
    tagline: 'Stack them, mix them',
    intro: 'Bracelet stacks in gold and silver tones, ready to wear together or split up.',
    sort: 10,
    featured: true,
  },
  77: {
    name: 'Bracelets',
    slug: 'bracelets',
    tagline: 'Chains, cuffs and charms',
    intro: 'Single bracelets in quality metals, for everyday wear or stacking.',
    sort: 11,
  },
  76: {
    name: 'Bangles',
    slug: 'bangles',
    tagline: 'Classic bangles with a modern edge',
    intro: 'Solid and open bangles in gold and silver finishes. Wear one alone or stack a few.',
    sort: 12,
  },
  79: {
    name: 'Earrings & Bracelet Sets',
    slug: 'earrings-and-bracelet-set',
    tagline: 'A coordinated pair',
    intro: 'Earrings and a matching bracelet, boxed together. An easy, thoughtful gift.',
    sort: 13,
  },
  75: {
    name: '4-in-1 Watch Sets',
    slug: '4-in-1-watch-sets',
    tagline: 'Watch, bracelet, necklace and earrings',
    intro: 'A watch with a bracelet, necklace and earrings, all coordinated and gift-boxed. Our favourite present for her.',
    sort: 14,
    featured: true,
  },
  86: {
    name: 'Watch & Bracelet Sets',
    slug: 'watch-and-bracelet-sets',
    tagline: 'Time, beautifully stacked',
    intro: 'Elegant ladies watches paired with a matching bracelet.',
    sort: 15,
  },
  201: {
    name: 'Ladies Watches',
    slug: 'ladies-watches',
    tagline: 'Elegant everyday timepieces',
    intro: 'Slim, elegant ladies watches in gold, silver and rose-gold tones.',
    sort: 16,
  },
  78: {
    name: 'Brooch Sets',
    slug: 'brooch-sets',
    tagline: 'The finishing touch',
    intro: 'Brooch sets that add polish to a suit, a kaba or a headwrap.',
    sort: 17,
    featured: true,
  },
  198: {
    name: 'Pearls',
    slug: 'pearls',
    tagline: 'Timeless pearl jewelry',
    intro: 'Pearl necklaces and earrings with a classic, elegant feel.',
    sort: 18,
  },
  200: {
    name: 'Anklets',
    slug: 'anklets',
    tagline: 'Quality stainless steel anklets',
    intro: 'Dainty anklets in stainless steel that stand up to sun, sea and everyday wear.',
    sort: 19,
  },
  205: {
    name: 'Keyholders & Bag Charms',
    slug: 'keyholders-bag-charms',
    tagline: 'Little luxuries for your bag',
    intro: 'Cute keyholders and bag charms that make thoughtful small gifts. Some even light up.',
    sort: 20,
  },
  199: {
    name: 'Jewelry Organizers',
    slug: 'jewelry-organizers',
    tagline: 'A home for every piece',
    intro: 'Organisers and boxes that keep your jewelry tangle-free and tarnish-free.',
    sort: 21,
  },
}

// ---- Helpers -------------------------------------------------------------------------------

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150)

const SMALL = new Set(['and', 'or', 'of', 'in', 'with', 'a', 'the', 'for', 'to'])
const titleCase = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// The old descriptions were mostly the same purchase instructions; that copy now
// lives on the Shipping and Returns pages. Keep only what is about the piece.
const BOILERPLATE = [
  /shop (here|on our website)[^.]*\./gi,
  /send screenshots[^.]*\./gi,
  /delivery is made nationwide[\s\S]*?(?=no refunds|$)/gi,
  /if you[’']re not sure of the delivery[^.]*\.( thanks\.)?/gi,
  /no refunds allowed\.?/gi,
  /exchanges are allowed[^.]*\.?/gi,
  /check page for reference\.?/gi,
  /thanks\.?/gi,
]

function pieceNotes(description: string | null) {
  let text = (description ?? '').replace(/[✅🎉]/g, '')
  const boxed = /comes (with|in) a box/i.test(text)
  text = text.replace(/comes (with|in) a box\.?/gi, '')
  for (const re of BOILERPLATE) text = text.replace(re, ' ')
  const notes = text
    .split(/(?<=\.)\s+|\n+/)
    .map((s) => s.trim().replace(/^[-–\d.)\s]+/, ''))
    .filter((s) => s.length > 3)
    .map((s) => (s.endsWith('.') ? s : `${s}.`))
  return { boxed, notes }
}

function materialFor(text: string): string | null {
  if (/italian gold/i.test(text)) return 'Italian gold plated'
  if (/stainless/i.test(text)) return 'Stainless steel'
  if (/sterling/i.test(text)) return 'Sterling silver'
  if (/pearl/i.test(text)) return 'Pearl'
  if (/zirconia/i.test(text)) return 'Zirconia'
  if (/crystal/i.test(text)) return 'Crystal'
  if (/rose[- ]?gold/i.test(text)) return 'Rose-gold plated'
  if (/gold/i.test(text)) return 'Gold plated'
  if (/silver/i.test(text)) return 'Silver plated'
  return null
}

const OPTION_NAMES: Record<string, string> = { color: 'Colour', size: 'Size', grade: 'Grade' }

function describe(p: LegacyProduct, name: string, category: string, material: string | null) {
  const { boxed, notes } = pieceNotes(p.description)
  const kind = category.toLowerCase()
  const lead = `The ${name} is part of our ${category} collection at Roes Outlet: ${
    material ? `${material.toLowerCase()} ` : ''
  }jewelry with a luxury look at an everyday price.`
  const style =
    /earring|cuff/i.test(kind) || /earring/i.test(name)
      ? 'Lightweight and comfortable, they frame the face beautifully, from office days to wedding receptions.'
      : /necklace|pearl/i.test(kind)
        ? 'It sits beautifully on its own or layered with other chains, and works with everything from a simple tee to a kaba.'
        : /watch/i.test(kind)
          ? 'Everything in the set is coordinated, so you can wear the pieces together or style them separately.'
          : /brooch/i.test(kind)
            ? 'Pin it to a lapel, a scarf or a headwrap for an instant touch of polish.'
            : /keyholder|charm/i.test(kind)
              ? 'Clip it to your keys or handbag for a fun, personal touch. It makes a sweet little gift too.'
              : /organi[sz]er/i.test(kind)
                ? 'It keeps your favourite pieces tidy, tangle-free and protected from scratches.'
                : 'Designed to be mixed, matched and worn on repeat.'
  const details = [
    material ? `<li><strong>Material:</strong> ${escapeHtml(material)}</li>` : '',
    ...p.features.map(
      (f) =>
        `<li><strong>${escapeHtml(OPTION_NAMES[f.type] ?? titleCase(f.type))}:</strong> ${escapeHtml(f.options.join(', '))}</li>`,
    ),
    boxed ? '<li><strong>Packaging:</strong> Comes in a gift box</li>' : '',
    '<li><strong>Delivery:</strong> Nationwide doorstep delivery or free pickup</li>',
    '<li><strong>Exchanges:</strong> Allowed in line with our <a href="/pages/returns-exchanges">exchange policy</a></li>',
  ].filter(Boolean)
  const html = [
    `<p>${escapeHtml(lead)} ${style}</p>`,
    notes.length ? `<p>${escapeHtml(notes.join(' '))}</p>` : '',
    `<h3>Details</h3><ul>${details.join('')}</ul>`,
    `<h3>Care</h3><p>Put your jewelry on after perfume and lotion, keep it dry and store it in its box to keep its shine. Read our <a href="/journal/how-to-care-for-gold-plated-jewelry">jewelry care guide</a>.</p>`,
  ]
    .filter(Boolean)
    .join('\n')
  const short = `${material ? `${material} ` : ''}${kind.replace(/s$/, '')} with a luxury finish${boxed ? ', gift-boxed' : ''}. ${notes[0] ?? ''}`.trim()
  return { html, short: short.charAt(0).toUpperCase() + short.slice(1), boxed }
}

function seoDescription(name: string, category: string, price: number, material: string | null, boxed: boolean) {
  const text = `Shop the ${name} (${category}) for GH₵${price.toFixed(0)} at Roes Outlet.${material ? ` ${material}.` : ''}${
    boxed ? ' Gift-boxed.' : ''
  } Nationwide delivery across Ghana.`
  return text.length <= 158 ? text : `${text.slice(0, 155).replace(/\s+\S*$/, '')}…`
}

// ---- Photos ----------------------------------------------------------------------------------

async function storePhoto(url: string, folder: string): Promise<{ url: string; width: number; height: number } | null> {
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 20)
  const key = `catalog/${folder}/${hash}.webp`
  const file = path.join(STORAGE, key)
  if (existsSync(file)) {
    const meta = await sharp(file).metadata()
    return { url: `/files/${key}`, width: meta.width ?? 0, height: meta.height ?? 0 }
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const source = Buffer.from(await res.arrayBuffer())
      const { data, info } = await sharp(source, { failOn: 'none' })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 5, smartSubsample: true })
        .toBuffer({ resolveWithObject: true })
      await mkdir(path.dirname(file), { recursive: true })
      const tmp = `${file}.${process.pid}.tmp`
      await writeFile(tmp, data)
      await rename(tmp, file)
      return { url: `/files/${key}`, width: info.width, height: info.height }
    } catch (err) {
      if (attempt === 3) {
        console.warn(`  ! couldn't fetch ${url}: ${err instanceof Error ? err.message : err}`)
        return null
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }
  return null
}

async function mapLimit<T, R>(items: Array<T>, limit: number, fn: (item: T, i: number) => Promise<R>): Promise<Array<R>> {
  const out: Array<R> = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i]!, i)
      }
    }),
  )
  return out
}

// ---- Import --------------------------------------------------------------------------------

async function main() {
  const pool = getPool()
  const catalog = JSON.parse(await readFile(path.join(ROOT, 'seed/legacy-catalog.json'), 'utf8')) as {
    categories: Array<LegacyCategory>
    products: Array<LegacyProduct>
  }
  const home = JSON.parse(await readFile(path.join(ROOT, 'seed/legacy-home.json'), 'utf8')) as {
    banner: LegacyImage | null
  }
  console.log(`Storage: ${STORAGE}`)

  // Categories: parents first so children can point at them.
  const legacyCategories = new Map<number, LegacyCategory>()
  for (const c of catalog.categories) legacyCategories.set(c.id, c)
  for (const p of catalog.products) if (p.category && !legacyCategories.has(p.category.id)) legacyCategories.set(p.category.id, p.category)

  const categoryIds = new Map<number, number>()
  const categoryNames = new Map<number, string>()
  const ordered = [...legacyCategories.values()].sort(
    (a, b) => Number(Boolean(CATEGORY_META[a.id]?.parent)) - Number(Boolean(CATEGORY_META[b.id]?.parent)),
  )
  for (const c of ordered) {
    const meta = CATEGORY_META[c.id]
    const name = meta?.name ?? titleCase(c.name)
    const slug = meta?.slug ?? slugify(c.name)
    categoryNames.set(c.id, name)
    const image = c.icon ? await storePhoto(c.icon.url, 'categories') : null
    const description = meta ? `<p>${escapeHtml(meta.intro)}</p>` : c.description ? `<p>${escapeHtml(c.description)}</p>` : null
    const parentId = meta?.parent ? (categoryIds.get(meta.parent) ?? null) : null
    const [found] = await pool.query<Array<RowDataPacket>>('SELECT id FROM categories WHERE legacy_id = ?', [c.id])
    if (found[0]) {
      categoryIds.set(c.id, found[0].id)
      if (REFRESH) {
        await pool.query(
          'UPDATE categories SET name = ?, slug = ?, tagline = ?, description = ?, parent_id = ?, sort_order = ?, image_url = COALESCE(?, image_url) WHERE id = ?',
          [name, slug, meta?.tagline ?? null, description, parentId, meta?.sort ?? 99, image?.url ?? null, found[0].id],
        )
      }
      continue
    }
    const [r] = await pool.query<ResultSetHeader>(
      `INSERT INTO categories (legacy_id, parent_id, name, slug, tagline, description, image_url, seo_title, seo_description, is_featured, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id,
        parentId,
        name,
        slug,
        meta?.tagline ?? null,
        description,
        image?.url ?? null,
        `${name}: Shop ${name} in Ghana`,
        meta ? meta.intro.slice(0, 158) : `Shop ${name.toLowerCase()} at Roes Outlet. Quality jewelry, nationwide delivery.`,
        meta?.featured || c.featured ? 1 : 0,
        meta?.sort ?? 99,
      ],
    )
    categoryIds.set(c.id, r.insertId)
    console.log(`Category: ${name}`)
  }

  // Products, newest last so ids follow the old store's order.
  const products = [...catalog.products].sort((a, b) => a.id - b.id)
  const newest = Math.max(...products.map((p) => Date.parse(p.createdAt)))
  const usedSlugs = new Set(
    (await pool.query<Array<RowDataPacket>>('SELECT slug FROM products'))[0].map((r) => r.slug as string),
  )
  let created = 0
  let photos = 0

  await mapLimit(products, 4, async (p) => {
    const [found] = await pool.query<Array<RowDataPacket>>('SELECT id, slug FROM products WHERE legacy_id = ?', [p.id])
    if (found[0] && !REFRESH) return
    const name = titleCase(p.name)
    const categoryName = categoryNames.get(p.categoryId) ?? 'Jewelry'
    const material = materialFor(`${p.name} ${p.description ?? ''}`)
    const { html, short, boxed } = describe(p, name, categoryName, material)
    const onSale = p.sellAt !== null && p.sellAt < p.price
    const price = onSale ? Number(p.sellAt) : Number(p.price)
    const createdAt = new Date(p.createdAt).toISOString().slice(0, 19).replace('T', ' ')
    const tags = [categoryName, material, boxed ? 'Gift boxed' : null].filter(Boolean)
    const fields = {
      category_id: categoryIds.get(p.categoryId) ?? null,
      name,
      short_description: short.slice(0, 400),
      description: html,
      price,
      compare_at_price: onSale ? Number(p.price) : null,
      stock: Math.max(0, p.count ?? 0),
      material,
      tags: JSON.stringify(tags),
      is_featured: p.featured ? 1 : 0,
      is_new: newest - Date.parse(p.createdAt) < 75 * 86_400_000 ? 1 : 0,
      seo_title: `${name} | ${categoryName}`.slice(0, 120),
      seo_description: seoDescription(name, categoryName, price, material, boxed),
      focus_keyword: name.toLowerCase(),
    }

    if (found[0]) {
      const sets = Object.keys(fields).map((k) => `${k} = ?`)
      await pool.query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, [...Object.values(fields), found[0].id])
      return
    }

    let slug = slugify(name)
    if (usedSlugs.has(slug)) slug = `${slug}-${p.id}`
    usedSlugs.add(slug)

    const [r] = await pool.query<ResultSetHeader>(
      `INSERT INTO products (legacy_id, sku, slug, status, published_at, created_at, ${Object.keys(fields).join(', ')})
       VALUES (?, ?, ?, 'active', ?, ?, ${Object.keys(fields)
         .map(() => '?')
         .join(', ')})`,
      [p.id, `RO-${p.id}`, slug, createdAt, createdAt, ...Object.values(fields)],
    )
    const productId = r.insertId

    let sort = 0
    for (const f of p.features) {
      for (const value of f.options) {
        await pool.query(
          'INSERT IGNORE INTO product_variants (product_id, option_name, option_value, stock, sort_order) VALUES (?, ?, ?, ?, ?)',
          [productId, OPTION_NAMES[f.type] ?? titleCase(f.type), value, Math.max(0, p.combinationCount?.[value] ?? 0), sort++],
        )
      }
    }

    const stored = await mapLimit(p.images, 3, (img) => storePhoto(img.url, 'products'))
    let order = 0
    for (const img of stored) {
      if (!img) continue
      await pool.query(
        'INSERT INTO product_images (product_id, url, alt, width, height, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [
          productId,
          img.url,
          `${name}${order ? ` (view ${order + 1})` : ''}, ${categoryName.toLowerCase()} by Roes Outlet`,
          img.width,
          img.height,
          order,
        ],
      )
      order++
      photos++
    }
    created++
    if (created % 25 === 0) console.log(`  ${created} products imported (${photos} photos)…`)
  })
  console.log(`Products: ${created} imported${REFRESH ? ', existing ones refreshed' : ''}; ${photos} photos stored.`)

  // Hero slides from the old banner and featured categories, if there are none yet.
  const [[slides]] = await pool.query<Array<RowDataPacket>>('SELECT COUNT(*) AS n FROM slides')
  if (!Number(slides?.n)) {
    const banner = home.banner ? await storePhoto(home.banner.url, 'banners') : null
    const pick = async (slug: string) =>
      (
        await pool.query<Array<RowDataPacket>>(
          `SELECT i.url FROM products p JOIN categories c ON c.id = p.category_id
           JOIN product_images i ON i.product_id = p.id AND i.sort_order = 0
           WHERE c.slug = ? ORDER BY p.is_featured DESC, p.created_at DESC LIMIT 1`,
          [slug],
        )
      )[0][0]?.url as string | undefined
    const candidates = [
      {
        eyebrow: 'New season',
        title: 'Luxury on budget',
        subtitle: 'Quality pieces you will wear on repeat: gift-boxed and delivered to your door anywhere in Ghana.',
        image: banner?.url ?? (await pick('luxe-earrings')),
        cta: ['Shop new arrivals', '/shop?sort=newest'],
        align: 'left',
      },
      {
        eyebrow: 'Best sellers',
        title: 'Luxe earrings, from GH₵45',
        subtitle: 'Floral, crystal and statement styles that do all the talking.',
        image: await pick('luxe-earrings'),
        cta: ['Shop luxe earrings', '/collections/luxe-earrings'],
        align: 'left',
      },
      {
        eyebrow: 'The perfect gift',
        title: '4-in-1 watch sets',
        subtitle: 'A watch, bracelet, necklace and earrings, coordinated and boxed together.',
        image: await pick('4-in-1-watch-sets'),
        cta: ['Shop watch sets', '/collections/4-in-1-watch-sets'],
        align: 'left',
      },
    ]
    let i = 0
    for (const s of candidates) {
      if (!s.image) continue
      await pool.query(
        'INSERT INTO slides (eyebrow, title, subtitle, image_url, cta_label, cta_url, align, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [s.eyebrow, s.title, s.subtitle, s.image, s.cta[0], s.cta[1], s.align, i++],
      )
    }
    console.log(`Slides: ${i} created.`)
  }

  // Journal articles without a cover get a photo from a matching collection.
  const covers: Array<[string, string]> = [
    ['how-to-care-for-gold-plated-jewelry', 'matching-necklace-and-earrings'],
    ['jewelry-gift-guide-ghana', '4-in-1-watch-sets'],
    ['how-to-layer-necklaces', 'necklaces'],
  ]
  for (const [post, collection] of covers) {
    await pool.query(
      `UPDATE pages SET cover_url = (
         SELECT i.url FROM products p JOIN categories c ON c.id = p.category_id
         JOIN product_images i ON i.product_id = p.id AND i.sort_order = 0
         WHERE c.slug = ? ORDER BY p.is_featured DESC, p.id DESC LIMIT 1)
       WHERE kind = 'post' AND slug = ? AND cover_url IS NULL`,
      [collection, post],
    )
  }

  // Everything imported is also in the media library.
  await pool.query(
    `INSERT IGNORE INTO media (url, filename, mime, size, width, height, alt)
     SELECT url, SUBSTRING_INDEX(url, '/', -1), 'image/webp', 0, width, height, alt FROM product_images`,
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => closePool())
