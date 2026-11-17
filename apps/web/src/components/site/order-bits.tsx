import { CheckCircle2, Circle, Clock, Package, Truck, XCircle } from 'lucide-react'
import { cn } from '@roes/ui'
import type { OrderStatus, PaymentStatus } from '@roes/db/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONE } from '#/lib/labels'
import { Badge } from '#/components/ui/misc'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status]} dot>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  )
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_STATUS_TONE[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>
}

const STEPS: Array<{ status: OrderStatus; label: string; icon: typeof Circle }> = [
  { status: 'pending', label: 'Placed', icon: Clock },
  { status: 'confirmed', label: 'Paid & confirmed', icon: CheckCircle2 },
  { status: 'processing', label: 'Preparing', icon: Package },
  { status: 'shipped', label: 'On its way', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: CheckCircle2 },
]

export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-destructive/10 p-4 text-sm font-semibold text-destructive">
        <XCircle className="size-5" /> This order was cancelled.
      </div>
    )
  }
  const at = STEPS.findIndex((s) => s.status === status)
  return (
    <ol className="grid grid-cols-5 gap-1">
      {STEPS.map((s, i) => {
        const done = i <= at
        const Icon = s.icon
        return (
          <li key={s.status} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={cn('absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2', i <= at ? 'bg-primary' : 'bg-border')} />}
            <span className={cn('relative z-10 grid size-8 place-items-center rounded-full border-2 bg-card transition', done ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              <Icon className="size-4" />
            </span>
            <span className={cn('mt-2 text-[0.68rem] font-semibold sm:text-xs', done ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
