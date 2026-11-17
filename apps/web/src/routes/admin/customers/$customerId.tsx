import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Mail, Phone } from 'lucide-react'
import { toast } from 'sonner'
import type { OrderStatus, PaymentStatus } from '@roes/db/types'
import { api } from '#/lib/api-client'
import { date, money } from '#/lib/format'
import { displayPhone } from '#/lib/phone'
import { Avatar, Skeleton, Switch } from '#/components/ui/misc'
import { Section, StatCard } from '#/components/admin/kit'
import { Img } from '#/components/site/image'
import { OrderStatusBadge, PaymentBadge } from '#/components/site/order-bits'

export const Route = createFileRoute('/admin/customers/$customerId')({ component: Customer })

interface Detail {
  id: number
  fullName: string
  email: string
  phone: string | null
  avatarUrl: string | null
  createdAt: string
  lastLoginAt: string | null
  isActive: number
  orders: Array<{ reference: string; total: number; status: OrderStatus; paymentStatus: PaymentStatus; createdAt: string }>
  wishlist: Array<{ id: number; name: string; slug: string; image: string | null }>
  viewed: Array<{ id: number; name: string; views: number }>
}

function Customer() {
  const { customerId } = Route.useParams()
  const qc = useQueryClient()
  const { data: c } = useQuery({ queryKey: ['admin', 'customer', customerId], queryFn: () => api.get<Detail>(`/admin/customers/${customerId}`) })
  const toggle = useMutation({
    mutationFn: (isActive: boolean) => api.patch(`/admin/customers/${customerId}`, { isActive }),
    onSuccess: () => {
      toast.success('Account updated')
      void qc.invalidateQueries({ queryKey: ['admin', 'customer', customerId] })
    },
  })
  if (!c) return <Skeleton className="h-[60vh] rounded-2xl" />
  const paid = c.orders.filter((o) => o.paymentStatus === 'paid')
  const spent = paid.reduce((s, o) => s + Number(o.total), 0)
  return (
    <>
      <Link to="/admin/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Customers
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar src={c.avatarUrl} name={c.fullName} className="size-16" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{c.fullName}</h1>
          <p className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <a href={`mailto:${c.email}`} className="flex items-center gap-1">
              <Mail className="size-3.5" /> {c.email}
            </a>
            {c.phone && (
              <a href={`tel:+${c.phone}`} className="flex items-center gap-1">
                <Phone className="size-3.5" /> {displayPhone(c.phone)}
              </a>
            )}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          Active <Switch checked={Boolean(c.isActive)} onCheckedChange={(v) => toggle.mutate(v)} />
        </label>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Lifetime spend" value={money(spent, true)} />
        <StatCard label="Orders" value={c.orders.length} hint={`${paid.length} paid`} tone="gold" />
        <StatCard label="Average order" value={money(paid.length ? spent / paid.length : 0, true)} tone="info" />
        <StatCard label="Customer since" value={date(c.createdAt, { month: 'short', year: 'numeric' })} tone="success" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Section title="Orders">
          {c.orders.length ? (
            <ul className="divide-y">
              {c.orders.map((o) => (
                <li key={o.reference}>
                  <Link to="/admin/orders/$reference" params={{ reference: o.reference }} className="flex items-center gap-3 py-3 hover:text-primary">
                    <span className="font-mono font-semibold">{o.reference}</span>
                    <span className="text-xs text-muted-foreground">{date(o.createdAt)}</span>
                    <span className="ml-auto flex gap-1.5">
                      <OrderStatusBadge status={o.status} />
                      <PaymentBadge status={o.paymentStatus} />
                    </span>
                    <span className="w-24 text-right font-semibold">{money(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          )}
        </Section>
        <div className="grid content-start gap-6">
          <Section title="Wishlist">
            {c.wishlist.length ? (
              <div className="grid grid-cols-4 gap-2">
                {c.wishlist.map((p) => (
                  <a key={p.id} href={`/p/${p.slug}`} target="_blank" title={p.name}>
                    <Img src={p.image} alt={p.name} sizes="80px" maxWidth={128} className="aspect-square rounded-lg object-cover" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Empty.</p>
            )}
          </Section>
          <Section title="Most viewed">
            {c.viewed.length ? (
              <ul className="grid gap-1.5 text-sm">
                {c.viewed.map((v) => (
                  <li key={v.id} className="flex justify-between gap-2">
                    <span className="truncate">{v.name}</span>
                    <span className="text-muted-foreground">{Number(v.views)}×</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No signed-in browsing yet.</p>
            )}
          </Section>
        </div>
      </div>
    </>
  )
}
