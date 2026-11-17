import { useRef } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import Autoplay from 'embla-carousel-autoplay'
import { ArrowRight, Instagram, Sparkles } from 'lucide-react'
import { cn } from '@roes/ui'
import { date, money } from '#/lib/format'
import { homeQuery } from '#/lib/queries'
import type { Card } from '#/lib/queries'
import { pageSeo } from '#/lib/seo'
import { Button } from '#/components/ui/button'
import { Carousel, CarouselContent, CarouselDots, CarouselItem, CarouselNext, CarouselPrevious } from '#/components/ui/carousel'
import { Skeleton } from '#/components/ui/misc'
import { Img } from '#/components/site/image'
import { ProductCard, ProductGrid, ProductGridSkeleton } from '#/components/site/product-card'
import { Container, SectionHeading } from '#/components/site/section'

export const Route = createFileRoute('/_site/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  head: () =>
    pageSeo({
      title: 'Roes Outlet | Luxury Jewelry on a Budget in Ghana',
      description:
        'Affordable luxury jewelry delivered across Ghana: luxe earrings from GH₵45, zirconia necklaces, 4-in-1 watch sets, bracelet stacks, brooches and gift-boxed combos.',
      path: '/',
    }),
  pendingComponent: HomeSkeleton,
  component: Home,
})

interface Slide {
  id: number
  eyebrow: string | null
  title: string
  subtitle: string | null
  imageUrl: string
  ctaLabel: string | null
  ctaUrl: string | null
  align: 'left' | 'center' | 'right'
}

function Hero({ slides }: { slides: Array<Slide> }) {
  const autoplay = useRef(Autoplay({ delay: 6000, stopOnInteraction: false, stopOnMouseEnter: true }))
  if (!slides.length) return null
  return (
    <Carousel opts={{ loop: true, duration: 32 }} plugins={[autoplay.current]} className="group">
      <CarouselContent>
        {slides.map((s, i) => (
          <CarouselItem key={s.id}>
            <div className="relative h-[78svh] min-h-[480px] overflow-hidden bg-wine sm:h-[82vh] lg:max-h-[820px]">
              <Img
                src={s.imageUrl}
                alt={s.title}
                sizes="100vw"
                priority={i === 0}
                quality={85}
                className="absolute inset-0 size-full object-cover"
              />
              <div className="absolute inset-0" style={{ background: 'var(--hero-scrim)' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent sm:hidden" />
              <Container className={cn('relative flex h-full flex-col justify-end pb-20 sm:justify-center sm:pb-0', s.align === 'center' && 'items-center text-center', s.align === 'right' && 'items-end text-right')}>
                <div className="max-w-xl text-white animate-fade-up">
                  {s.eyebrow && (
                    <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[0.7rem] font-bold tracking-[0.22em] uppercase backdrop-blur">
                      <Sparkles className="size-3.5 text-gold-light" /> {s.eyebrow}
                    </p>
                  )}
                  <h1 className="font-display text-5xl leading-[0.95] font-semibold sm:text-7xl lg:text-[5.5rem]">{s.title}</h1>
                  {s.subtitle && <p className="mt-5 max-w-md text-base text-white/85 sm:text-lg">{s.subtitle}</p>}
                  {s.ctaUrl && (
                    <div className="mt-8 flex flex-wrap gap-3">
                      <Button asChild variant="gold" size="xl">
                        <a href={s.ctaUrl}>
                          {s.ctaLabel || 'Shop now'} <ArrowRight />
                        </a>
                      </Button>
                      <Button asChild size="xl" variant="outline" className="border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20">
                        <Link to="/shop">Browse all</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </Container>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselDots className="absolute inset-x-0 bottom-6" />
      <div className="absolute right-6 bottom-5 hidden gap-2 opacity-0 transition group-hover:opacity-100 md:flex">
        <CarouselPrevious />
        <CarouselNext />
      </div>
    </Carousel>
  )
}

function CollectionsRail({ collections }: { collections: Array<{ name: string; slug: string; tagline: string | null; imageUrl: string | null; productCount: number }> }) {
  return (
    <section className="py-16 sm:py-20">
      <Container>
        <SectionHeading eyebrow="Shop by collection" title="Find your signature piece" link={{ to: '/shop', label: 'Shop everything' }} />
      </Container>
      <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-10 xl:mx-auto xl:max-w-[88rem]">
        {collections.map((c) => (
          <Link key={c.slug} to="/collections/$slug" params={{ slug: c.slug }} className="group w-40 shrink-0 snap-start sm:w-48">
            <div className="relative aspect-[3/4] overflow-hidden rounded-[1.75rem] bg-muted">
              <Img src={c.imageUrl} alt={c.name} sizes="200px" maxWidth={512} className="size-full object-cover transition duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <p className="font-display text-xl leading-tight font-semibold">{c.name}</p>
                <p className="mt-0.5 text-[0.7rem] text-white/75">{Number(c.productCount)} pieces</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function ProductRail({ title, eyebrow, products, link, source }: { title: string; eyebrow: string; products: Array<Card>; link: { to: string; label: string; search?: Record<string, unknown> }; source: string }) {
  if (!products.length) return null
  return (
    <section className="py-14">
      <Container>
        <Carousel opts={{ align: 'start', slidesToScroll: 'auto', dragFree: true }}>
          <div className="flex items-end justify-between gap-4">
            <SectionHeading eyebrow={eyebrow} title={title} link={link} className="mb-8 flex-1" />
            <div className="mb-8 hidden gap-2 md:flex">
              <CarouselPrevious />
              <CarouselNext />
            </div>
          </div>
          <CarouselContent className="-ml-3 sm:-ml-5">
            {products.map((p) => (
              <CarouselItem key={p.id} className="basis-1/2 pl-3 sm:basis-1/3 sm:pl-5 lg:basis-1/4 xl:basis-1/5">
                <ProductCard product={p} source={source} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </Container>
    </section>
  )
}

function Editorial({ priceFloor, image, stats }: { priceFloor: number; image: string | null; stats: { products: number; collections: number } }) {
  return (
    <section className="py-10">
      <Container>
        <div className="bg-wine-gradient relative grid overflow-hidden rounded-[2rem] text-white lg:grid-cols-2">
          <div className="relative z-10 p-8 sm:p-14">
            <p className="eyebrow text-gold-light!">The Roes promise</p>
            <h2 className="font-display mt-3 text-5xl leading-[0.95] font-semibold sm:text-6xl">
              Luxury, <span className="text-foil italic">on budget.</span>
            </h2>
            <p className="mt-5 max-w-md text-white/80">
              Pieces that look like a splurge and feel like a treat, from {money(priceFloor, true)}. Stainless steel for everyday, gold plate for the moments that
              matter, and a gift box with almost everything.
            </p>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-4 border-t border-white/15 pt-6">
              {[
                [`${Math.floor(stats.products / 10) * 10}+`, 'Pieces'],
                [String(stats.collections), 'Collections'],
                ['16', 'Regions delivered to'],
              ].map(([n, l]) => (
                <div key={l}>
                  <p className="font-display text-3xl text-gold-light">{n}</p>
                  <p className="text-xs text-white/70">{l}</p>
                </div>
              ))}
            </div>
            <Button asChild variant="gold" size="lg" className="mt-8">
              <Link to="/pages/$slug" params={{ slug: 'about' }}>
                Our story <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="relative min-h-72">
            <Img src={image} alt="Roes Outlet jewelry" sizes="(min-width: 1024px) 45vw, 100vw" maxWidth={1280} className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#86012a] via-transparent to-transparent max-lg:bg-gradient-to-b" />
          </div>
        </div>
      </Container>
    </section>
  )
}

function Journal({ posts }: { posts: Array<{ title: string; slug: string; excerpt: string | null; coverUrl: string | null; publishedAt: string }> }) {
  if (!posts.length) return null
  return (
    <section className="py-14">
      <Container>
        <SectionHeading eyebrow="The journal" title="Style notes & care guides" link={{ to: '/journal', label: 'Read the journal' }} />
        <div className="grid gap-6 md:grid-cols-3">
          {posts.map((p, i) => (
            <Link key={p.slug} to="/journal/$slug" params={{ slug: p.slug }} className="group rounded-3xl border bg-card p-6 transition hover:-translate-y-1 hover:shadow-xl">
              {p.coverUrl ? (
                <Img src={p.coverUrl} alt={p.title} sizes="(min-width: 768px) 30vw, 100vw" maxWidth={768} className="mb-5 aspect-[16/10] w-full rounded-2xl object-cover" />
              ) : (
                <div className={cn('mb-5 grid aspect-[16/10] place-items-center rounded-2xl', ['bg-accent', 'bg-gold-soft', 'bg-secondary'][i % 3])}>
                  <span className="font-display text-6xl text-primary/30 italic">R</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">{date(p.publishedAt)}</p>
              <h3 className="font-display mt-2 text-2xl leading-tight font-semibold group-hover:text-primary">{p.title}</h3>
              {p.excerpt && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>}
            </Link>
          ))}
        </div>
      </Container>
    </section>
  )
}

function Home() {
  const { data } = useQuery(homeQuery)
  if (!data) return <HomeSkeleton />
  const editorialImage = (data.bestSellers[0] ?? data.featured[0] ?? data.newest[0])?.image ?? null
  return (
    <>
      <Hero slides={data.slides} />
      <CollectionsRail collections={data.collections} />
      <section className="py-6">
        <Container>
          <SectionHeading eyebrow="Handpicked" title="Featured pieces" description="The styles everyone is asking about this season." link={{ to: '/shop', label: 'Shop all' }} />
          <ProductGrid products={data.featured} source="home" />
        </Container>
      </section>
      <ProductRail eyebrow="Just landed" title="New arrivals" products={data.newest} link={{ to: '/shop', label: 'See what’s new', search: { sort: 'newest' } }} source="home" />
      <Editorial priceFloor={data.priceFloor} image={editorialImage} stats={data.stats} />
      {data.onSale.length > 0 && (
        <ProductRail eyebrow="Limited time" title="On sale now" products={data.onSale} link={{ to: '/shop', label: 'All offers', search: { sale: true } }} source="home" />
      )}
      <section className="py-14">
        <Container>
          <SectionHeading eyebrow="Loved by our customers" title="Best sellers" link={{ to: '/shop', label: 'Most popular', search: { sort: 'popular' } }} />
          <ProductGrid products={data.bestSellers} source="home" />
        </Container>
      </section>
      <Journal posts={data.posts} />
      <section className="pt-8">
        <Container>
          <div className="flex flex-col items-center gap-5 rounded-[2rem] border bg-card px-6 py-14 text-center">
            <Instagram className="size-8 text-primary" />
            <h2 className="font-display text-4xl font-semibold sm:text-5xl">Wear it. Tag it. #RoesOutlet</h2>
            <p className="max-w-lg text-muted-foreground">Follow @roes_outlet for new drops, styling ideas and restocks before anyone else.</p>
            <Button asChild variant="outline" size="lg">
              <a href="https://instagram.com/roes_outlet" target="_blank" rel="noopener noreferrer">
                Follow on Instagram
              </a>
            </Button>
          </div>
        </Container>
      </section>
    </>
  )
}

function HomeSkeleton() {
  return (
    <>
      <Skeleton className="h-[78svh] min-h-[480px] rounded-none sm:h-[82vh] lg:max-h-[820px]" />
      <Container className="py-16">
        <Skeleton className="mb-8 h-10 w-80" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-48 shrink-0 rounded-[1.75rem]" />
          ))}
        </div>
        <Skeleton className="mt-16 mb-8 h-10 w-64" />
        <ProductGridSkeleton />
      </Container>
    </>
  )
}
