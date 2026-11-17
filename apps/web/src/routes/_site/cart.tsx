import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react'
import { cart, useCart } from '#/lib/cart'
import { money } from '#/lib/format'
import { pageSeo } from '#/lib/seo'
import { Button } from '#/components/ui/button'
import { FreeDeliveryBar, QuantityStepper, useQuote } from '#/components/site/cart-drawer'
import { Img } from '#/components/site/image'
import { Container } from '#/components/site/section'

export const Route = createFileRoute('/_site/cart')({
  head: () => pageSeo({ title: 'Your bag', description: 'Review the pieces in your bag.', path: '/cart', noindex: true }),
  component: CartPage,
})

function CartPage() {
  const { items, count } = useCart()
  const quote = useQuote(items)
  const q = quote.data
  return (
    <Container className="py-10">
      <h1 className="font-display text-5xl font-semibold">Your bag</h1>
      <p className="mt-2 text-muted-foreground">{count} {count === 1 ? 'piece' : 'pieces'}</p>
      {items.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed py-20 text-center">
          <ShoppingBag className="mx-auto size-10 text-primary" />
          <p className="font-display mt-4 text-3xl">Nothing here yet</p>
          <Button asChild className="mt-6">
            <Link to="/shop">Start shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem]">
          <ul className="divide-y rounded-3xl border bg-card px-6">
            {items.map((item) => {
              const line = q?.lines.find((l) => l.productId === item.productId && l.variantId === item.variantId)
              return (
                <li key={`${item.productId}-${item.variantId}`} className="flex gap-5 py-6">
                  <Link to="/p/$slug" params={{ slug: item.slug }}>
                    <Img src={item.image} alt={item.name} sizes="128px" maxWidth={256} className="size-28 rounded-2xl object-cover sm:size-32" />
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-3">
                      <div>
                        <Link to="/p/$slug" params={{ slug: item.slug }} className="font-semibold hover:text-primary">
                          {item.name}
                        </Link>
                        {item.variantLabel && <p className="text-sm text-muted-foreground">{item.variantLabel}</p>}
                        <p className="mt-1 text-sm text-muted-foreground">{money(line?.unitPrice ?? item.price)} each</p>
                        {line?.issue && <p className="mt-1 text-sm font-semibold text-destructive">{line.issue}</p>}
                      </div>
                      <p className="font-bold tabular-nums">{money(line?.lineTotal ?? item.price * item.quantity)}</p>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <QuantityStepper value={item.quantity} onChange={(n) => cart.setQuantity(item.productId, item.variantId, n)} max={line?.available} />
                      <button onClick={() => cart.remove(item.productId, item.variantId)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-4" /> Remove
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <aside className="h-fit rounded-3xl border bg-card p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-bold">Summary</h2>
            <div className="mt-4">
              <FreeDeliveryBar subtotal={q?.subtotal ?? 0} threshold={q?.freeDeliveryOver ?? 0} />
            </div>
            <dl className="mt-5 grid gap-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-semibold tabular-nums">{money(q?.subtotal ?? 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="text-muted-foreground">At checkout</dd>
              </div>
            </dl>
            <Button asChild size="lg" className="mt-6 w-full">
              <Link to="/checkout">
                Checkout <ArrowRight />
              </Link>
            </Button>
            <p className="mt-4 text-center text-xs text-muted-foreground">Pay securely by Mobile Money. You’ll get an SMS for every step.</p>
          </aside>
        </div>
      )}
    </Container>
  )
}
