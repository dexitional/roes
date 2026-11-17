import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Users } from 'lucide-react'
import { cn } from '@roes/ui'
import { api } from '#/lib/api-client'
import type { Page } from '#/lib/api-client'
import { date, money, relative } from '#/lib/format'
import { displayPhone } from '#/lib/phone'
import { Avatar, Card } from '#/components/ui/misc'
import { NativeSelect } from '#/components/ui/input'
import { EmptyState, PageHeader, Pager, SearchInput, Table, TableSkeleton, Td, Th } from '#/components/admin/kit'

const search = z.object({ q: z.string().optional().catch(undefined), sort: z.string().optional().catch(undefined), page: z.coerce.number().optional().catch(undefined) })
type Search = z.infer<typeof search>
export const Route = createFileRoute('/admin/customers/')({ validateSearch: search, component: Customers })

interface Row {
  id: number
  fullName: string
  email: string
  phone: string | null
  avatarUrl: string | null
  createdAt: string
  lastLoginAt: string | null
  orders: number
  spent: number
  lastOrderAt: string | null
  wishlist: number
}

function Customers() {
  const s = Route.useSearch()
  const navigate = useNavigate()
  const set = (patch: Partial<Search>) => void navigate({ to: '.', search: (prev: Search) => ({ ...prev, ...patch, page: patch.page }) })
  const { data, isLoading, isPlaceholderData } = useQuery({ queryKey: ['admin', 'customers', s], queryFn: () => api.get<Page<Row>>('/admin/customers', s), placeholderData: keepPreviousData })
  return (
    <>
      <PageHeader eyebrow="Sales" title="Customers" description="Everyone who has signed in with Google." />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b p-4">
          <SearchInput value={s.q ?? ''} onChange={(q) => set({ q: q || undefined })} placeholder="Name, email or phone" className="w-full sm:w-80" />
          <NativeSelect className="ml-auto w-auto" value={s.sort ?? 'recent'} onChange={(e) => set({ sort: e.target.value })}>
            <option value="recent">Newest</option>
            <option value="spent">Top spenders</option>
            <option value="orders">Most orders</option>
            <option value="name">Name</option>
          </NativeSelect>
        </div>
        {isLoading ? (
          <TableSkeleton />
        ) : !data?.data.length ? (
          <EmptyState icon={Users} title="No customers yet" />
        ) : (
          <Table className={cn(isPlaceholderData && 'opacity-60')}>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Phone</Th>
                <Th className="text-right">Orders</Th>
                <Th className="text-right">Spent</Th>
                <Th className="text-right">Wishlist</Th>
                <Th>Last order</Th>
                <Th>Joined</Th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <Td>
                    <Link to="/admin/customers/$customerId" params={{ customerId: String(c.id) }} className="flex items-center gap-3">
                      <Avatar src={c.avatarUrl} name={c.fullName} />
                      <span>
                        <span className="block font-medium">{c.fullName}</span>
                        <span className="text-xs text-muted-foreground">{c.email}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td>{c.phone ? displayPhone(c.phone) : '—'}</Td>
                  <Td className="text-right tabular-nums">{Number(c.orders)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{money(c.spent, true)}</Td>
                  <Td className="text-right tabular-nums">{Number(c.wishlist)}</Td>
                  <Td className="text-muted-foreground">{c.lastOrderAt ? relative(c.lastOrderAt) : '—'}</Td>
                  <Td className="text-muted-foreground">{date(c.createdAt)}</Td>
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
