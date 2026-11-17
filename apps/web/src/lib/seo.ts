// Page tags for search engines and link previews: titles, descriptions,
// canonical URLs, Open Graph/Twitter cards and schema.org JSON-LD. Client-safe:
// route heads also run in the browser while navigating.
const CONFIGURED = typeof __SITE_URL__ === 'undefined' ? '' : __SITE_URL__
const isLocal = /\/\/(localhost|127\.0\.0\.1)\b/.test(CONFIGURED)
export const SITE_URL =
  CONFIGURED && !(isLocal && (import.meta.env as Partial<ImportMetaEnv> | undefined)?.PROD) ? CONFIGURED : 'https://www.roesoutlet.com'
export const SITE_NAME = 'Roes Outlet'

export const absoluteUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`)

/** Plain text of about `max` characters, cut at a word. */
export function clip(text: string | null | undefined, max = 158) {
  const plain = String(text ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= max) return plain
  const cut = plain.slice(0, max - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).replace(/[\s,;:.-]+$/, '')}…`
}

type JsonLd = Record<string, unknown>

/** A share image: optimised 1200px variant for stored photos. */
export const shareImage = (src: string | null | undefined) =>
  src ? (src.startsWith('/files/') ? `/img?src=${encodeURIComponent(src)}&w=1280&q=85` : src) : '/og.jpg'

export function pageSeo({
  title,
  description,
  path,
  image,
  imageAlt,
  type = 'website',
  noindex = false,
  jsonLd = [],
  extraMeta = [],
}: {
  title: string
  description: string
  path: string
  image?: string | null
  imageAlt?: string
  type?: 'website' | 'article' | 'product'
  noindex?: boolean
  jsonLd?: Array<JsonLd>
  extraMeta?: Array<Record<string, string>>
}) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`
  const url = absoluteUrl(path)
  const picture = absoluteUrl(shareImage(image))
  const summary = clip(description)
  return {
    meta: [
      { title: fullTitle },
      { name: 'description', content: summary },
      ...(noindex ? [{ name: 'robots', content: 'noindex, follow' }] : [{ name: 'robots', content: 'index, follow, max-image-preview:large' }]),
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:type', content: type === 'product' ? 'product' : type },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: summary },
      { property: 'og:url', content: url },
      { property: 'og:image', content: picture },
      { property: 'og:image:alt', content: imageAlt ?? title },
      { property: 'og:locale', content: 'en_GH' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: '@roes_outlet' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: summary },
      { name: 'twitter:image', content: picture },
      ...extraMeta,
    ],
    links: noindex ? [] : [{ rel: 'canonical', href: url }],
    // "<" is escaped so text in the data can't close the script tag.
    scripts: jsonLd.map((data) => ({ type: 'application/ld+json', children: JSON.stringify(data).replace(/</g, '\\u003c') })),
  }
}

export const ORGANIZATION: JsonLd = {
  '@context': 'https://schema.org',
  '@type': 'JewelryStore',
  name: SITE_NAME,
  url: SITE_URL,
  logo: absoluteUrl('/logo.png'),
  image: absoluteUrl('/og.jpg'),
  slogan: 'Luxury on budget',
  email: 'roesoutlet@gmail.com',
  telephone: '+233541128719',
  priceRange: 'GH₵45 – GH₵550',
  currenciesAccepted: 'GHS',
  paymentAccepted: 'Mobile Money',
  address: { '@type': 'PostalAddress', addressLocality: 'Cape Coast', addressRegion: 'Central', addressCountry: 'GH' },
  geo: { '@type': 'GeoCoordinates', latitude: 5.133355697952953, longitude: -1.283975621717872 },
  sameAs: ['https://instagram.com/roes_outlet', 'https://tiktok.com/@roes_outlet', 'https://twitter.com/roes_outlet'],
}

export const websiteJsonLd = (): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}/shop?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
})

export const breadcrumbJsonLd = (items: Array<[name: string, path: string]>): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: absoluteUrl(path) })),
})

export function productJsonLd(p: {
  name: string
  slug: string
  sku: string | null
  description: string
  images: Array<string>
  price: number
  compareAtPrice: number | null
  stock: number
  category: string | null
  material: string | null
  ratingAvg: number
  ratingCount: number
}): JsonLd {
  const url = absoluteUrl(`/p/${p.slug}`)
  const validUntil = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString().slice(0, 10)
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    url,
    sku: p.sku ?? undefined,
    mpn: p.sku ?? undefined,
    description: clip(p.description, 500),
    image: p.images.slice(0, 6).map((i) => absoluteUrl(shareImage(i))),
    brand: { '@type': 'Brand', name: SITE_NAME },
    category: p.category ?? undefined,
    material: p.material ?? undefined,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'GHS',
      price: p.price.toFixed(2),
      priceValidUntil: validUntil,
      availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SITE_NAME },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'GH' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
        },
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'GH',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 3,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
      },
    },
    ...(p.ratingCount
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.ratingAvg.toFixed(1), reviewCount: p.ratingCount, bestRating: 5 } }
      : {}),
  }
}
