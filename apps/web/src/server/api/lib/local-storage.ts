// Local file storage: uploads and imported photos live on this server's disk
// under STORAGE_DIR and are served from /files/<key> (server/file-server.ts)
// with CDN-style caching. Keys are unique and never reused, so every URL can be
// cached forever, and the database only ever stores relative /files/... URLs,
// which keeps the storage folder portable between machines.
//
// Plain Node only (no Vite or Hono imports): the file server, the image
// optimiser and the API share it.
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const FILES_ROUTE = '/files'

export function storageRoot() {
  return path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'))
}

// Every segment starts with a letter or digit, so "." and ".." can't appear.
const KEY_RE = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/i

/** Absolute path for a key, or null when the key isn't one we'd ever write. */
export function filePathFor(key: string): string | null {
  if (key.length > 500 || !KEY_RE.test(key)) return null
  const root = storageRoot()
  const file = path.resolve(root, key)
  return file.startsWith(root + path.sep) ? file : null
}

export const localPublicUrl = (key: string) => `${FILES_ROUTE}/${key}`

/** The key behind a /files URL (relative, or absolute on APP_URL / CDN_URL). */
export function localKeyFromUrl(url: string): string | null {
  let pathname = url
  if (!url.startsWith('/') || url.startsWith('//')) {
    const bases = [process.env.APP_URL, process.env.CDN_URL]
      .map((b) => (b ?? '').trim().replace(/\/+$/, ''))
      .filter(Boolean)
    const base = bases.find((b) => url.startsWith(`${b}${FILES_ROUTE}/`))
    if (!base) return null
    pathname = url.slice(base.length)
  }
  pathname = pathname.split(/[?#]/)[0] ?? ''
  if (!pathname.startsWith(`${FILES_ROUTE}/`)) return null
  let key: string
  try {
    key = decodeURIComponent(pathname.slice(FILES_ROUTE.length + 1))
  } catch {
    return null
  }
  return filePathFor(key) ? key : null
}

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
}

export function contentTypeFor(key: string) {
  return MIME[path.extname(key).slice(1).toLowerCase()] ?? 'application/octet-stream'
}

/** A fresh, unique key: <folder>/<yyyy>/<mm>/<random>-<name>.<ext> */
export function newKey(folder: string, filename: string, ext: string) {
  const now = new Date()
  const base =
    filename
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'file'
  return `${folder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${randomBytes(4).toString('hex')}-${base}.${ext}`
}

export async function writeLocalObject(key: string, body: Buffer) {
  const file = filePathFor(key)
  if (!file) throw new Error('Invalid file key.')
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.part`
  await writeFile(tmp, body, { flag: 'wx' })
  await rename(tmp, file)
}

export async function readLocalObject(key: string) {
  const file = filePathFor(key)
  if (!file) throw new Error('Invalid file key.')
  const body = await readFile(file)
  return { body, contentType: contentTypeFor(key), size: body.length }
}

export async function statLocalObject(key: string) {
  const file = filePathFor(key)
  if (!file) return null
  try {
    const info = await stat(file)
    return info.isFile() ? { file, info } : null
  } catch {
    return null
  }
}

export async function deleteLocalObject(key: string) {
  const file = filePathFor(key)
  if (!file) return
  await unlink(file).catch((err: NodeJS.ErrnoException) => {
    if (err.code !== 'ENOENT') throw err
  })
}
