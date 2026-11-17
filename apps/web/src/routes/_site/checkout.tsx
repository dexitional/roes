import { useEffect, useState } from 'react'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CreditCard, Lock, MapPin, Smartphone, Store, Tag, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@roes/ui'
import { GHANA_REGIONS } from '@roes/db/types'
import { api, errorMessage } from '#/lib/api-client'
import { cart, useCart } from '#/lib/cart'
import { money } from '#/lib/format'
import { displayPhone } from '#/lib/phone'
import { bootstrapQuery, sessionQuery } from '#/lib/queries'
import { pageSeo } from '#/lib/seo'
import { track } from '#/lib/track'
import { Button } from '#/components/ui/button'
import { Field, Input, Textarea } from '#/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { useQuote } from '#/components/site/cart-drawer'
import { Img } from '#/components/site/image'
import { Container } from '#/components/site/section'

export const Route = createFileRoute('/_site/checkout')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery)
    if (!user) throw redirect({ to: '/login', search: { next: '/checkout' } })
    return { user }
  },
  head: () => pageSeo({ title: 'Checkout', description: 'Complete your order.', path: '/checkout', noindex: true }),
  component: Checkout,
})

function Choice({ active, onClick, icon: Icon, title, text }: { active: boolean; onClick: () => void; icon: typeof Truck; title: string; text: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition', active ? 'border-primary bg-primary/5' : 'hover:border-foreground/25')}
    >
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', active ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{text}</span>
      </span>
    </button>
  )
}

function Checkout() {
  const { user } = Route.useRouteContext()
  const { items, coupon: savedCoupon } = useCart()
  const { data: boot } = useQuery(bootstrapQuery)
  const navigate = useNavigate()
  const [form, setForm] = useState({
    customerName: user.fullName,
    phone: user.phone ? displayPhone(user.phone) : '',
    deliveryMethod: 'delivery' as 'delivery' | 'pickup',
    region: '',
    city: '',
    address: '',
    notes: '',
    paymentMethod: 'momo' as 'momo' | 'paystack',
  })
  const [couponInput, setCouponInput] = useState(savedCoupon ?? '')
  const [coupon, setCoupon] = useState<string | null>(savedCoupon)
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))
  const quote = useQuote(items, { couponCode: coupon, deliveryMethod: form.deliveryMethod, region: form.region })
  const q = quote.data

  useEffect(() => {
    for (const i of items) track(i.productId, 'checkout', { quantity: i.quantity })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (q?.couponError && coupon) toast.error(q.couponError)
  }, [q?.couponError, coupon])

  const place = useMutation({
    mutationFn: () =>
      api.post<{ reference: string; paymentUrl: string | null }>('/me/orders', {
        ...form,
        couponCode: q?.coupon ? coupon : null,
        items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
      }),
    onSuccess: (r) => {
      cart.clear()
      if (r.paymentUrl) window.location.href = r.paymentUrl
      else void navigate({ to: '/account/orders/$reference', params: { reference: r.reference }, search: { placed: true } })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  if (!items.length) {
    return (
      <Container className="py-24 text-center">
        <h1 className="font-display text-4xl">Your bag is empty</h1>
        <Button asChild className="mt-6">
          <Link to="/shop">Browse the shop</Link>
        </Button>
      </Container>
    )
  }

  const regions = [...new Set([...(boot?.delivery.regions.map((r) => r.name) ?? []), ...GHANA_REGIONS])]
  const blocked = q?.lines.some((l) => l.issue)

  return (
    <Container className="py-10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="size-4" /> Secure checkout
      </div>
      <h1 className="font-display mt-2 text-5xl font-semibold">Checkout</h1>
      <form
        className="mt-10 grid gap-10 lg:grid-cols-[1fr_26rem]"
        onSubmit={(e) => {
          e.preventDefault()
          place.mutate()
        }}
      >
        <div className="grid gap-8">
          <section className="rounded-3xl border bg-card p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span className="grid size-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground">1</span> Your details
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input required value={form.customerName} onChange={(e) => set('customerName', e.target.value)} autoComplete="name" />
              </Field>
              <Field label="Phone number" hint="We text order updates to this number.">
                <Input required type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="024 412 3456" autoComplete="tel" />
              </Field>
              <Field label="Email" className="sm:col-span-2">
                <Input value={user.email} disabled />
              </Field>
            </div>
          </section>

          <section className="rounded-3xl border bg-card p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span className="grid size-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground">2</span> Delivery
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Choice active={form.deliveryMethod === 'delivery'} onClick={() => set('deliveryMethod', 'delivery')} icon={Truck} title="Doorstep delivery" text="FedEx, Speedaf or same-day bus parcel" />
              <Choice active={form.deliveryMethod === 'pickup'} onClick={() => set('deliveryMethod', 'pickup')} icon={Store} title="Pickup (free)" text="Not sure of the fee? Choose pickup and we’ll confirm with you." />
            </div>
            {form.deliveryMethod === 'delivery' ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Region">
                  <Select value={form.region} onValueChange={(v) => set('region', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose your region" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((r) => {
                        const fee = boot?.delivery.regions.find((x) => x.name === r)?.fee ?? boot?.delivery.defaultFee
                        return (
                          <SelectItem key={r} value={r}>
                            {r} {fee !== undefined && <span className="text-muted-foreground">· {money(fee, true)}</span>}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Town / city">
                  <Input required value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. East Legon" />
                </Field>
                <Field label="Delivery address" className="sm:col-span-2" hint="House number, street, landmark or GhanaPost GPS address.">
                  <Textarea required value={form.address} onChange={(e) => set('address', e.target.value)} className="min-h-20" />
                </Field>
              </div>
            ) : (
              <p className="mt-5 flex gap-2 rounded-2xl bg-muted p-4 text-sm">
                <MapPin className="size-4 shrink-0 text-primary" /> {boot?.delivery.pickupAddress}
              </p>
            )}
            <Field label="Order notes (optional)" className="mt-4">
              <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Gift message, preferred delivery time…" />
            </Field>
          </section>

          <section className="rounded-3xl border bg-card p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span className="grid size-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground">3</span> Payment
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Choice
                active={form.paymentMethod === 'momo'}
                onClick={() => set('paymentMethod', 'momo')}
                icon={Smartphone}
                title="Mobile Money"
                text={boot ? `Pay ${boot.payments.momoName} on ${displayPhone(boot.payments.momoNumber)}` : 'MTN MoMo, Telecel Cash, AT Money'}
              />
              {boot?.payments.paystack && (
                <Choice active={form.paymentMethod === 'paystack'} onClick={() => set('paymentMethod', 'paystack')} icon={CreditCard} title="Card or MoMo online" text="Pay securely with Paystack" />
              )}
            </div>
            {form.paymentMethod === 'momo' && (
              <p className="mt-5 rounded-2xl bg-gold-soft/70 p-4 text-sm leading-relaxed">
                After you place the order we’ll show you the MoMo number and your order reference. Send the total, then enter the transaction ID. We confirm by SMS.
              </p>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-3xl border bg-card p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold">Order summary</h2>
          <ul className="mt-5 grid max-h-80 gap-4 overflow-y-auto">
            {items.map((i) => {
              const line = q?.lines.find((l) => l.productId === i.productId && l.variantId === i.variantId)
              return (
                <li key={`${i.productId}-${i.variantId}`} className="flex gap-3">
                  <div className="relative">
                    <Img src={i.image} alt={i.name} sizes="64px" maxWidth={128} className="size-16 rounded-xl object-cover" />
                    <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-foreground text-[0.65rem] font-bold text-background">{i.quantity}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{i.name}</p>
                    {i.variantLabel && <p className="text-xs text-muted-foreground">{i.variantLabel}</p>}
                    {line?.issue && <p className="text-xs font-semibold text-destructive">{line.issue}</p>}
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{money(line?.lineTotal ?? i.price * i.quantity)}</p>
                </li>
              )
            })}
          </ul>
          <div className="mt-5 flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Discount code" className="pl-9 uppercase" />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const code = couponInput.trim() || null
                setCoupon(code)
                cart.setCoupon(code)
              }}
            >
              Apply
            </Button>
          </div>
          {q?.coupon && <p className="mt-2 text-xs font-semibold text-success">Code {q.coupon.code} applied{q.coupon.description ? `: ${q.coupon.description}` : ''}</p>}
          <dl className="mt-5 grid gap-2.5 border-t pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{money(q?.subtotal ?? 0)}</dd>
            </div>
            {q && q.discount > 0 && (
              <div className="flex justify-between text-success">
                <dt>Discount</dt>
                <dd className="tabular-nums">−{money(q.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery</dt>
              <dd className="tabular-nums">{form.deliveryMethod === 'pickup' ? 'Free pickup' : !q?.deliveryFee ? 'Free' : `${money(q.deliveryFee)}${form.region ? '' : ' (est.)'}`}</dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t pt-4">
              <dt className="font-bold">Total</dt>
              <dd className="text-2xl font-bold tabular-nums">{money(q?.total ?? 0)}</dd>
            </div>
          </dl>
          <Button type="submit" size="xl" className="mt-6 w-full" loading={place.isPending} disabled={!q || blocked}>
            Place order · {money(q?.total ?? 0)}
          </Button>
          {blocked && <p className="mt-2 text-center text-xs text-destructive">Some items need attention in your bag.</p>}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            By placing your order you agree to our{' '}
            <Link to="/pages/$slug" params={{ slug: 'returns-exchanges' }} className="underline">
              exchange policy
            </Link>
            .
          </p>
        </aside>
      </form>
    </Container>
  )
}
