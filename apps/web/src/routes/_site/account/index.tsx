import { useState } from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ChevronRight, Heart, LogOut, Package, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { OrderStatus, PaymentStatus } from '@roes/db/types'
import { api, errorMessage } from '#/lib/api-client'
import { date, money } from '#/lib/format'
import { displayPhone } from '#/lib/phone'
import { sessionQuery } from '#/lib/queries'
import { pageSeo } from '#/lib/seo'
import { useSignOut } from '#/hooks/use-session'
import { Button } from '#/components/ui/button'
import { Field, Input } from '#/components/ui/input'
import { Avatar, Skeleton } from '#/components/ui/misc'
import { Img } from '#/components/site/image'
import { OrderStatusBadge, PaymentBadge } from '#/components/site/order-bits'
import { Container } from '#/components/site/section'

export const Route = createFileRoute('/_site/account/')({
  validateSearch: z.object({ welcome: z.coerce.boolean().optional().catch(undefined), next: z.string().optional().catch(undefined) }),
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery)
    if (!user) throw redirect({ to: '/login', search: { next: location.href } })
    return { user }
  },
  head: () => pageSeo({ title: 'My account', description: 'Your orders and details.', path: '/account', noindex: true }),
  component: Account,
})

interface OrderSummary {
  reference: string
  total: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: string
  createdAt: string
  itemCount: number
  image: string | null
}

function Profile() {
  const { user } = Route.useRouteContext()
  const qc = useQueryClient()
  const [fullName, setFullName] = useState(user.fullName)
  const [phone, setPhone] = useState(user.phone ? displayPhone(user.phone) : '')
  const save = useMutation({
    mutationFn: () => api.patch('/auth/profile', { fullName, phone }),
    onSuccess: () => {
      toast.success('Profile saved')
      void qc.invalidateQueries({ queryKey: sessionQuery.queryKey })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <Field label="Full name">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </Field>
      <Field label="Phone" hint="For SMS order updates.">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="024 412 3456" />
      </Field>
      <Button type="submit" variant="outline" loading={save.isPending}>
        Save details
      </Button>
    </form>
  )
}

function Account() {
  const { user } = Route.useRouteContext()
  const { welcome, next } = Route.useSearch()
  const signOut = useSignOut()
  const orders = useQuery({ queryKey: ['me', 'orders'], queryFn: () => api.get<Array<OrderSummary>>('/me/orders') })
  return (
    <Container className="py-10">
      {welcome && (
        <div className="bg-wine-gradient mb-8 flex flex-wrap items-center gap-4 rounded-3xl p-6 text-white">
          <Sparkles className="size-6 text-gold-light" />
          <div className="flex-1">
            <p className="font-display text-2xl">Welcome to Roes Outlet, {user.fullName.split(' ')[0]}!</p>
            <p className="text-sm text-white/80">Add your phone number below so we can text you order updates.</p>
          </div>
          {next && next !== '/' && (
            <Button asChild variant="gold">
              <a href={next}>Continue</a>
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={user.avatarUrl} name={user.fullName} className="size-16 ring-4 ring-gold/30" />
        <div className="flex-1">
          <h1 className="font-display text-4xl font-semibold">Hello, {user.fullName.split(' ')[0]}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/wishlist">
            <Heart /> Wishlist
          </Link>
        </Button>
        <Button variant="ghost" onClick={() => void signOut()}>
          <LogOut /> Sign out
        </Button>
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Package className="size-5 text-primary" /> My orders
          </h2>
          {orders.isLoading ? (
            <div className="grid gap-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : !orders.data?.length ? (
            <div className="rounded-3xl border border-dashed p-12 text-center">
              <p className="font-display text-2xl">No orders yet</p>
              <Button asChild className="mt-5">
                <Link to="/shop">Find something lovely</Link>
              </Button>
            </div>
          ) : (
            <ul className="grid gap-3">
              {orders.data.map((o) => (
                <li key={o.reference}>
                  <Link
                    to="/account/orders/$reference"
                    params={{ reference: o.reference }}
                    className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-md"
                  >
                    <Img src={o.image} alt="" sizes="64px" maxWidth={128} className="size-16 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-bold">{o.reference}</p>
                      <p className="text-xs text-muted-foreground">
                        {date(o.createdAt)} · {Number(o.itemCount)} {Number(o.itemCount) === 1 ? 'item' : 'items'}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <OrderStatusBadge status={o.status} />
                        <PaymentBadge status={o.paymentStatus} />
                      </div>
                    </div>
                    <p className="font-bold tabular-nums">{money(o.total)}</p>
                    <ChevronRight className="size-5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="h-fit rounded-3xl border bg-card p-6">
          <h2 className="mb-4 text-lg font-bold">My details</h2>
          <Profile />
        </aside>
      </div>
    </Container>
  )
}
