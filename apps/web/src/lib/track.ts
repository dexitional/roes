// Fire-and-forget storefront analytics (POST /api/store/track). The server
// keeps an anonymous visitor cookie, skips bots and de-duplicates views.
type Event = 'view' | 'add_to_cart' | 'wishlist' | 'checkout'

function landingSource(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const saved = sessionStorage.getItem('roes-src')
    if (saved) return saved
    const params = new URLSearchParams(location.search)
    const ref = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : ''
    const source = params.get('utm_source') || params.get('ref') || ref || 'direct'
    sessionStorage.setItem('roes-src', source)
    return source
  } catch {
    return undefined
  }
}

export function track(productId: number, event: Event, opts: { quantity?: number; source?: string } = {}) {
  if (typeof window === 'undefined') return
  const body = JSON.stringify({ productId, event, quantity: opts.quantity, source: opts.source ?? landingSource() })
  try {
    void fetch('/api/store/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, credentials: 'include' }).catch(
      () => undefined,
    )
  } catch {
    // Never let analytics break the page.
  }
}
