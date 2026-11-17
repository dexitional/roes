import { cn } from '@roes/ui'
import { Img } from './image'

// The Roes Outlet logo (files/logo.jpg), unchanged apart from a transparent
// background: public/logo.png, served through the /img optimiser as AVIF/WebP
// with transparency. Its burgundy and black lettering needs a light surface,
// so on dark backgrounds it sits on a small ivory badge.
const RATIO = 1162 / 789

export function Logo({
  className,
  height = 52,
  plain = false,
  priority = false,
}: {
  className?: string
  /** Rendered height in px. */
  height?: number
  /** Skip the ivory badge in dark mode (when it already sits on a light surface). */
  plain?: boolean
  priority?: boolean
}) {
  const width = Math.round(height * RATIO)
  return (
    <span className={cn('inline-flex shrink-0 items-center', !plain && 'dark:rounded-xl dark:bg-[#fbf8f4] dark:px-1.5 dark:py-0.5', className)}>
      <Img
        src="/logo.png"
        alt="Roes Outlet: Luxury on budget"
        width={width}
        height={height}
        sizes={`${width}px`}
        maxWidth={768}
        quality={85}
        priority={priority}
        fade={false}
        style={{ height, width }}
        className="block object-contain"
      />
    </span>
  )
}
