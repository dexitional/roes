import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { cn } from '@roes/ui'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Card, Skeleton } from '#/components/ui/misc'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/overlay'

export function PageHeader({ title, description, actions, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Delta({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (!previous && !current) return <span className="text-xs text-muted-foreground">—</span>
  const pct = previous ? ((current - previous) / previous) * 100 : 100
  const up = pct >= 0
  const good = invert ? !up : up
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.68rem] font-bold', good ? 'bg-success/12 text-success' : 'bg-destructive/10 text-destructive')}>
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(pct).toFixed(pct > -10 && pct < 10 ? 1 : 0)}%
    </span>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  current,
  previous,
  spark,
  sparkKey,
  hint,
  tone = 'primary',
}: {
  label: string
  value: React.ReactNode
  icon?: typeof Search
  current?: number
  previous?: number
  spark?: Array<Record<string, number | string>>
  sparkKey?: string
  hint?: React.ReactNode
  tone?: 'primary' | 'gold' | 'success' | 'info'
}) {
  const colors = { primary: 'var(--chart-1)', gold: 'var(--chart-2)', success: 'var(--chart-5)', info: 'var(--chart-4)' }
  const id = `spark-${label.replace(/\W/g, '')}`
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        {Icon && (
          <span className="grid size-8 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${colors[tone]} 14%, transparent)`, color: colors[tone] }}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {current !== undefined && previous !== undefined && <Delta current={current} previous={previous} />}
        {hint}
      </div>
      {spark && sparkKey && (
        <div className="pointer-events-none -mx-5 -mb-5 mt-3 h-11 opacity-80">
          <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={spark} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[tone]} stopOpacity={0.25} />
                <stop offset="100%" stopColor={colors[tone]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey={sparkKey} stroke={colors[tone]} strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive={false} />
          </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

export function StatSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-32 rounded-2xl" />
      ))}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  useEffect(() => {
    const t = setTimeout(() => v !== value && onChange(v), 300)
    return () => clearTimeout(t)
  }, [v]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  )
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
      <span>
        {total ? `${(page - 1) * pageSize + 1}–${Math.min(total, page * pageSize)} of ${total.toLocaleString()}` : 'No results'}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="px-2 tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="ghost" size="icon-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...props} />
    </div>
  )
}
export function Th({ className, ...props }: React.ComponentProps<'th'>) {
  return <th className={cn('border-b bg-muted/40 px-4 py-2.5 text-left text-[0.7rem] font-bold tracking-wide whitespace-nowrap text-muted-foreground uppercase', className)} {...props} />
}
export function Td({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('border-b px-4 py-3 align-middle', className)} {...props} />
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="grid gap-0">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b px-4 py-3.5">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-1/3' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: typeof Search; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent text-primary">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  loading,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  children?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function Section({ title, description, children, actions, className }: { title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <Card className={cn('p-5 sm:p-6', className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </Card>
  )
}
