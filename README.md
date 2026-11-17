# Roes Outlet

The new online store for Roes Outlet (“Luxury on budget”), a jewelry shop in Ghana. It replaces the old site at www.roesoutlet.com, and its catalogue was imported from that site.

It includes:

- a storefront with Google sign-in
- checkout paid by Mobile Money, plus Paystack set up but switched off
- SMS notifications through SMSOnlineGH
- an admin area (CMS) with a rich-text editor and product analytics

It is a TanStack Start monorepo laid out like `capevars`. It uses a MySQL database named `roes` and runs on port 3020.

```
apps/web          TanStack Start app: storefront, admin, Hono API (/api/*), image optimiser (/img), file server (/files)
packages/db       MySQL pool, shared types/settings, migrations, seed + import scripts
packages/ui       cn() helper
packages/tsconfig shared tsconfig
```

## Setup

```bash
npm install
npm run db:setup      # create database "roes", migrate, seed, import the old catalogue (downloads ~900 photos)
npm run dev           # http://localhost:3020
```

`apps/web/.env` and `packages/db/.env` were created with the MySQL and SMSOnlineGH credentials from capevars. The database name was changed to `roes`. See `.env.example` in both folders for every setting.

| Script | What it does |
| --- | --- |
| `npm run db:migrate` | Apply new migrations in `packages/db/migrations`. |
| `npm run db:seed` | Set up the first admin, default settings, CMS pages, journal posts and the `WELCOME10` coupon. Running it again does not duplicate anything. |
| `npm run db:import` | Import categories, products, options and photos from `packages/db/seed/legacy-catalog.json`. Running it again skips what is already imported. Add `-- --refresh` to rewrite the copy and SEO text of imported products. |
| `npm run db:demo` | Add **demo** analytics data (90 days of shopper activity, demo customers, orders and reviews) so the dashboards can be tried out. Remove it with `npm run db:demo -- --clear`. Never run it on the live database. |

**Admin:** go to `/admin/login` and sign in as `admin@roesoutlet.com` with password `ChangeMe123!`. Change the password under Admin › Staff. Staff can also sign in with Google once their email is added there.

## The old catalogue

The old store (on the Adeton platform) was read through its public data endpoints, and the result is saved in `packages/db/seed/legacy-catalog.json`. It holds 375 products, 21 categories and 886 photos.

- Every photo is downloaded once, re-encoded as WebP (longest side 1600px) and stored under `apps/web/storage/catalog/`. Nothing is loaded from the old CDN.
- Prices marked down on the old site (“sell at”) become the price, with the old price kept as the compare-at price.
- Colour, size and grade options become variants, each with its own stock.
- The old descriptions were mostly the same purchase instructions on every product. That text now lives on the Shipping and Returns pages. Each product gets an original, SEO-friendly description, built from its collection, material and any notes about the piece itself. It also gets an SEO title, a meta description, a focus keyword and photo alt text.
- Where several products share a name, their URLs get the old id added on the end (e.g. `/p/ear-cuff-2155`). Every URL is unique and stays the same over time.

## Images and speed

- Uploads (admin media library, product photos, editor images) are converted to WebP by `sharp` and stored on local disk (`STORAGE_DIR`, default `apps/web/storage`). They are served from `/files/...` with a one-year immutable cache, ETags and byte ranges.
- `/img?src=&w=&q=` resizes images to fixed widths in AVIF or WebP. It keeps resized copies in memory and on disk (`IMAGE_CACHE_DIR`), and browsers cache them for a year. Every `<Img>` uses `srcset`/`sizes`, lazy-loads, and fades in over a shimmer.
- The catalogue API is cached inside the server process. Any admin change clears that cache straight away. Catalogue responses also send `stale-while-revalidate` headers.
- TanStack Query is filled during server rendering. Links preload their data on hover (`defaultPreload: 'intent'`), so moving to a product page took about 90 ms in testing. Page changes use view transitions, and every page has a skeleton while it loads.
- Production builds compress assets with Brotli and gzip, and give hashed `/assets/*` files an immutable cache.

## SEO

- Pages are rendered on the server, with a title, description, canonical URL, Open Graph and Twitter tags on every page.
- Structured data:
  - **Product** pages: Offer (with price, stock, shipping and return policy) and AggregateRating
  - **JewelryStore** organisation and **WebSite** with a sitelinks search box
  - **BreadcrumbList**, **CollectionPage** and **BlogPosting**
- `/sitemap.xml` lists every product with its photos (image sitemap extension), plus collections, pages and journal articles. `/robots.txt` blocks account, checkout and admin pages.
- Filtered and search-result pages are marked `noindex` so they don't compete with the main pages.
- Each product has an SEO panel in the admin: a Google result preview and a 0–100 score. The score checks title and description length, the focus keyword, word count, internal links, photo count and alt text.
- Collections have their own landing pages (`/collections/<slug>`) with intro text and SEO fields. Journal articles (`/journal`) bring in search traffic.

After launch, submit `https://<domain>/sitemap.xml` in Google Search Console.

## Sign-in

Customers sign up and sign in with Google only. To set it up:

1. In Google Cloud Console, create an OAuth client (type: Web application).
2. Add `{APP_URL}/api/auth/google/callback` as an authorised redirect URI, e.g. `http://localhost:3020/api/auth/google/callback`.
3. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `apps/web/.env`.

Until that's done, `DEV_LOGIN=true` (development only) adds an email box on `/login` that signs you in without Google.

## Payments

**Mobile Money (active).** Set the MoMo number, account name and network under Admin › Settings › Payments. The flow:

1. The customer places an order. They see that number, the order total and the order reference, and also get them by SMS.
2. The customer pays, then enters the number they paid from and the MoMo transaction ID. The order is marked “Proof sent” and the admin phones get an SMS.
3. In the admin, open the order and choose **Confirm payment** (or **Not received**, which asks the customer to resend). Confirming marks the order paid, adds it to the sales analytics and texts the customer.

Stock is set aside when the order is placed. Cancelling an order puts it back.

**Paystack (switched off).** To turn it on:

1. Set `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`.
2. Add the webhook `{APP_URL}/api/payments/paystack/webhook` in Paystack.
3. Switch Paystack on under Settings › Payments.

Checkout then offers “Card or MoMo online”. Every payment is checked with Paystack before an order is marked paid.

## SMS (SMSOnlineGH)

The app uses the SMSOnlineGH API key from capevars (`SMSONLINEGH_API_KEY`). Customers are texted when:

- they place an order (with the MoMo payment details)
- their payment is confirmed
- the order is being prepared, is shipped or ready for pickup, is delivered, or is cancelled

The admin phones get a text for every new order and every MoMo payment a customer reports. You can also text a customer from their order, or send to a list of numbers from Admin › SMS. Every message is logged.

Set the sender ID (default `RoesOutlet`) under Settings › Notifications. **It must be registered in your SMSOnlineGH account** before messages will go out. To test without sending real texts, start the server with `SMSONLINEGH_API_KEY=` (empty) and `SMS_SIMULATE=true`.

## Admin (CMS)

| Area | What you can do |
| --- | --- |
| Dashboard | Revenue and orders compared with the previous period, orders by status, recent orders, top sellers, low stock, and an “attention” bar (payments to confirm, orders to ship, reviews to check). |
| Product analytics | Views, unique visitors, add-to-bag and conversion rates, revenue and wishlists. Also: a conversion funnel, a performance table for every product (sortable, with trends), and **Trending / Hidden gems / Lots of looks, no bags / Restock soon** lists. Breakdowns by collection, device and traffic source, a day-and-hour browsing heatmap, top searches and searches with no results. Each product has its own report. |
| Products | Filter by status, collection, stock or missing SEO. Bulk publish, feature, move and archive. The editor covers the rich-text description, a drag-to-reorder gallery with alt text, pricing with margin, options with stock per option, tags, and the SEO panel. |
| Collections | Ordering, parent collections, cover images, intro text and SEO fields. |
| Orders | Tabs by status, search (including MoMo transaction ID), payment confirmation, status updates that text the customer, an order timeline, internal notes, an SMS log and a printable packing slip. |
| Customers, Reviews, Discounts | Customers with lifetime spend, wishlist and what they browse. Review approval (approved reviews give Google star ratings). Percentage or fixed discount codes with limits and dates. |
| Pages & journal, Slides, Media | The rich-text editor (Tiptap): headings, colours, highlight, alignment, tables, images from the media library, YouTube embeds, links, HTML source view, full screen and word count. Homepage hero slides. A media library with uploads and alt text. |
| Settings | Store details and social handles, MoMo and Paystack, delivery fees by region and free-delivery threshold, SMS settings, SEO defaults and the announcement bar. |

## Logo

The website uses the original logo, `files/logo.jpg`, unchanged apart from a transparent background. The transparent master is `files/logo-transparent.png`, and the web copy is `apps/web/public/logo.png` (the same image with only the empty margin trimmed). Only the background and the white inside the lettering and line art were made transparent. The white of the necklace stones, diamond facets and earring is part of the artwork and was kept. The favicon, home-screen icons and share image are made from the same file. The logo's burgundy and black lettering needs a light surface, so in dark mode it sits on a small ivory badge.

## Theme

The colours come from the logo:

- burgundy `#86012A`
- deep wine `#5B0116`
- crimson `#C80345`
- gold `#D79A27` and `#E9B848`

Headings use Cormorant Garamond, which echoes the script logo. Body text uses Manrope. The components are written in the shadcn/ui style, on Radix and Tailwind v4, and charts use Recharts. Light and dark mode follow the system setting, can be switched in the header, and are applied before the page draws, so there is no flash.

## Root-owned folders

On this machine `node_modules/.vite-temp` and `apps/web/node_modules/.nitro` became owned by root. That happens when the dev server is started with `sudo`. A plain `npm run dev` or `vite build` then fails with `EACCES`. Either fix the ownership:

```bash
sudo chown -R "$(whoami)" node_modules apps/web/node_modules
```

or work around it:

```bash
cd apps/web
VITE_CACHE_DIR=/tmp/roes-vite npx vite dev --port 3020 --configLoader runner
```

## Production

```bash
npm run build
node --env-file=apps/web/.env apps/web/.output/server/index.mjs
```

Before going live:

- Set `APP_URL` to the public address.
- Set a new `SESSION_SECRET`.
- Set `DEV_LOGIN=false`.
- Point `STORAGE_DIR` and `IMAGE_CACHE_DIR` at folders outside the release.
- Copy `apps/web/storage/` across with the release. It holds the product photos.
# roes
