// Admin: pages & journal, hero slides, media library, settings, SMS and staff.
import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import { z } from 'zod'
import { SETTINGS_KEYS } from '@roes/db'
import type { SettingsKey } from '@roes/db'
import { pageSchema, slideSchema, staffSchema } from '#/lib/schemas'
import { slugify } from '#/lib/format'
import { normalizePhone } from '#/lib/phone'
import { requireAdmin, requireStaff } from '../lib/auth'
import { bustCache } from '../lib/cache'
import { exec, insert, like, one, paging, parseId, rows, scalar, update } from '../lib/db'
import { AppError, notFound } from '../lib/errors'
import { deleteLocalObject, localKeyFromUrl } from '../lib/local-storage'
import { paystackConfigured } from '../lib/paystack'
import { cleanHtml } from '../lib/rich-text'
import { getSettings, saveSettings } from '../lib/settings'
import { sendSms, smsBalance, smsStatus } from '../lib/sms'
import { storeImage } from '../lib/uploads'
import { validate } from '../lib/validate'

const settingsSchemas: Record<SettingsKey, z.ZodType> = {
  store: z.object({
    name: z.string().trim().min(2).max(80),
    tagline: z.string().trim().max(120),
    about: z.string().trim().max(2000),
    email: z.string().trim().max(150),
    phone: z.string().trim().max(30),
    whatsapp: z.string().trim().max(30),
    address: z.string().trim().max(200),
    socials: z.object({
      instagram: z.string().trim().max(80),
      tiktok: z.string().trim().max(80),
      twitter: z.string().trim().max(80),
      facebook: z.string().trim().max(80),
      snapchat: z.string().trim().max(80),
    }),
  }),
  payments: z.object({
    momoNumber: z.string().trim().min(9, 'Enter the MoMo number orders should be paid to').max(20),
    momoName: z.string().trim().min(2).max(80),
    momoNetwork: z.string().trim().max(40),
    instructions: z.string().trim().max(600),
    paystackEnabled: z.boolean(),
  }),
  delivery: z.object({
    pickupAddress: z.string().trim().max(300),
    defaultFee: z.coerce.number().min(0).max(10_000),
    freeOver: z.coerce.number().min(0).max(1_000_000),
    regions: z.array(z.object({ name: z.string().trim().min(1).max(80), fee: z.coerce.number().min(0).max(10_000) })).max(40),
    note: z.string().trim().max(600),
  }),
  notifications: z.object({
    smsEnabled: z.boolean(),
    smsSender: z
      .string()
      .trim()
      .min(3)
      .max(11, 'Sender IDs are at most 11 characters')
      .regex(/^[A-Za-z0-9 ]+$/, 'Letters, numbers and spaces only'),
    adminPhones: z.array(z.string().trim().max(20)).max(10),
    orderPlaced: z.boolean(),
    paymentConfirmed: z.boolean(),
    statusChanged: z.boolean(),
  }),
  seo: z.object({
    titleSuffix: z.string().trim().max(60),
    defaultDescription: z.string().trim().max(300),
    keywords: z.string().trim().max(400),
  }),
  announcement: z.object({ enabled: z.boolean(), text: z.string().trim().max(200), link: z.string().trim().max(300) }),
}

async function uniquePageSlug(kind: string, wanted: string, exceptId = 0) {
  const base = slugify(wanted) || 'page'
  let slug = base
  for (let i = 2; await one('SELECT id FROM pages WHERE kind = ? AND slug = ? AND id <> ?', [kind, slug, exceptId]); i++) slug = `${base}-${i}`
  return slug
}

export const adminContentRoute = new Hono()
  .use(requireStaff)

  // ---- Pages and journal ----
  .get('/pages', async (c) => {
    const kind = c.req.query('kind') === 'post' ? 'post' : 'page'
    return c.json(
      await rows(
        `SELECT p.id, p.kind, p.title, p.slug, p.excerpt, p.cover_url, p.status, p.show_in_footer, p.published_at, p.updated_at,
                p.seo_title, p.seo_description, u.full_name AS author
           FROM pages p LEFT JOIN users u ON u.id = p.author_id WHERE p.kind = ? ORDER BY p.updated_at DESC`,
        [kind],
      ),
    )
  })
  .get('/pages/:id', async (c) => {
    const page = await one('SELECT * FROM pages WHERE id = ?', [parseId(c.req.param('id'))])
    if (!page) throw notFound('Page')
    return c.json(page)
  })
  .post('/pages', validate('json', pageSchema), async (c) => {
    const input = c.req.valid('json')
    const id = await insert('pages', {
      ...input,
      slug: await uniquePageSlug(input.kind, input.slug || input.title),
      body: cleanHtml(input.body),
      showInFooter: input.showInFooter ? 1 : 0,
      authorId: c.get('user').id,
      publishedAt: input.status === 'published' ? new Date() : null,
    })
    bustCache()
    return c.json({ id }, 201)
  })
  .put('/pages/:id', validate('json', pageSchema), async (c) => {
    const id = parseId(c.req.param('id'))
    const input = c.req.valid('json')
    await update('pages', id, {
      ...input,
      slug: await uniquePageSlug(input.kind, input.slug || input.title, id),
      body: cleanHtml(input.body),
      showInFooter: input.showInFooter ? 1 : 0,
    })
    await exec("UPDATE pages SET published_at = COALESCE(published_at, IF(status = 'published', NOW(), NULL)) WHERE id = ?", [id])
    bustCache()
    return c.json({ id })
  })
  .delete('/pages/:id', async (c) => {
    await exec('DELETE FROM pages WHERE id = ?', [parseId(c.req.param('id'))])
    bustCache()
    return c.json({ ok: true })
  })

  // ---- Slides ----
  .get('/slides', async (c) => c.json(await rows('SELECT * FROM slides ORDER BY sort_order, id')))
  .post('/slides', validate('json', slideSchema), async (c) => {
    const input = c.req.valid('json')
    const id = await insert('slides', { ...input, isActive: input.isActive ? 1 : 0 })
    bustCache()
    return c.json({ id }, 201)
  })
  .put('/slides/:id', validate('json', slideSchema), async (c) => {
    const input = c.req.valid('json')
    await update('slides', parseId(c.req.param('id')), { ...input, isActive: input.isActive ? 1 : 0 })
    bustCache()
    return c.json({ ok: true })
  })
  .delete('/slides/:id', async (c) => {
    await exec('DELETE FROM slides WHERE id = ?', [parseId(c.req.param('id'))])
    bustCache()
    return c.json({ ok: true })
  })
  .post('/slides/reorder', validate('json', z.object({ ids: z.array(z.number().int().positive()).max(50) })), async (c) => {
    for (const [i, id] of c.req.valid('json').ids.entries()) await exec('UPDATE slides SET sort_order = ? WHERE id = ?', [i, id])
    bustCache()
    return c.json({ ok: true })
  })

  // ---- Media ----
  .get('/media', async (c) => {
    const q = c.req.query()
    const { page, pageSize, limit, offset } = paging(q, 48)
    const where = q.q ? 'WHERE filename LIKE ? OR alt LIKE ?' : ''
    const params = q.q ? [like(q.q), like(q.q)] : []
    const [data, total] = await Promise.all([
      rows(`SELECT id, url, filename, mime, size, width, height, alt, created_at FROM media ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, [
        ...params,
        limit,
        offset,
      ]),
      scalar(`SELECT COUNT(*) FROM media ${where}`, params),
    ])
    return c.json({ data, total: Number(total), page, pageSize })
  })
  .post('/media', async (c) => {
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) throw new AppError('Choose an image to upload.', 422)
    const folder = typeof body.folder === 'string' && /^[a-z]+$/.test(body.folder) ? body.folder : 'uploads'
    const alt = typeof body.alt === 'string' ? body.alt.slice(0, 200) : null
    return c.json(await storeImage(file, { folder, alt, userId: c.get('user').id }), 201)
  })
  .patch('/media/:id', validate('json', z.object({ alt: z.string().trim().max(200).nullish() })), async (c) => {
    await exec('UPDATE media SET alt = ? WHERE id = ?', [c.req.valid('json').alt || null, parseId(c.req.param('id'))])
    return c.json({ ok: true })
  })
  .delete('/media/:id', async (c) => {
    const media = await one<{ url: string }>('SELECT url FROM media WHERE id = ?', [parseId(c.req.param('id'))])
    if (!media) throw notFound('File')
    const inUse = await one(
      `SELECT 1 FROM product_images WHERE url = ? UNION SELECT 1 FROM slides WHERE image_url = ? UNION SELECT 1 FROM categories WHERE image_url = ?
       UNION SELECT 1 FROM pages WHERE cover_url = ? LIMIT 1`,
      [media.url, media.url, media.url, media.url],
    )
    if (inUse) throw new AppError('This image is still used by a product, slide, collection or page.', 409)
    const key = localKeyFromUrl(media.url)
    if (key) await deleteLocalObject(key)
    await exec('DELETE FROM media WHERE id = ?', [parseId(c.req.param('id'))])
    return c.json({ ok: true })
  })

  // ---- Settings ----
  .get('/settings', async (c) => {
    return c.json({
      settings: await getSettings(),
      integrations: {
        sms: smsStatus(),
        paystack: paystackConfigured(),
        google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      },
    })
  })
  .put('/settings/:key', requireAdmin, async (c) => {
    const key = c.req.param('key') as SettingsKey
    if (!SETTINGS_KEYS.includes(key)) throw notFound('Setting')
    const parsed = settingsSchemas[key].safeParse(await c.req.json())
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new AppError(`${issue?.path.join(' › ') ?? ''}: ${issue?.message ?? 'Invalid value'}`, 422)
    }
    const value = parsed.data as Record<string, unknown>
    if (key === 'notifications') {
      const phones = (value.adminPhones as Array<string>).filter(Boolean)
      const bad = phones.find((p) => !normalizePhone(p))
      if (bad) throw new AppError(`"${bad}" is not a valid Ghana phone number.`, 422)
      value.adminPhones = phones
    }
    if (key === 'payments' && value.paystackEnabled && !paystackConfigured()) {
      throw new AppError('Set PAYSTACK_SECRET_KEY on the server before switching Paystack on.', 422)
    }
    await saveSettings(key, value as never)
    return c.json({ settings: await getSettings() })
  })

  // ---- SMS ----
  .get('/sms', async (c) => {
    const q = c.req.query()
    const { page, pageSize, limit, offset } = paging(q, 30)
    const [data, total, stats] = await Promise.all([
      rows(
        `SELECT s.id, s.recipient, s.message, s.context, s.status, s.error, s.created_at, o.reference
           FROM sms_logs s LEFT JOIN orders o ON o.id = s.order_id ORDER BY s.id DESC LIMIT ? OFFSET ?`,
        [limit, offset],
      ),
      scalar('SELECT COUNT(*) FROM sms_logs'),
      rows<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM sms_logs WHERE created_at > NOW() - INTERVAL 30 DAY GROUP BY status'),
    ])
    return c.json({
      data,
      total: Number(total),
      page,
      pageSize,
      stats: Object.fromEntries(stats.map((s) => [s.status, Number(s.n)])),
      status: smsStatus(),
      balance: await smsBalance(),
    })
  })
  .post(
    '/sms/send',
    requireAdmin,
    validate('json', z.object({ recipients: z.array(z.string()).min(1).max(200), message: z.string().trim().min(2).max(480) })),
    async (c) => {
      const { recipients, message } = c.req.valid('json')
      const results = await sendSms(recipients, message, { context: 'broadcast' })
      if (!results.length) throw new AppError('None of those numbers are valid Ghana phone numbers.', 422)
      return c.json({ sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok) })
    },
  )
  .get('/subscribers', async (c) => c.json(await rows('SELECT id, email, phone, created_at FROM subscribers ORDER BY id DESC LIMIT 1000')))

  // ---- Staff ----
  .get('/staff', requireAdmin, async (c) =>
    c.json(await rows("SELECT id, full_name, email, role, is_active, last_login_at, created_at, password_hash IS NOT NULL AS has_password FROM users WHERE role IN ('staff', 'admin') ORDER BY full_name")),
  )
  .post('/staff', requireAdmin, validate('json', staffSchema), async (c) => {
    const input = c.req.valid('json')
    const existing = await one<{ id: number; role: string }>('SELECT id, role FROM users WHERE email = ?', [input.email])
    const hash = input.password ? await bcrypt.hash(input.password, 12) : null
    if (existing) {
      // Promote an existing (Google) customer account.
      await exec('UPDATE users SET role = ?, full_name = ?, password_hash = COALESCE(?, password_hash), is_active = 1 WHERE id = ?', [
        input.role,
        input.fullName,
        hash,
        existing.id,
      ])
      return c.json({ id: existing.id })
    }
    const id = await insert('users', { fullName: input.fullName, email: input.email, role: input.role, passwordHash: hash })
    return c.json({ id }, 201)
  })
  .patch(
    '/staff/:id',
    requireAdmin,
    validate('json', z.object({ role: z.enum(['customer', 'staff', 'admin']).optional(), isActive: z.boolean().optional() })),
    async (c) => {
      const id = parseId(c.req.param('id'))
      if (id === c.get('user').id) throw new AppError('You cannot change your own access.', 422)
      const { role, isActive } = c.req.valid('json')
      if (role) await exec('UPDATE users SET role = ? WHERE id = ?', [role, id])
      if (isActive !== undefined) await exec('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id])
      return c.json({ ok: true })
    },
  )
