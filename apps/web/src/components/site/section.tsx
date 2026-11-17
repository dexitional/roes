import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { cn } from '@roes/ui'

export function Container({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10', className)} {...props} />
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  link,
  className,
  align = 'left',
}: {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  link?: { to: string; label: string; search?: Record<string, unknown> }
  className?: string
  align?: 'left' | 'center'
}) {
  return (
    <div className={cn('mb-8 flex flex-wrap items-end justify-between gap-4', align === 'center' && 'flex-col items-center text-center', className)}>
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="font-display text-[2rem] leading-[1.05] font-semibold sm:text-[2.6rem]">{title}</h2>
        {description && <p className="mt-2.5 text-[0.95rem] text-muted-foreground">{description}</p>}
      </div>
      {link && (
        <Link
          to={link.to}
          search={link.search as never}
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
        >
          {link.label}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  )
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; to?: string; params?: Record<string, string> }> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-border">/</span>}
            {item.to ? (
              <Link to={item.to} params={item.params as never} className="hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
