import { useState } from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowLeft, CheckCircle2, Copy, PartyPopper, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import type { OrderStatus, PaymentStatus } from '@roes/db/types'
import { api, errorMessage } from '#/lib/api-client'
import { dateTime, money } from '#/lib/format'
import { displayPhone } from '#/lib/phone'
import { bootstrapQuery, sessionQuery } from '#/lib/queries'
import { pageSeo } from '#/lib/seo'
import { Button } from '#/components/ui/button'
import { Field, Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/misc'
import { Img } from '#/components/site/image'
import { OrderProgress, OrderStatusBadge, PaymentBadge } from '#/components/site/order-bits'
import { Container } from '#/components/site/section'

export const Route = createFileRoute('/_site/account/orders/$reference')({
  validateSearch: z.object({ placed: z.coerce.boolean().optional().catch(undefined), paid: z.coerce.boolean().optional().catch(undefined) }),
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery)
    if (!user) throw redirect({ to: '/login', search: { next: location.href } })
  },
  head: ({ params }) => pageSeo({ title: `Order ${params.reference}`, description: 'Order details', path: `/account/orders/${params.reference}`, noindex: true }),
  component: OrderPage,
})

interface Order {
  id: number
  reference: string
  customerName: string
  phone: string
  deliveryMethod: 'delivery' | 'pickup'
  region: string | null
  city: string | null
  address: string | null
  notes: string | null
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  couponCode: string | null
  paymentMethod: string
  paymentStatus: PaymentStatus
  momoTransactionId: string | null
  status: OrderStatus
  createdAt: string
  items: Array<{ id: number; name: string; variantLabel: string | null; imageUrl: string | null; unitPrice: number; quantity: number; lineTotal: number; slug: string | null }>
  events: Array<{ kind: string; note: string | null; createdAt: string }>
}

function Copyable({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value.replace(/\s/g, ''))
        toast.success(`${label} copied`)
      }}
      className="group inline-flex items-center gap-2 font-mono text-2xl font-bold tracking-wide"
    >
      {value}
      <Copy className="size-4 opacity-50 transition group-hover:opacity-100" />
    </button>
  )
}

function MomoPayment({ order }: { order: Order }) {
  const { data: boot } = useQuery(bootstrapQuery)
  const qc = useQueryClient()
  const [sender, setSender] = useState(displayPhone(order.phone))
  const [transactionId, setTransactionId] = useState('')
  const submit = useMutation({
    mutationFn: () => api.post<Order>(`/me/orders/${order.reference}/momo`, { sender, transactionId }),
    onSuccess: (o) => {
      qc.setQueryData(['me', 'order', order.reference], o)
      toast.success('Thank you! We’ll confirm your payment shortly and text you.')
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  if (!boot) return null
  if (order.paymentStatus === 'submitted') {
    return (
      <div className="rounded-3xl border-2 border-gold/40 bg-gold-soft/50 p-6">
        <p className="flex items-center gap-2 font-bold">
          <CheckCircle2 className="size-5 text-gold" /> Payment details received
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          We’re checking MoMo transaction <span className="font-mono font-semibold text-foreground">{order.momoTransactionId}</span>. You’ll get an SMS once it’s confirmed.
        </p>
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-3xl border-2 border-primary/30">
      <div className="bg-wine-gradient p-6 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold text-gold-light">
          <Smartphone className="size-4" /> Pay with Mobile Money
        </p>
        <p className="mt-1 text-sm text-white/80">{boot.payments.instructions}</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <div>
            <p className="text-xs text-white/60 uppercase">Send</p>
            <p className="font-mono text-2xl font-bold">{money(order.total)}</p>
          </div>
          <div>
            <p className="text-xs text-white/60 uppercase">To {boot.payments.momoNetwork}</p>
            <Copyable value={displayPhone(boot.payments.momoNumber)} label="Number" />
            <p className="text-xs text-white/70">{boot.payments.momoName}</p>
          </div>
          <div>
            <p className="text-xs text-white/60 uppercase">Reference</p>
            <Copyable value={order.reference} label="Reference" />
          </div>
        </div>
      </div>
      <form
        className="grid gap-4 bg-card p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          submit.mutate()
        }}
      >
        <Field label="Number you paid from">
          <Input value={sender} onChange={(e) => setSender(e.target.value)} required type="tel" />
        </Field>
        <Field label="MoMo transaction ID">
          <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} required placeholder="e.g. 51234567890" />
        </Field>
        <Button type="submit" loading={submit.isPending}>
          I’ve paid
        </Button>
      </form>
    </div>
  )
}

function OrderPage() {
  const { reference } = Route.useParams()
  const { placed, paid } = Route.useSearch()
  const { data: order } = useQuery({
    queryKey: ['me', 'order', reference],
    queryFn: () => api.get<Order>(`/me/orders/${reference}`),
    refetchInterval: (q) => (q.state.data?.paymentStatus === 'submitted' ? 20_000 : false),
  })
  if (!order) {
    return (
      <Container className="py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-8 h-64 rounded-3xl" />
      </Container>
    )
  }
  const needsMomo = order.paymentMethod === 'momo' && order.paymentStatus !== 'paid' && order.status !== 'cancelled'
  return (
    <Container className="py-10">
      <Link to="/account" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> My orders
      </Link>
      {(placed || paid) && (
        <div className="mt-6 flex items-center gap-4 rounded-3xl bg-success/10 p-6">
          <PartyPopper className="size-8 text-success" />
          <div>
            <p className="font-display text-2xl font-semibold">{paid ? 'Payment received!' : 'Thank you for your order!'}</p>
            <p className="text-sm text-muted-foreground">We’ve sent a confirmation SMS to {displayPhone(order.phone)}.</p>
          </div>
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Placed {dateTime(order.createdAt)}</p>
          <h1 className="font-display text-4xl font-semibold">
            Order <span className="font-mono">{order.reference}</span>
          </h1>
        </div>
        <div className="flex gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} />
        </div>
      </div>
      <div className="mt-8 rounded-3xl border bg-card p-6">
        <OrderProgress status={order.status} />
      </div>
      {needsMomo && (
        <div className="mt-6">
          <MomoPayment order={order} />
        </div>
      )}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section className="rounded-3xl border bg-card p-6">
          <h2 className="mb-4 text-lg font-bold">Items</h2>
          <ul className="divide-y">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center gap-4 py-4">
                <Img src={i.imageUrl} alt={i.name} sizes="64px" maxWidth={128} className="size-16 rounded-xl object-cover" />
                <div className="flex-1">
                  {i.slug ? (
                    <Link to="/p/$slug" params={{ slug: i.slug }} className="font-semibold hover:text-primary">
                      {i.name}
                    </Link>
                  ) : (
                    <p className="font-semibold">{i.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {i.variantLabel ? `${i.variantLabel} · ` : ''}
                    {i.quantity} × {money(i.unitPrice)}
                  </p>
                </div>
                <p className="font-semibold tabular-nums">{money(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid gap-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{money(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-success">
                <dt>Discount {order.couponCode && `(${order.couponCode})`}</dt>
                <dd>−{money(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery</dt>
              <dd>{order.deliveryMethod === 'pickup' ? 'Pickup' : money(order.deliveryFee)}</dd>
            </div>
            <div className="flex justify-between border-t pt-3 text-base font-bold">
              <dt>Total</dt>
              <dd>{money(order.total)}</dd>
            </div>
          </dl>
        </section>
        <aside className="grid h-fit gap-6">
          <div className="rounded-3xl border bg-card p-6 text-sm">
            <h2 className="mb-3 text-lg font-bold">{order.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery'}</h2>
            <p className="font-semibold">{order.customerName}</p>
            <p className="text-muted-foreground">{displayPhone(order.phone)}</p>
            {order.deliveryMethod === 'delivery' && (
              <p className="mt-2 text-muted-foreground">{[order.address, order.city, order.region].filter(Boolean).join(', ')}</p>
            )}
            {order.notes && <p className="mt-3 rounded-xl bg-muted p-3 text-xs">{order.notes}</p>}
          </div>
          <div className="rounded-3xl border bg-card p-6">
            <h2 className="mb-4 text-lg font-bold">Timeline</h2>
            <ol className="grid gap-4 border-l pl-5">
              {order.events.map((e, i) => (
                <li key={i} className="relative text-sm">
                  <span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-primary ring-4 ring-card" />
                  <p className="font-semibold">{e.note}</p>
                  <p className="text-xs text-muted-foreground">{dateTime(e.createdAt)}</p>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </Container>
  )
}
