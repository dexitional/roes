// Base data: the first administrator, store settings, CMS pages, journal posts
// and a welcome coupon. Safe to run again: existing rows are left alone.
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { closePool, getPool } from '../src/pool'
import { DEFAULT_SETTINGS, SETTINGS_KEYS } from '../src/settings'

const PAGES: Array<{ slug: string; title: string; excerpt: string; footer: boolean; body: string }> = [
  {
    slug: 'about',
    title: 'About Roes Outlet',
    excerpt: 'Affordable luxury jewelry from Ghana, chosen for quality and made to be gifted.',
    footer: true,
    body: `<h2>Luxury on budget</h2>
<p>Roes Outlet is a Ghanaian jewelry brand built on one idea: quality pieces should not cost a fortune. We curate necklaces, luxe earrings, bracelet and watch sets, brooches, anklets and matching combos for women and men, young or old.</p>
<p>Every collection is hand-picked in stainless steel, gold plate and sterling silver, and most pieces arrive in a gift box, ready to give or to keep.</p>
<h3>Personalised for you</h3>
<p>Looking for something specific? We put together bespoke jewelry combinations to match an outfit, an occasion or a budget. Send us a message on WhatsApp and we will style a set just for you.</p>
<blockquote><p>Invest in something that truly lasts. Choose quality over quantity, always.</p></blockquote>`,
  },
  {
    slug: 'shipping-delivery',
    title: 'Shipping & Delivery',
    excerpt: 'Nationwide doorstep delivery, same-day bus parcels and free pickup.',
    footer: true,
    body: `<h2>Delivery across Ghana</h2>
<p>We deliver nationwide. Choose the option that suits you at checkout:</p>
<ol>
<li><strong>FedEx doorstep delivery</strong>: next-day delivery from GH₵35 (prices vary outside regional capitals).</li>
<li><strong>Speedaf doorstep delivery</strong>: 2–3 days, GH₵38–50, with a pay-on-arrival option for the delivery fee.</li>
<li><strong>Parcel by bus</strong>: same-day delivery; the fare depends on the driver.</li>
<li><strong>Pickup</strong>: collect your order from us for free. We text you when it is ready.</li>
</ol>
<p>Not sure which delivery fee applies to you? Choose <em>pickup</em> at checkout and we will confirm the delivery fee with you by phone or WhatsApp.</p>
<h3>Order tracking</h3>
<p>You will receive an SMS when your order is placed, when your payment is confirmed and when it ships. You can also follow it under <a href="/account">My account</a>.</p>`,
  },
  {
    slug: 'returns-exchanges',
    title: 'Returns & Exchanges',
    excerpt: 'No refunds, but exchanges are always welcome.',
    footer: true,
    body: `<h2>Our exchange policy</h2>
<p>We do not offer refunds, but exchanges are allowed. If a piece is not right, contact us within <strong>3 days</strong> of receiving it.</p>
<ul>
<li>Items must be unworn and returned in their original box and packaging.</li>
<li>Earrings cannot be exchanged for hygiene reasons unless they arrived damaged.</li>
<li>The customer covers delivery costs for exchanges unless the item was faulty.</li>
</ul>
<p>To start an exchange, message us on WhatsApp with your order reference and photos of the item.</p>`,
  },
  {
    slug: 'faq',
    title: 'Frequently Asked Questions',
    excerpt: 'Answers about payment, delivery, materials and caring for your jewelry.',
    footer: true,
    body: `<h2>Ordering & payment</h2>
<h3>How do I pay?</h3>
<p>At checkout, send the order total by Mobile Money to the number shown, using your order reference as the note, then enter the transaction ID. We confirm the payment and text you straight away.</p>
<h3>Do I need an account?</h3>
<p>You sign in with your Google account. It takes one tap and lets you follow your orders and save favourites to your wishlist.</p>
<h2>Products</h2>
<h3>What are your pieces made of?</h3>
<p>Our collections are stainless steel, gold plate and sterling silver, with zirconia, crystal and pearl details. Each product page lists its materials.</p>
<h3>Will it tarnish?</h3>
<p>Stainless steel pieces are made for everyday wear. Keep plated jewelry away from perfume, water and lotions to keep its shine for longer.</p>
<h2>Delivery</h2>
<h3>How long does delivery take?</h3>
<p>Next day with FedEx, 2–3 days with Speedaf, or same day by bus parcel. See <a href="/pages/shipping-delivery">Shipping & Delivery</a>.</p>`,
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    excerpt: 'How Roes Outlet uses and protects your information.',
    footer: true,
    body: `<h2>What we collect</h2>
<p>When you sign in with Google we receive your name, email address and profile photo. When you order, we also keep the phone number and delivery address you give us.</p>
<h2>How we use it</h2>
<ul><li>To process and deliver your orders.</li><li>To send order updates by SMS.</li><li>To improve the shop, using anonymous browsing statistics.</li></ul>
<p>We never sell your information. To have your account deleted, email us at roesoutlet@gmail.com.</p>`,
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    excerpt: 'The terms that apply when you shop with Roes Outlet.',
    footer: true,
    body: `<h2>Orders</h2>
<p>An order is confirmed once payment has been received. Prices are in Ghana cedis (GH₵) and may change without notice; the price you pay is the one shown at checkout.</p>
<h2>Stock</h2>
<p>Many of our pieces are limited. If an item sells out after you order, we will offer an exchange for another piece of equal value.</p>
<h2>Exchanges</h2>
<p>See our <a href="/pages/returns-exchanges">Returns & Exchanges</a> policy.</p>`,
  },
]

const POSTS: Array<{ slug: string; title: string; excerpt: string; body: string }> = [
  {
    slug: 'how-to-care-for-gold-plated-jewelry',
    title: 'How to Care for Gold-Plated Jewelry So It Shines for Years',
    excerpt: 'Five simple habits that keep gold-plated earrings, necklaces and bracelets looking new.',
    body: `<p>Gold-plated jewelry gives you the look of solid gold at a fraction of the price. With a little care it keeps its glow for years. Here is how.</p>
<h2>1. Put it on last, take it off first</h2>
<p>Perfume, lotion and hairspray contain chemicals that wear down plating. Get dressed, let everything dry, then add your jewelry.</p>
<h2>2. Keep it dry</h2>
<p>Remove plated pieces before showering, swimming or exercising. Sweat and chlorine are the biggest causes of tarnish.</p>
<h2>3. Store pieces separately</h2>
<p>Keep each piece in its gift box or a soft pouch so chains do not tangle and stones do not scratch the plating. A <a href="/collections/jewelry-organizers">jewelry organiser</a> makes this easy.</p>
<h2>4. Clean gently</h2>
<p>Wipe with a soft, dry cloth after wearing. Never use toothpaste or abrasive cleaners.</p>
<h2>5. Choose stainless steel for every day</h2>
<p>If you want pieces you never take off, choose stainless steel. It resists tarnish and water far better than plate.</p>`,
  },
  {
    slug: 'jewelry-gift-guide-ghana',
    title: 'The Jewelry Gift Guide: Thoughtful Gifts on Every Budget',
    excerpt: 'Birthday, anniversary or just because: our favourite gift-boxed sets, from GH₵50.',
    body: `<p>Jewelry is the gift that gets worn every day. Every Roes Outlet set arrives boxed and ready to give.</p>
<h2>Under GH₵100: luxe earrings</h2>
<p>A pair of <a href="/collections/luxe-earrings">luxe earrings</a> is the easiest win. Floral, crystal and statement styles suit every taste.</p>
<h2>For her birthday: matching sets</h2>
<p>A <a href="/collections/matching-necklace-and-earrings">matching necklace and earrings</a> set takes the guesswork out of styling.</p>
<h2>For the woman who has everything: a watch set</h2>
<p>Our <a href="/collections/4-in-1-watch-sets">4-in-1 watch sets</a> pair a watch with a bracelet, necklace and earrings, all in one box.</p>
<h2>For him</h2>
<p>Ask us about our men's collection: chains, bracelets and watches with clean, bold lines.</p>`,
  },
  {
    slug: 'how-to-layer-necklaces',
    title: 'How to Layer Necklaces Like a Stylist',
    excerpt: 'The 3-length rule, mixing metals and choosing a focal piece.',
    body: `<p>Layered necklaces add depth to any outfit, from a plain tee to a kaba. Follow these rules for a look that feels effortless.</p>
<h2>Use three lengths</h2>
<p>Start with a choker or 40 cm chain, add a 45 cm pendant, then finish with a longer 50–55 cm chain. Two to five centimetres between layers stops them tangling.</p>
<h2>Pick one focal piece</h2>
<p>Let one necklace stand out (a <a href="/collections/necklaces">zirconia pendant</a>, say) and keep the others simple.</p>
<h2>Mix metals with intention</h2>
<p>Gold and silver together look modern when you repeat both colours, for example in a <a href="/collections/bracelets-sets">bracelet stack</a>.</p>`,
  },
]

async function main() {
  const pool = getPool()

  // ---- Administrator ----
  const name = process.env.SEED_ADMIN_NAME || 'Roes Administrator'
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@roesoutlet.com').toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!'
  const [existing] = await pool.query<Array<RowDataPacket>>('SELECT id FROM users WHERE email = ?', [email])
  if (existing.length) {
    console.log(`Administrator ${email} already exists.`)
  } else {
    await pool.query("INSERT INTO users (full_name, email, role, password_hash) VALUES (?, ?, 'admin', ?)", [
      name,
      email,
      await bcrypt.hash(password, 12),
    ])
    console.log(`Created administrator ${email}.`)
  }

  // ---- Settings ----
  for (const key of SETTINGS_KEYS) {
    const [r] = await pool.query<ResultSetHeader>('INSERT IGNORE INTO settings (`key`, value) VALUES (?, ?)', [
      key,
      JSON.stringify(DEFAULT_SETTINGS[key]),
    ])
    if (r.affectedRows) console.log(`Settings: ${key}`)
  }

  // ---- Pages and journal ----
  for (const p of PAGES) {
    await pool.query(
      `INSERT IGNORE INTO pages (kind, title, slug, excerpt, body, status, show_in_footer, published_at)
       VALUES ('page', ?, ?, ?, ?, 'published', ?, NOW())`,
      [p.title, p.slug, p.excerpt, p.body, p.footer ? 1 : 0],
    )
  }
  for (const [i, p] of POSTS.entries()) {
    await pool.query(
      `INSERT IGNORE INTO pages (kind, title, slug, excerpt, body, status, published_at)
       VALUES ('post', ?, ?, ?, ?, 'published', NOW() - INTERVAL ? DAY)`,
      [p.title, p.slug, p.excerpt, p.body, (i + 1) * 9],
    )
  }
  console.log('Pages and journal posts are in place.')

  await pool.query(
    `INSERT IGNORE INTO coupons (code, description, kind, value, min_subtotal) VALUES ('WELCOME10', '10% off a first order over GH₵150', 'percent', 10, 150)`,
  )
  console.log('Seed complete.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => closePool())
