// A small in-process cache for public catalogue reads (home page, product
// lists, product pages, navigation). Every admin write calls bustCache(), which
// bumps a version so all entries go stale at once: shoppers never see stale
// prices for more than an instant after an edit, and repeat page views skip
// the database entirely.
let version = 0
const store = new Map<string, { at: number; version: number; value: unknown }>()
const pending = new Map<string, Promise<unknown>>()
const MAX_ENTRIES = 2000

export function bustCache() {
  version++
  store.clear()
}

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.version === version && Date.now() - hit.at < ttlSeconds * 1000) return hit.value as T
  const running = pending.get(key)
  if (running) return running as Promise<T>
  const started = version
  const job = load()
    .then((value) => {
      if (started === version) {
        if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value!)
        store.set(key, { at: Date.now(), version, value })
      }
      return value
    })
    .finally(() => pending.delete(key))
  pending.set(key, job)
  return job
}

/** Cache-Control for anonymous catalogue responses (browsers and any CDN in front). */
export const PUBLIC_CACHE = 'public, max-age=30, stale-while-revalidate=300'
