// Responsive, optimised images. Client-safe: builds URLs for the /img
// optimiser (server/image-optimizer.ts), which resizes stored photos and
// public/ images, re-encodes them as AVIF/WebP and caches every variant.

// The only widths the optimiser renders, so the cache stays bounded and
// browsers/CDNs share variants. Requests snap up to the next one.
export const IMAGE_WIDTHS = [64, 96, 128, 192, 256, 384, 512, 640, 768, 1024, 1280, 1600, 1920] as const
export const IMAGE_QUALITIES = [50, 60, 75, 85] as const
export const DEFAULT_QUALITY = 75
export type ImageQuality = (typeof IMAGE_QUALITIES)[number]

const CDN = typeof __CDN_URL__ === 'undefined' ? '' : __CDN_URL__

/** Serves /files and /img from the CDN when CDN_URL is set. */
export function cdn(path: string) {
  return CDN && /^\/(files\/|img\b)/.test(path) ? `${CDN}${path}` : path
}

/** Local files go through /img. Remote, SVG and GIF images load as they are. */
export function canOptimize(src: string | null | undefined): src is string {
  if (!src) return false
  if (/\.(svg|gif)(\?|#|$)/i.test(src)) return false
  return /^\/(?!\/)/.test(src)
}

export const snapWidth = (width: number) => IMAGE_WIDTHS.find((w) => w >= width) ?? 1920

export function optimizedUrl(src: string, width: number, quality: ImageQuality = DEFAULT_QUALITY) {
  if (!canOptimize(src)) return cdn(src)
  return `${cdn('/img')}?src=${encodeURIComponent(src)}&w=${snapWidth(width)}&q=${quality}`
}

export function optimizedSrcSet(src: string, quality: ImageQuality = DEFAULT_QUALITY, maxWidth = 1920) {
  if (!canOptimize(src)) return undefined
  return IMAGE_WIDTHS.filter((w) => w <= maxWidth)
    .map((w) => `${optimizedUrl(src, w, quality)} ${w}w`)
    .join(', ')
}

// CMS rich text (already sanitised server-side): add srcset and lazy loading to images.
export function optimizeHtmlImages(html: string): string {
  return html.replace(/<img\s([^>]*?)\/?>/gi, (tag: string, attrs: string) => {
    const match = /\ssrc="([^"]+)"/.exec(` ${attrs}`)
    if (!match?.[1] || /\ssrcset=/i.test(` ${attrs}`)) return tag
    const src = match[1].replace(/&amp;/g, '&')
    const extra = [
      'loading="lazy"',
      'decoding="async"',
      canOptimize(src)
        ? `srcset="${optimizedSrcSet(src, DEFAULT_QUALITY, 1280)!.replace(/&/g, '&amp;')}" sizes="(min-width: 768px) 720px, 100vw"`
        : '',
    ]
      .filter(Boolean)
      .join(' ')
    return `<img ${attrs.trim()} ${extra} />`
  })
}
