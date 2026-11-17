// GET /img?src=</files/... | /public path>&w=640&q=75
// Resizes a stored photo (or a public/ image) to one of IMAGE_WIDTHS, re-encodes
// it as AVIF or WebP (whichever the browser accepts) and caches the result in
// memory, on disk, and in browsers/CDNs for a year.
//
// Server-only: mounted as a Nitro handler (img-handler.ts), so sharp never
// reaches the browser bundle.
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { DEFAULT_QUALITY, IMAGE_QUALITIES, IMAGE_WIDTHS } from '#/lib/image'
import { localKeyFromUrl, readLocalObject, statLocalObject } from './api/lib/local-storage'

type Format = 'avif' | 'webp' | 'jpeg' | 'png'
const CONTENT_TYPES: Record<Format, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

const CACHE_DIR = process.env.IMAGE_CACHE_DIR || path.join(process.cwd(), '.cache', 'images')
const IMMUTABLE = 'public, max-age=31536000, immutable'
const WEEK = 'public, max-age=604800, stale-while-revalidate=86400'

// ---- Caches ------------------------------------------------------------------------------

interface Variant {
  body: Buffer
  format: Format
}
const MEMORY_LIMIT_BYTES = 96 * 1024 * 1024
const memory = new Map<string, Variant>()
let memoryBytes = 0

function remember(key: string, variant: Variant) {
  if (variant.body.length > MEMORY_LIMIT_BYTES / 8) return
  if (memory.has(key)) return
  memory.set(key, variant)
  memoryBytes += variant.body.length
  for (const [oldKey, old] of memory) {
    if (memoryBytes <= MEMORY_LIMIT_BYTES) break
    memory.delete(oldKey)
    memoryBytes -= old.body.length
  }
}

function recall(key: string): Variant | undefined {
  const hit = memory.get(key)
  if (hit) {
    memory.delete(key)
    memory.set(key, hit)
  }
  return hit
}

const diskPath = (key: string, format: Format) => path.join(CACHE_DIR, key.slice(0, 2), `${key}.${format}`)

async function readDisk(key: string, format: Format): Promise<Variant | undefined> {
  try {
    return { body: await readFile(diskPath(key, format)), format }
  } catch {
    return undefined
  }
}

async function writeDisk(key: string, variant: Variant) {
  const file = diskPath(key, variant.format)
  try {
    await mkdir(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tmp, variant.body)
    await rename(tmp, file)
  } catch (err) {
    console.warn("[img] couldn't write cache:", err)
  }
}

// Encoding is CPU-heavy: cap concurrent jobs, and let identical requests share one.
function createLimiter(max: number) {
  let running = 0
  const waiting: Array<() => void> = []
  return async function limit<T>(job: () => Promise<T>): Promise<T> {
    if (running >= max) await new Promise<void>((resolve) => waiting.push(resolve))
    running++
    try {
      return await job()
    } finally {
      running--
      waiting.shift()?.()
    }
  }
}
const transformSlot = createLimiter(Math.max(1, Number(process.env.IMAGE_CONCURRENCY) || 3))
const inFlight = new Map<string, Promise<Variant>>()

async function transform(source: Buffer, width: number, quality: number, format: Format): Promise<Buffer> {
  const image = sharp(source, { failOn: 'none', limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width, withoutEnlargement: true })
  switch (format) {
    case 'avif':
      return image.avif({ quality: Math.max(35, quality - 20), effort: 4 }).toBuffer()
    case 'webp':
      return image.webp({ quality, effort: 4 }).toBuffer()
    case 'png':
      return image.png({ compressionLevel: 9, palette: true, quality }).toBuffer()
    default:
      return image.jpeg({ quality, mozjpeg: true, progressive: true }).toBuffer()
  }
}

function pickFormat(accept: string, sourcePath: string): Format {
  if (accept.includes('image/avif')) return 'avif'
  if (accept.includes('image/webp')) return 'webp'
  return /\.png(\?|$)/i.test(sourcePath) ? 'png' : 'jpeg'
}

async function publicFile(pathname: string): Promise<Buffer | null> {
  const clean = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  for (const dir of [path.join(process.cwd(), '.output', 'public'), path.join(process.cwd(), 'public')]) {
    const full = path.join(dir, clean)
    if (!full.startsWith(dir)) continue
    try {
      return await readFile(full)
    } catch {
      // try the next folder
    }
  }
  return null
}

export async function handleImageRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const src = url.searchParams.get('src') ?? ''
  const width = Number(url.searchParams.get('w'))
  const quality = Number(url.searchParams.get('q') ?? DEFAULT_QUALITY)
  if (!(IMAGE_WIDTHS as ReadonlyArray<number>).includes(width)) {
    return new Response(`w must be one of ${IMAGE_WIDTHS.join(', ')}`, { status: 400 })
  }
  if (!(IMAGE_QUALITIES as ReadonlyArray<number>).includes(quality)) {
    return new Response(`q must be one of ${IMAGE_QUALITIES.join(', ')}`, { status: 400 })
  }
  // Only our own files: never an arbitrary URL (that would be an open proxy).
  if (!src.startsWith('/') || src.startsWith('//') || src.startsWith('/img')) {
    return new Response('Invalid src', { status: 400 })
  }
  const pathname = src.split(/[?#]/)[0] ?? ''
  const storedKey = localKeyFromUrl(pathname)
  if (storedKey && !(await statLocalObject(storedKey))) {
    return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
  }

  const format = pickFormat(request.headers.get('accept') ?? '', pathname)
  const key = createHash('sha256').update(`${pathname}|${width}|${quality}|${format}`).digest('hex')
  const etag = `"${key.slice(0, 32)}"`
  const cacheControl = storedKey ? IMMUTABLE : process.env.NODE_ENV === 'production' ? WEEK : 'no-store'
  const headers = (cache: string, length?: number) => ({
    'content-type': CONTENT_TYPES[format],
    'cache-control': cacheControl,
    vary: 'Accept',
    etag,
    'x-image-cache': cache,
    ...(length !== undefined ? { 'content-length': String(length) } : {}),
  })

  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: headers('REVALIDATED') })
  }
  const cached = recall(key) ?? (await readDisk(key, format))
  if (cached) {
    remember(key, cached)
    return new Response(new Uint8Array(cached.body), { headers: headers('HIT', cached.body.length) })
  }

  let job = inFlight.get(key)
  if (!job) {
    job = (async () => {
      const original = storedKey ? (await readLocalObject(storedKey)).body : await publicFile(pathname)
      if (!original) throw new Error('source not found')
      const body = await transformSlot(() => transform(original, width, quality, format))
      const variant = { body, format }
      remember(key, variant)
      await writeDisk(key, variant)
      return variant
    })().finally(() => inFlight.delete(key))
    inFlight.set(key, job)
  }
  try {
    const result = await job
    return new Response(new Uint8Array(result.body), { headers: headers('MISS', result.body.length) })
  } catch (err) {
    console.warn(`[img] ${pathname} (w=${width}):`, err instanceof Error ? err.message : err)
    // Never break an image: fall back to the original file.
    return new Response(null, { status: 302, headers: { location: pathname, 'cache-control': 'no-store' } })
  }
}
