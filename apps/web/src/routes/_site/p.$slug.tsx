import { useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BadgeCheck, Gift, Heart, MessageCircle, RefreshCcw, Share2, ShieldCheck, ShoppingBag, Star, Truck, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@roes/ui'
import { ApiError, api, errorMessage } from '#/lib/api-client'
import { cart } from '#/lib/cart'
import { date, money } from '#/lib/format'
import { optimizeHtmlImages, optimizedUrl } from '#/lib/image'
import { bootstrapQuery, productQuery } from '#/lib/queries'
import type { ProductDetail } from '#/lib/queries'
import { absoluteUrl, breadcrumbJsonLd, clip, pageSeo, productJsonLd } from '#/lib/seo'
import { track } from '#/lib/track'
import { useSession } from '#/hooks/use-session'
import { useWishlist } from '#/hooks/use-wishlist'
import { Button } from '#/components/ui/button'
import { Textarea, Input, Field } from '#/components/ui/input'
import { Avatar, Badge, Skeleton } from '#/components/ui/misc'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '#/components/ui/overlay'
import { Carousel, CarouselContent, CarouselDots, CarouselItem } from '#/components/ui/carousel'
import { QuantityStepper } from '#/components/site/cart-drawer'
import { Img } from '#/components/site/image'
import { Price, Stars } from '#/components/site/price'
import { ProductCard } from '#/components/site/product-card'
import { Breadcrumbs, Container, SectionHeading } from '#/components/site/section'

export const Route = createFileRoute('/_site/p/$slug')({
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(productQuery(params.slug))
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) throw notFound()
      throw err
    }
  },
  head: ({ loaderData: p }) => {
    if (!p) return {}
    const category = p.categoryName ?? 'Jewelry'
    return pageSeo({
      title: p.seoTitle || `${p.name} | ${category}`,
      description: p.seoDescription || p.shortDescription || clip(p.description),
      path: `/p/${p.slug}`,
      image: p.images[0]?.url,
      imageAlt: p.images[0]?.alt ?? p.name,
      type: 'product',
      extraMeta: [
        { property: 'product:price:amount', content: p.price.toFixed(2) },
        { property: 'product:price:currency', content: 'GHS' },
        { property: 'product:availability', content: p.stock > 0 ? 'in stock' : 'out of stock' },
        { property: 'product:condition', content: 'new' },
        { property: 'product:brand', content: 'Roes Outlet' },
      ],
      jsonLd: [
        productJsonLd({
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          description: p.description ?? p.shortDescription ?? p.name,
          images: p.images.map((i) => i.url),
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          stock: p.stock,
          category: p.categoryName,
          material: p.material,
          ratingAvg: p.ratingAvg,
          ratingCount: p.ratingCount,
        }),
        breadcrumbJsonLd([
          ['Home', '/'],
          ...(p.parentSlug ? [[p.parentName!, `/collections/${p.parentSlug}`] as [string, string]] : []),
          ...(p.categorySlug ? [[category, `/collections/${p.categorySlug}`] as [string, string]] : []),
          [p.name, `/p/${p.slug}`],
        ]),
      ],
    })
  },
  pendingComponent: ProductSkeleton,
  component: ProductPage,
})

function Gallery({ product }: { product: ProductDetail }) {
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null)
  const images = product.images.length ? product.images : [{ id: 0, url: '', alt: product.name, width: null, height: null }]
  const current = images[Math.min(active, images.length - 1)]!
  return (
    <div>
      {/* Mobile: swipeable */}
      <div className="lg:hidden">
        <Carousel opts={{ loop: images.length > 1 }}>
          <CarouselContent>
            {images.map((img, i) => (
              <CarouselItem key={img.id}>
                <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-muted">
                  <Img src={img.url} alt={img.alt ?? product.name} sizes="100vw" maxWidth={1024} priority={i === 0} className="size-full object-cover" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselDots className="absolute inset-x-0 bottom-4" />
        </Carousel>
      </div>
      {/* Desktop: thumbnails + hover zoom */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-[5rem_1fr]">
        <div className="no-scrollbar flex max-h-[42rem] flex-col gap-3 overflow-y-auto">
          {images.map((img, i) => (
            <button
              key={img.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive(i)}
              className={cn('aspect-square overflow-hidden rounded-xl border-2 transition', i === active ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100')}
              aria-label={`View image ${i + 1}`}
            >
              <Img src={img.url} alt="" sizes="80px" maxWidth={192} className="size-full object-cover" />
            </button>
          ))}
        </div>
        <div
          className="relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-3xl bg-muted"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
          }}
          onMouseLeave={() => setZoom(null)}
        >
          <Img key={current.url} src={current.url} alt={current.alt ?? product.name} sizes="(min-width: 1024px) 45vw, 100vw" maxWidth={1280} priority={active === 0} className="size-full object-cover" />
          {zoom && current.url && (
            <div
              className="pointer-events-none absolute inset-0 bg-no-repeat"
              style={{
                backgroundImage: `url("${optimizedUrl(current.url, 1920, 85)}")`,
                backgroundSize: '220%',
                backgroundPosition: `${zoom.x}% ${zoom.y}%`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewForm({ productId, open, onOpenChange }: { productId: number; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const submit = useMutation({
    mutationFn: () => api.post<{ message: string }>('/me/reviews', { productId, rating, title, body }),
    onSuccess: (r) => {
      toast.success(r.message)
      onOpenChange(false)
      setTitle('')
      setBody('')
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Write a review</DialogTitle>
          <DialogDescription>Tell other shoppers what you think.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => setRating(i)} aria-label={`${i} stars`}>
              <Star className={cn('size-8 transition', i <= rating ? 'fill-gold text-gold' : 'text-muted-foreground/40')} />
            </button>
          ))}
        </div>
        <Field label="Headline">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Beautiful and sturdy" maxLength={140} />
        </Field>
        <Field label="Your review">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="How does it look, feel and wear?" maxLength={2000} />
        </Field>
        <Button onClick={() => submit.mutate()} loading={submit.isPending}>
          Submit review
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function Reviews({ product }: { product: ProductDetail }) {
  const user = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const reviews = useQuery({
    queryKey: ['reviews', product.slug],
    queryFn: () =>
      api.get<Array<{ id: number; rating: number; title: string | null; body: string | null; isVerifiedBuyer: number; createdAt: string; fullName: string; avatarUrl: string | null }>>(
        `/store/products/${product.slug}/reviews`,
      ),
    staleTime: 60_000,
  })
  const total = product.ratingCount
  return (
    <section id="reviews" className="scroll-mt-24 py-16">
      <SectionHeading eyebrow="Reviews" title="What customers say" />
      <div className="grid gap-10 lg:grid-cols-[18rem_1fr]">
        <div className="rounded-3xl border bg-card p-6">
          <p className="font-display text-6xl font-semibold">{total ? product.ratingAvg.toFixed(1) : '—'}</p>
          <Stars value={product.ratingAvg} size={18} className="mt-2" />
          <p className="mt-1 text-sm text-muted-foreground">{total ? `${total} review${total === 1 ? '' : 's'}` : 'No reviews yet'}</p>
          <div className="mt-5 grid gap-1.5">
            {[5, 4, 3, 2, 1].map((r) => {
              const n = product.ratingBreakdown[r] ?? 0
              return (
                <div key={r} className="flex items-center gap-2 text-xs">
                  <span className="w-3">{r}</span>
                  <Star className="size-3 fill-gold text-gold" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
                  </div>
                  <span className="w-5 text-right text-muted-foreground">{n}</span>
                </div>
              )
            })}
          </div>
          <Button variant="outline" className="mt-6 w-full" onClick={() => (user ? setOpen(true) : void navigate({ to: '/login', search: { next: `/p/${product.slug}#reviews` } }))}>
            Write a review
          </Button>
        </div>
        <div className="grid content-start gap-4">
          {reviews.data?.length ? (
            reviews.data.map((r) => (
              <article key={r.id} className="rounded-3xl border bg-card p-6">
                <div className="flex items-center gap-3">
                  <Avatar src={r.avatarUrl} name={r.fullName} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{r.fullName}</p>
                    <p className="text-xs text-muted-foreground">{date(r.createdAt)}</p>
                  </div>
                  {r.isVerifiedBuyer ? (
                    <Badge tone="success">
                      <BadgeCheck className="size-3" /> Verified buyer
                    </Badge>
                  ) : null}
                </div>
                <Stars value={r.rating} className="mt-4" />
                {r.title && <h3 className="mt-2 font-semibold">{r.title}</h3>}
                {r.body && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.body}</p>}
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">Be the first to review the {product.name}.</div>
          )}
        </div>
      </div>
      <ReviewForm productId={product.id} open={open} onOpenChange={setOpen} />
    </section>
  )
}

function ProductPage() {
  const { slug } = Route.useParams()
  const { data: product } = useQuery(productQuery(slug))
  const { data: boot } = useQuery(bootstrapQuery)
  const wishlist = useWishlist()
  const navigate = useNavigate()
  const [variantId, setVariantId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (product) track(product.id, 'view')
    setVariantId(null)
    setQuantity(1)
  }, [product?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const optionGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof product>['variants']>()
    for (const v of product?.variants ?? []) groups.set(v.optionName, [...(groups.get(v.optionName) ?? []), v])
    return [...groups.entries()]
  }, [product])

  if (!product) return <ProductSkeleton />
  const variant = product.variants.find((v) => v.id === variantId) ?? null
  const needsVariant = product.variants.length > 0
  const price = product.price + (variant?.priceAdjustment ?? 0)
  const available = variant ? variant.stock : needsVariant ? product.variants.reduce((s, v) => s + v.stock, 0) : product.stock
  const soldOut = available <= 0
  const saved = wishlist.has(product.id)
  const whatsapp = boot?.store.whatsapp?.replace(/\D/g, '').replace(/^0/, '233')

  const add = (buyNow = false) => {
    if (needsVariant && !variant) {
      toast.error(`Choose a ${optionGroups[0]?.[0].toLowerCase() ?? 'option'} first`)
      return
    }
    cart.add(
      {
        productId: product.id,
        variantId: variant?.id ?? null,
        name: product.name,
        slug: product.slug,
        image: product.images[0]?.url ?? null,
        price,
        variantLabel: variant ? `${variant.optionName}: ${variant.optionValue}` : null,
      },
      quantity,
      { open: !buyNow },
    )
    if (buyNow) void navigate({ to: '/checkout' })
  }

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: product.name, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied')
      }
    } catch {
      // Cancelled.
    }
  }

  return (
    <>
      <Container className="pt-6 pb-4">
        <Breadcrumbs
          items={[
            { label: 'Home', to: '/' },
            ...(product.parentSlug ? [{ label: product.parentName!, to: '/collections/$slug', params: { slug: product.parentSlug } }] : []),
            ...(product.categorySlug ? [{ label: product.categoryName!, to: '/collections/$slug', params: { slug: product.categorySlug } }] : []),
            { label: product.name },
          ]}
        />
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <Gallery product={product} />
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex flex-wrap items-center gap-2">
              {product.categoryName && (
                <Link to="/collections/$slug" params={{ slug: product.categorySlug! }} className="eyebrow hover:underline">
                  {product.categoryName}
                </Link>
              )}
              {product.isNew ? <Badge tone="gold">New in</Badge> : null}
              {product.soldCount >= 3 && (
                <Badge tone="primary">
                  <Zap className="size-3" /> Popular
                </Badge>
              )}
            </div>
            <h1 className="font-display mt-3 text-4xl leading-[1.05] font-semibold sm:text-5xl">{product.name}</h1>
            {product.ratingCount > 0 && (
              <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm">
                <Stars value={product.ratingAvg} /> <span className="text-muted-foreground underline-offset-2 hover:underline">{product.ratingCount} reviews</span>
              </a>
            )}
            <Price price={price} compareAt={product.compareAtPrice ? product.compareAtPrice + (variant?.priceAdjustment ?? 0) : null} size="lg" className="mt-5" />
            {product.shortDescription && <p className="mt-4 leading-relaxed text-muted-foreground">{product.shortDescription}</p>}

            {optionGroups.map(([name, options]) => (
              <div key={name} className="mt-7">
                <p className="mb-3 text-sm font-semibold">
                  {name}: <span className="font-normal text-muted-foreground">{variant?.optionName === name ? variant.optionValue : 'Choose one'}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {options.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setVariantId(o.id === variantId ? null : o.id)}
                      disabled={o.stock <= 0}
                      className={cn(
                        'min-w-14 rounded-full border-2 px-4 py-2 text-sm font-semibold transition',
                        o.id === variantId ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-foreground/40',
                        o.stock <= 0 && 'cursor-not-allowed line-through opacity-40',
                      )}
                    >
                      {o.optionValue}
                      {o.priceAdjustment ? <span className="ml-1 text-xs opacity-70">+{money(o.priceAdjustment, true)}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-7">
              {soldOut ? (
                <p className="text-sm font-semibold text-destructive">Sold out</p>
              ) : available <= 3 ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-crimson">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-crimson opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-crimson" />
                  </span>
                  Only {available} left, order soon
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm font-semibold text-success">
                  <span className="size-2 rounded-full bg-success" /> In stock, ready to ship
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <QuantityStepper value={quantity} onChange={(n) => setQuantity(Math.max(1, n))} max={Math.max(1, Math.min(50, available))} />
              <Button size="lg" className="flex-1" disabled={soldOut} onClick={() => add(false)}>
                <ShoppingBag /> {soldOut ? 'Sold out' : 'Add to bag'}
              </Button>
              <Button variant="outline" size="icon" className="size-12" onClick={() => wishlist.toggle(product.id)} aria-label="Save to wishlist" aria-pressed={saved}>
                <Heart className={cn(saved && 'fill-crimson text-crimson')} />
              </Button>
            </div>
            {!soldOut && (
              <Button size="lg" variant="gold" className="mt-3 w-full" onClick={() => add(true)}>
                Buy it now
              </Button>
            )}
            <div className="mt-4 flex items-center gap-4 text-sm">
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hi Roes Outlet! I'm interested in the ${product.name} (${absoluteUrl(`/p/${product.slug}`)})`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-success hover:underline"
                >
                  <MessageCircle className="size-4" /> Ask on WhatsApp
                </a>
              )}
              <button onClick={share} className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground hover:text-foreground">
                <Share2 className="size-4" /> Share
              </button>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-2 rounded-2xl bg-muted/60 p-4 text-center text-[0.7rem] font-semibold">
              <div className="grid justify-items-center gap-1.5">
                <Truck className="size-5 text-gold" /> Nationwide delivery
              </div>
              <div className="grid justify-items-center gap-1.5">
                <Gift className="size-5 text-gold" /> Gift-ready box
              </div>
              <div className="grid justify-items-center gap-1.5">
                <ShieldCheck className="size-5 text-gold" /> Secure MoMo
              </div>
            </div>

            <Accordion type="multiple" defaultValue={['description']} className="mt-6">
              <AccordionItem value="description">
                <AccordionTrigger>Description</AccordionTrigger>
                <AccordionContent>
                  <div className="rich-content text-muted-foreground" dangerouslySetInnerHTML={{ __html: optimizeHtmlImages(product.description ?? '') }} />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="details">
                <AccordionTrigger>Details</AccordionTrigger>
                <AccordionContent>
                  <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
                    {product.sku && (
                      <>
                        <dt className="text-muted-foreground">SKU</dt>
                        <dd>{product.sku}</dd>
                      </>
                    )}
                    {product.material && (
                      <>
                        <dt className="text-muted-foreground">Material</dt>
                        <dd>{product.material}</dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">For</dt>
                    <dd className="capitalize">{product.gender}</dd>
                    {product.tags.length > 0 && (
                      <>
                        <dt className="text-muted-foreground">Tags</dt>
                        <dd className="flex flex-wrap gap-1.5">
                          {product.tags.map((t) => (
                            <Badge key={t}>{t}</Badge>
                          ))}
                        </dd>
                      </>
                    )}
                  </dl>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="delivery">
                <AccordionTrigger>Delivery & exchanges</AccordionTrigger>
                <AccordionContent className="grid gap-3 text-muted-foreground">
                  <p className="flex gap-2">
                    <Truck className="mt-0.5 size-4 shrink-0 text-gold" /> {boot?.delivery.note}
                  </p>
                  <p className="flex gap-2">
                    <RefreshCcw className="mt-0.5 size-4 shrink-0 text-gold" />
                    <span>
                      Exchanges are welcome within 3 days.{' '}
                      <Link to="/pages/$slug" params={{ slug: 'returns-exchanges' }} className="text-primary underline">
                        Exchange policy
                      </Link>
                    </span>
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <Reviews product={product} />

        {product.related.length > 0 && (
          <section className="py-8">
            <SectionHeading eyebrow="You may also like" title={`More ${product.categoryName?.toLowerCase() ?? 'pieces'}`} link={product.categorySlug ? { to: `/collections/${product.categorySlug}`, label: 'See the collection' } : undefined} />
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
              {product.related.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} source="related" />
              ))}
            </div>
          </section>
        )}
      </Container>

      {/* Mobile sticky buy bar */}
      {!soldOut && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur-xl lg:hidden" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{product.name}</p>
            <p className="font-bold">{money(price)}</p>
          </div>
          <Button onClick={() => add(false)}>
            <ShoppingBag /> Add to bag
          </Button>
        </div>
      )}
    </>
  )
}

function ProductSkeleton() {
  return (
    <Container className="pt-6">
      <Skeleton className="h-3 w-64" />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <Skeleton className="aspect-[4/5] rounded-3xl" />
        <div className="grid content-start gap-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-4/5" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="mt-6 h-12 w-full rounded-full" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    </Container>
  )
}
