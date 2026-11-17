import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Minus, Plus, ShoppingBag, Trash2, Truck } from 'lucide-react'
import { api } from '#/lib/api-client'
import { cart, useCart } from '#/lib/cart'
import { money } from '#/lib/format'
import type { CartItem } from '#/lib/cart'
import { Button } from '#/components/ui/button'
import { Dialog, SheetContent } from '#/components/ui/overlay'
import { Img } from './image'

export interface QuoteLine {
  productId: number
  variantId: number | null
  slug: string
  name: string
  variantLabel: string | null
  image: string | null
  unitPrice: number
  compareAtPrice: number | null
  quantity: number
  available: number
  lineTotal: number
  issue: string | null
}
export interface Quote {
  lines: Array<QuoteLine>
  itemCount: number
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  coupon: { code: string; description: string | null } | null
  couponError: string | null
  freeDeliveryOver: number
  issues: Array<string>
}

/** Live server prices for the bag (debounced so quantity taps don't spam the API). */
export function useQuote(items: Array<CartItem>, opts: { couponCode?: string | null; deliveryMethod?: 'delivery' | 'pickup'; region?: string | null } = {}) {
  const payload = {
    items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
    couponCode: opts.couponCode || null,
    deliveryMethod: opts.deliveryMethod ?? 'pickup',
    region: opts.region || null,
  }
  const key = JSON.stringify(payload)
  const [debounced, setDebounced] = useState(key)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(key), 250)
    return () => clearTimeout(t)
  }, [key])
  return useQuery({
    queryKey: ['quote', debounced],
    queryFn: () => api.post<Quote>('/store/quote', JSON.parse(debounced)),
    enabled: items.length > 0,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  })
}

export function QuantityStepper({ value, onChange, max = 50, size = 'md' }: { value: number; onChange: (n: number) => void; max?: number; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'size-7' : 'size-9'
  return (
    <div className="inline-flex items-center rounded-full border bg-card">
      <button type="button" className={`grid ${s} place-items-center rounded-full transition hover:bg-muted`} onClick={() => onChange(value - 1)} aria-label="Decrease quantity">
        <Minus className="size-3.5" />
      </button>
      <span className="w-7 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        className={`grid ${s} place-items-center rounded-full transition hover:bg-muted disabled:opacity-40`}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

export function FreeDeliveryBar({ subtotal, threshold }: { subtotal: number; threshold: number }) {
  if (!threshold) return null
  const pct = Math.min(100, (subtotal / threshold) * 100)
  const left = threshold - subtotal
  return (
    <div className="rounded-2xl bg-gold-soft/70 p-3.5">
      <p className="flex items-center gap-2 text-xs font-semibold">
        <Truck className="size-4 text-gold" />
        {left > 0 ? (
          <span>
            Add <span className="text-primary">{money(left)}</span> more for free delivery
          </span>
        ) : (
          <span>You’ve unlocked free delivery 🎉</span>
        )}
      </p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-background/70">
        <div className="bg-foil h-full rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function CartDrawer() {
  const { items, open, count, subtotal } = useCart()
  const quote = useQuote(open ? items : [])
  const navigate = useNavigate()
  const lineIssue = (i: CartItem) => quote.data?.lines.find((l) => l.productId === i.productId && l.variantId === i.variantId)?.issue
  const total = quote.data?.subtotal ?? subtotal

  return (
    <Dialog open={open} onOpenChange={(o) => cart.setOpen(o)}>
      <SheetContent title="Your bag">
        <div className="flex h-16 items-center justify-between border-b px-5">
          <h2 className="text-lg font-bold">
            Your bag <span className="text-muted-foreground">({count})</span>
          </h2>
          <button onClick={() => cart.setOpen(false)} className="rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-muted">
            Close
          </button>
        </div>
        {items.length === 0 ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-20 place-items-center rounded-full bg-accent">
                <ShoppingBag className="size-8 text-primary" />
              </div>
              <h3 className="font-display mt-5 text-3xl">Your bag is empty</h3>
              <p className="mt-2 text-sm text-muted-foreground">Find something you’ll love wearing on repeat.</p>
              <Button className="mt-6" onClick={() => (cart.setOpen(false), void navigate({ to: '/shop' }))}>
                Start shopping
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <FreeDeliveryBar subtotal={total} threshold={quote.data?.freeDeliveryOver ?? 0} />
              <ul className="mt-4 divide-y">
                {items.map((item) => {
                  const issue = lineIssue(item)
                  return (
                    <li key={`${item.productId}-${item.variantId}`} className="flex gap-4 py-4">
                      <Link to="/p/$slug" params={{ slug: item.slug }} onClick={() => cart.setOpen(false)} className="shrink-0">
                        <Img src={item.image} alt={item.name} sizes="88px" maxWidth={192} className="size-22 rounded-xl object-cover" />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <Link to="/p/$slug" params={{ slug: item.slug }} onClick={() => cart.setOpen(false)} className="line-clamp-2 text-sm font-semibold hover:text-primary">
                            {item.name}
                          </Link>
                          <button onClick={() => cart.remove(item.productId, item.variantId)} className="text-muted-foreground transition hover:text-destructive" aria-label="Remove">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        {item.variantLabel && <p className="mt-0.5 text-xs text-muted-foreground">{item.variantLabel}</p>}
                        {issue && <p className="mt-1 text-xs font-semibold text-destructive">{issue}</p>}
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <QuantityStepper size="sm" value={item.quantity} onChange={(n) => cart.setQuantity(item.productId, item.variantId, n)} />
                          <span className="text-sm font-bold tabular-nums">{money(item.price * item.quantity)}</span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="border-t bg-card px-5 py-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-lg font-bold tabular-nums">{money(total)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Delivery and discounts are worked out at checkout.</p>
              <Button size="lg" className="mt-4 w-full" onClick={() => (cart.setOpen(false), void navigate({ to: '/checkout' }))}>
                Checkout · {money(total)}
              </Button>
              <Button variant="link" className="mt-2 w-full" onClick={() => (cart.setOpen(false), void navigate({ to: '/cart' }))}>
                View full bag
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Dialog>
  )
}
