import { Link } from '@tanstack/react-router'
import { Heart, Plus } from 'lucide-react'
import { cn } from '@roes/ui'
import { cart } from '#/lib/cart'
import { discountPercent } from '#/lib/format'
import type { Card } from '#/lib/queries'
import { useWishlist } from '#/hooks/use-wishlist'
import { Skeleton } from '#/components/ui/misc'
import { Img } from './image'
import { Price, Stars } from './price'

const SIZES = '(min-width: 1280px) 22vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw'

export function ProductCard({ product, priority = false, source }: { product: Card; priority?: boolean; source?: string }) {
  const wishlist = useWishlist()
  const saved = wishlist.has(product.id)
  const off = discountPercent(product.price, product.compareAtPrice)
  const soldOut = product.stock <= 0
  return (
    <article className="group relative flex flex-col">
      <Link
        to="/p/$slug"
        params={{ slug: product.slug }}
        className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-muted"
        aria-label={product.name}
      >
        <Img
          src={product.image}
          alt={product.imageAlt ?? product.name}
          sizes={SIZES}
          maxWidth={768}
          priority={priority}
          className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        {product.hoverImage && (
          <Img
            src={product.hoverImage}
            alt=""
            sizes={SIZES}
            maxWidth={768}
            fade={false}
            className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}
        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
          {soldOut ? (
            <span className="rounded-full bg-foreground/85 px-2.5 py-1 text-[0.65rem] font-bold tracking-wide text-background uppercase backdrop-blur">Sold out</span>
          ) : off > 0 ? (
            <span className="rounded-full bg-crimson px-2.5 py-1 text-[0.65rem] font-bold tracking-wide text-white uppercase">−{off}%</span>
          ) : product.isNew ? (
            <span className="bg-foil rounded-full px-2.5 py-1 text-[0.65rem] font-bold tracking-wide text-gold-foreground uppercase">New</span>
          ) : null}
          {!soldOut && product.stock > 0 && product.stock <= 2 && (
            <span className="rounded-full bg-background/85 px-2.5 py-1 text-[0.65rem] font-bold text-foreground backdrop-blur">Only {product.stock} left</span>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => wishlist.toggle(product.id)}
        aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
        aria-pressed={saved}
        className="absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full bg-background/80 shadow-sm backdrop-blur transition hover:scale-110 hover:bg-background"
      >
        <Heart className={cn('size-[18px] transition', saved ? 'fill-crimson text-crimson' : 'text-foreground')} />
      </button>
      {!soldOut && product.variantCount === 0 && (
        <button
          type="button"
          onClick={() =>
            cart.add(
              { productId: product.id, variantId: null, name: product.name, slug: product.slug, image: product.image, price: product.price, variantLabel: null },
              1,
              { source },
            )
          }
          className="absolute right-2.5 bottom-[5.25rem] flex translate-y-2 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 max-lg:translate-y-0 max-lg:px-2.5 max-lg:opacity-100"
          aria-label={`Add ${product.name} to bag`}
        >
          <Plus className="size-4" />
          <span className="max-lg:hidden">Add to bag</span>
        </button>
      )}
      <div className="mt-3 flex flex-1 flex-col gap-1 px-0.5">
        {product.categoryName && <p className="text-[0.68rem] font-semibold tracking-wider text-muted-foreground uppercase">{product.categoryName}</p>}
        <h3 className="line-clamp-1 text-sm font-semibold">
          <Link to="/p/$slug" params={{ slug: product.slug }} className="hover:text-primary">
            {product.name}
          </Link>
        </h3>
        <div className="flex items-center justify-between gap-2">
          <Price price={product.price} compareAt={product.compareAtPrice} />
          {product.ratingCount > 0 && <Stars value={product.ratingAvg} size={11} />}
        </div>
      </div>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[4/5] rounded-2xl" />
      <Skeleton className="mt-3 h-2.5 w-16" />
      <Skeleton className="mt-2 h-3.5 w-3/4" />
      <Skeleton className="mt-2 h-3.5 w-1/3" />
    </div>
  )
}

export function ProductGrid({ products, className, source, priorityCount = 0 }: { products: Array<Card>; className?: string; source?: string; priorityCount?: number }) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4', className)}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} source={source} priority={i < priorityCount} />
      ))}
    </div>
  )
}

export function ProductGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}
