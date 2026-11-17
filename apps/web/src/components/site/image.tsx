import { preload } from 'react-dom'
import { useState } from 'react'
import type { ImgHTMLAttributes } from 'react'
import { cn } from '@roes/ui'
import { DEFAULT_QUALITY, optimizedSrcSet, optimizedUrl } from '#/lib/image'
import type { ImageQuality } from '#/lib/image'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  src: string | null | undefined
  /** How wide it renders, as a `sizes` value. The browser picks the smallest sharp variant. */
  sizes?: string
  quality?: ImageQuality
  maxWidth?: number
  /** Above the fold: load eagerly at high priority and preload from <head>. */
  priority?: boolean
  /** Fade in once decoded (with a shimmer underneath while loading). */
  fade?: boolean
}

// <img> served through the /img optimiser: resized per device, AVIF/WebP, cached for a year.
export function Img({ src, sizes = '100vw', quality = DEFAULT_QUALITY, maxWidth = 1920, priority = false, fade = true, className, alt = '', ...rest }: Props) {
  const [loaded, setLoaded] = useState(false)
  if (!src) return <div className={cn('skeleton', className)} aria-hidden="true" />
  const srcSet = optimizedSrcSet(src, quality, maxWidth)
  const fallback = srcSet ? optimizedUrl(src, Math.min(maxWidth, 1024), quality) : src
  if (priority) {
    preload(fallback, { as: 'image', imageSrcSet: srcSet, imageSizes: srcSet ? sizes : undefined, fetchPriority: 'high' })
  }
  return (
    <img
      src={fallback}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : undefined}
      onLoad={() => setLoaded(true)}
      ref={(el) => {
        // Cached images can finish before React attaches onLoad.
        if (el?.complete && el.naturalWidth) setLoaded(true)
      }}
      className={cn(fade && !priority && 'transition-opacity duration-500', fade && !priority && !loaded && 'opacity-0', className)}
      {...rest}
    />
  )
}
