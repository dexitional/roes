import sanitizeHtml from 'sanitize-html'

// Product descriptions, category copy, pages and journal posts are HTML from
// the CMS editor. Everything passes through this allowlist on save.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'span', 'sub', 'sup',
    'blockquote', 'ul', 'ol', 'li', 'a', 'hr', 'code', 'pre', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col', 'div', 'iframe',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    th: ['colspan', 'rowspan', 'colwidth'],
    td: ['colspan', 'rowspan', 'colwidth'],
    col: ['style'],
    mark: ['data-color', 'style'],
    iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder', 'allow'],
    div: ['data-youtube-video'],
    '*': ['style'],
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
      color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,.%]+\)$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,.%]+\)$/i],
      width: [/^\d+(px|%)$/],
      'min-width': [/^\d+px$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href ?? ''
      const external = /^https?:\/\//i.test(href)
      const out: sanitizeHtml.Attributes = external ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href }
      return { tagName, attribs: out }
    },
  },
}

export function cleanHtml(html: string | null | undefined): string | null {
  if (!html) return null
  const clean = sanitizeHtml(html, OPTIONS).trim()
  return clean === '' || clean === '<p></p>' ? null : clean
}

export const plainText = (html: string | null | undefined) =>
  sanitizeHtml(html ?? '', { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim()
