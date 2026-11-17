import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Banknote, ShoppingCart } from 'lucide-react'
import { cn } from '@roes/ui'
import { ORDER_STATUSES } from '@roes/db/types'
import type { OrderStatus, PaymentStatus } from '@roes/db/types'
import { api } from '#/lib/api-client'
import type { Page } from '#/lib/api-client'
import { dateTime, money } from '#/lib/format'
import { ORDER_STATUS_LABELS } from '#/lib/labels'
import { displayPhone } from '#/lib/phone'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/misc'
import { NativeSelect } from '#/components/ui/input'
import { EmptyState, PageHeader, Pager, SearchInput, Table, TableSkeleton, Td, Th } from '#/components/admin/kit'
import { Img } from '#/components/site/image'
import { OrderStatusBadge, PaymentBadge } from '#/components/site/order-bits'

const search = z.object({
  q: z.string().optional().catch(undefined),
  status: z.string().optional().catch(undefined),
  payment: z.string().optional().catch(undefined),
  page: z.coerce.number().optional().catch(undefined),
})
type Search = z.infer<typeof search>

export const Route = createFileRoute('/admin/orders/')({ validateSearch: search, component: Orders })

interface Row {
  reference: string
  customerName: string
  phone: string
  total: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: string
  deliveryMethod: string
  region: string | null
  createdAt: string
  itemCount: number
  image: string | null
  momoTransactionId: string | null
}

function Orders() {
  const s = Route.useSearch()
  const navigate = useNavigate()
  const set = (patch: Partial<Search>) => void navigate({ to: '.', search: (prev: Search) => ({ ...prev, ...patch, page: patch.page }) })
  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['admin', 'orders', s],
    queryFn: () => api.get<Page<Row> & { counts: Record<string, number> }>('/admin/orders', s),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
  const counts = data?.counts ?? {}
  return (
    <>
      <PageHeader eyebrow="Sales" title="Orders" description="Confirm MoMo payments, update statuses and keep customers informed by SMS." />
      {counts.toConfirm ? (
        <button
          onClick={() => set({ payment: 'submitted', status: undefined })}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-gold/40 bg-gold-soft/60 p-4 text-left text-sm font-semibold transition hover:shadow-md"
        >
          <Banknote className="size-5 text-gold" />
          {counts.toConfirm} MoMo payment{counts.toConfirm === 1 ? '' : 's'} waiting for confirmation
          <span className="ml-auto text-primary">Review →</span>
        </button>
      ) : null}
      <Card className="overflow-hidden">
        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b px-4 pt-3">
          {[undefined, ...ORDER_STATUSES].map((st) => (
            <button
              key={st ?? 'all'}
              onClick={() => set({ status: st })}
              className={cn('shrink-0 border-b-2 px-3 pb-2.5 text-sm font-semibold transition', s.status === st ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}
            >
              {st ? ORDER_STATUS_LABELS[st] : 'All'}
              {st && counts[st] ? <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">{counts[st]}</span> : null}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 border-b p-4">
          <SearchInput value={s.q ?? ''} onChange={(q) => set({ q: q || undefined })} placeholder="Reference, name, phone, MoMo ID…" className="w-full sm:w-80" />
          <NativeSelect className="w-auto" value={s.payment ?? ''} onChange={(e) => set({ payment: e.target.value || undefined })}>
            <option value="">Any payment</option>
            <option value="pending">Not paid</option>
            <option value="submitted">Proof sent</option>
            <option value="paid">Paid</option>
          </NativeSelect>
          {(s.q || s.payment || s.status) && (
            <Button variant="ghost" onClick={() => navigate({ to: '.', search: {} })}>
              Clear
            </Button>
          )}
        </div>
        {isLoading ? (
          <TableSkeleton cols={6} />
        ) : !data?.data.length ? (
          <EmptyState icon={ShoppingCart} title="No orders here" description="Orders appear as soon as customers check out." />
        ) : (
          <Table className={cn(isPlaceholderData && 'opacity-60')}>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th>Delivery</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((o) => (
                <tr key={o.reference} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate({ to: '/admin/orders/$reference', params: { reference: o.reference } })}>
                  <Td>
                    <Link to="/admin/orders/$reference" params={{ reference: o.reference }} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <Img src={o.image} alt="" sizes="40px" maxWidth={96} className="size-10 rounded-lg object-cover" />
                      <span>
                        <span className="block font-mono font-bold">{o.reference}</span>
                        <span className="text-xs text-muted-foreground">
                          {dateTime(o.createdAt)} · {Number(o.itemCount)} items
                        </span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <span className="block font-medium">{o.customerName}</span>
                    <span className="text-xs text-muted-foreground">{displayPhone(o.phone)}</span>
                  </Td>
                  <Td>
                    <OrderStatusBadge status={o.status} />
                  </Td>
                  <Td>
                    <PaymentBadge status={o.paymentStatus} />
                    {o.momoTransactionId && <span className="mt-0.5 block font-mono text-[0.68rem] text-muted-foreground">#{o.momoTransactionId}</span>}
                  </Td>
                  <Td className="text-sm capitalize">{o.deliveryMethod === 'pickup' ? 'Pickup' : (o.region ?? 'Delivery')}</Td>
                  <Td className="text-right font-bold tabular-nums">{money(o.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => set({ page })} />}
      </Card>
    </>
  )
}
