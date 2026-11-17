// Admin uploads (product photos, banners, editor images). Every image is
// turned upright, stripped of metadata (GPS etc.) and stored as WebP, sized to
// at most 2000px, in local storage; the /img optimiser serves smaller AVIF/WebP
// variants from that copy.
import sharp from 'sharp'
import { AppError } from './errors'
import { insert } from './db'
import { localPublicUrl, newKey, writeLocalObject } from './local-storage'

const MAX_BYTES = 15 * 1024 * 1024
const ACCEPTED = /^image\/(jpeg|png|webp|avif|gif|heic|heif)$/

export interface StoredImage {
  id: number
  url: string
  filename: string
  width: number
  height: number
  size: number
}

export async function storeImage(file: File, opts: { folder?: string; alt?: string | null; userId?: number } = {}): Promise<StoredImage> {
  if (!ACCEPTED.test(file.type)) throw new AppError('Upload a JPG, PNG, WebP, AVIF or GIF image.', 415)
  if (file.size > MAX_BYTES) throw new AppError('Images must be 15 MB or smaller.', 413)
  const source = Buffer.from(await file.arrayBuffer())
  let encoded: { data: Buffer; info: sharp.OutputInfo }
  try {
    encoded = await sharp(source, { failOn: 'none', animated: file.type === 'image/gif' })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 5, smartSubsample: true })
      .toBuffer({ resolveWithObject: true })
  } catch {
    throw new AppError("That image couldn't be read. Try another file.", 422)
  }
  const key = newKey(opts.folder ?? 'uploads', file.name, 'webp')
  await writeLocalObject(key, encoded.data)
  const url = localPublicUrl(key)
  const filename = `${file.name.replace(/\.[^.]+$/, '').slice(0, 150)}.webp`
  const id = await insert('media', {
    url,
    filename,
    mime: 'image/webp',
    size: encoded.data.length,
    width: encoded.info.width,
    height: encoded.info.height,
    alt: opts.alt ?? null,
    uploadedBy: opts.userId ?? null,
  })
  return { id, url, filename, width: encoded.info.width, height: encoded.info.height, size: encoded.data.length }
}
