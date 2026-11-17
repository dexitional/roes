import { Star } from 'lucide-react'
import { cn } from '@roes/ui'
import { discountPercent, money } from '#/lib/format'

export function Price({ price, compareAt, className, size = 'md' }: { price: number; compareAt?: number | null; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const off = discountPercent(price, compareAt)
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span className={cn('font-bold tabular-nums', size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-sm' : 'text-[0.95rem]', off && 'text-crimson')}>
        {money(price)}
      </span>
      {off > 0 && (
        <>
          <span className={cn('text-muted-foreground line-through tabular-nums', size === 'lg' ? 'text-lg' : 'text-xs')}>{money(compareAt)}</span>
          {size === 'lg' && <span className="rounded-full bg-crimson/10 px-2 py-0.5 text-xs font-bold text-crimson">Save {off}%</span>}
        </>
      )}
    </div>
  )
}

export function Stars({ value, count, className, size = 14 }: { value: number; count?: number; className?: string; size?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} style={{ width: size, height: size }} className={cn(i <= Math.round(value) ? 'fill-gold text-gold' : 'fill-muted text-muted')} />
        ))}
      </span>
      {count !== undefined && <span className="text-xs text-muted-foreground">({count})</span>}
    </span>
  )
}
