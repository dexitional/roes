import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Banknote, CircleDollarSign, MessageSquareText, PackageCheck, ShoppingCart, Star, Truck, Users } from 'lucide-react'
import type { OrderStatus, PaymentStatus } from '@roes/db/types'
import { api } from '#/lib/api-client'
import { money, num, relative } from '#/lib/format'
import { ORDER_STATUS_LABELS } from '#/lib/labels'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/misc'
import { Donut, TrendChart, revenueSeries } from '#/components/admin/charts'
import { PageHeader, Section, StatCard, StatSkeletons } from '#/components/admin/kit'
import { Img } from '#/components/site/image'
import { OrderStatusBadge, PaymentBadge } from '#/components/site/order-bits'
import { Skeleton } from '#/components/ui/misc'

export const Route = createFileRoute('/admin/')({ component: Dashboard })

interface DashboardData {
  kpi: { revenue: number; orders: number; aov: number; prevRevenue: number; prevOrders: number; todayOrders: number; todayRevenue: number; customers: number; newCustomers: number }
  series: Array<{ day: string; revenue: number; orders: number }>
  byStatus: Array<{ status: OrderStatus; count: number }>
  recent: Array<{ reference: string; customerName: string; total: number; status: OrderStatus; paymentStatus: PaymentStatus; createdAt: string; itemCount: number }>
  lowStock: Array<{ id: number; name: string; stock: number; image: string | null }>
  attention: { paymentsToConfirm: number; toShip: number; reviewsPending: number; staleUnpaid: number }
  top: Array<{ id: number; name: string; image: string | null; units: number; revenue: number; views: number }>
  sms: { configured: boolean; simulated: boolean; balance: { balance: number; model: string } | null }
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function Dashboard() {
  const { user } = Route.useRouteContext()
  const { data } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api.get<DashboardData>('/admin/dashboard'), refetchInterval: 60_000 })
  const attention = data
    ? [
        { n: data.attention.paymentsToConfirm, label: 'MoMo payments to confirm', icon: Banknote, to: '/admin/orders', search: { payment: 'submitted' } },
        { n: data.attention.toShip, label: 'Paid orders to ship', icon: Truck, to: '/admin/orders', search: { status: 'confirmed' } },
        { n: data.attention.reviewsPending, label: 'Reviews to moderate', icon: Star, to: '/admin/reviews', search: {} },
        { n: data.attention.staleUnpaid, label: 'Unpaid for over a day', icon: AlertTriangle, to: '/admin/orders', search: { payment: 'pending', status: 'pending' } },
      ].filter((a) => a.n > 0)
    : []
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={`${greeting()}, ${user.fullName.split(' ')[0]}`}
        description="Here’s how Roes Outlet is doing over the last 30 days."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/admin/analytics">Product analytics</Link>
            </Button>
            <Button asChild>
              <Link to="/admin/products/$productId" params={{ productId: 'new' }}>
                New product
              </Link>
            </Button>
          </>
        }
      />
      {attention.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {attention.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              search={a.search as never}
              className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold-soft/60 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-gold text-gold-foreground">
                <a.icon className="size-5" />
              </span>
              <span className="flex-1 text-sm font-semibold">{a.label}</span>
              <span className="text-2xl font-bold">{a.n}</span>
            </Link>
          ))}
        </div>
      )}
      {!data ? (
        <StatSkeletons />
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Revenue (30 days)" value={money(data.kpi.revenue, true)} icon={CircleDollarSign} current={data.kpi.revenue} previous={data.kpi.prevRevenue} spark={data.series} sparkKey="revenue" />
          <StatCard label="Paid orders" value={num(data.kpi.orders)} icon={ShoppingCart} current={data.kpi.orders} previous={data.kpi.prevOrders} spark={data.series} sparkKey="orders" tone="gold" />
          <StatCard label="Average order" value={money(data.kpi.aov, true)} icon={PackageCheck} tone="info" hint={`Today: ${data.kpi.todayOrders} orders`} />
          <StatCard label="Customers" value={num(data.kpi.customers)} icon={Users} tone="success" hint={`+${data.kpi.newCustomers} new this month`} />
        </div>
      )}
      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Section title="Revenue" description="Paid orders per day">
          {data ? <TrendChart data={data.series} series={revenueSeries} /> : <Skeleton className="h-[300px]" />}
        </Section>
        <Section title="Orders by status" description="Placed in the last 30 days">
          {data ? (
            data.byStatus.length ? (
              <Donut data={data.byStatus.map((s) => ({ name: ORDER_STATUS_LABELS[s.status], value: s.count }))} centerLabel="orders" />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No orders yet.</p>
            )
          ) : (
            <Skeleton className="h-56" />
          )}
        </Section>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
            <Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              All orders <ArrowRight className="size-4" />
            </Link>
          </CardHeader>
          <CardContent className="pt-3">
            {!data ? (
              <Skeleton className="h-64" />
            ) : data.recent.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Orders will appear here.</p>
            ) : (
              <ul className="divide-y">
                {data.recent.map((o) => (
                  <li key={o.reference}>
                    <Link to="/admin/orders/$reference" params={{ reference: o.reference }} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted/60">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          <span className="font-mono">{o.reference}</span> · {o.customerName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {relative(o.createdAt)} · {Number(o.itemCount)} items
                        </p>
                      </div>
                      <div className="hidden gap-1.5 sm:flex">
                        <OrderStatusBadge status={o.status} />
                        <PaymentBadge status={o.paymentStatus} />
                      </div>
                      <p className="w-24 text-right text-sm font-bold tabular-nums">{money(o.total)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <div className="grid content-start gap-6">
          <Section title="Top sellers" description="By revenue, 30 days">
            {data?.top.length ? (
              <ul className="grid gap-3">
                {data.top.map((p, i) => (
                  <li key={p.id}>
                    <Link to="/admin/analytics/$productId" params={{ productId: String(p.id) }} className="flex items-center gap-3">
                      <span className="w-4 text-xs font-bold text-muted-foreground">{i + 1}</span>
                      <Img src={p.image} alt="" sizes="40px" maxWidth={96} className="size-10 rounded-lg object-cover" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                      <span className="text-sm font-semibold tabular-nums">{money(p.revenue, true)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sales will show here once orders are paid.</p>
            )}
          </Section>
          <Section title="Running low" description="Popular pieces with 2 or fewer left">
            {data?.lowStock.length ? (
              <ul className="grid gap-3">
                {data.lowStock.map((p) => (
                  <li key={p.id}>
                    <Link to="/admin/products/$productId" params={{ productId: String(p.id) }} className="flex items-center gap-3">
                      <Img src={p.image} alt="" sizes="40px" maxWidth={96} className="size-10 rounded-lg object-cover" />
                      <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                      <span className={p.stock <= 0 ? 'text-xs font-bold text-destructive' : 'text-xs font-bold text-warning'}>{p.stock <= 0 ? 'Sold out' : `${p.stock} left`}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Stock levels look healthy.</p>
            )}
          </Section>
          {data && (
            <Link to="/admin/sms" className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm transition hover:shadow-md">
              <MessageSquareText className="size-5 text-primary" />
              <span className="flex-1">
                SMS notifications{' '}
                {data.sms.configured ? (
                  <span className="text-success">connected</span>
                ) : data.sms.simulated ? (
                  <span className="text-warning">simulated</span>
                ) : (
                  <span className="text-destructive">not configured</span>
                )}
              </span>
              {data.sms.balance && <span className="font-semibold">{data.sms.balance.balance.toLocaleString()} credits</span>}
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
