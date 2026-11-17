import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@roes/ui'
import { categoryQuery, productsQuery } from '#/lib/queries'
import { validateShopSearch } from '#/lib/search'
import { breadcrumbJsonLd, clip, pageSeo } from '#/lib/seo'
import { Skeleton } from '#/components/ui/misc'
import { Img } from '#/components/site/image'
import { Breadcrumbs, Container } from '#/components/site/section'
import { ShopView } from '#/components/site/shop-view'

export const Route = createFileRoute('/_site/collections/$slug')({
  validateSearch: validateShopSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, params, deps }) => {
    const [category] = await Promise.all([
      context.queryClient.ensureQueryData(categoryQuery(params.slug)),
      context.queryClient.ensureQueryData(productsQuery({ ...deps, category: params.slug })),
    ])
    return { category }
  },
  head: ({ loaderData, params, match }) => {
    const c = loaderData?.category
    if (!c) return {}
    const filtered = Object.keys(match.search).some((k) => k !== 'page')
    return pageSeo({
      title: c.seoTitle || `${c.name}: Shop ${c.name} in Ghana`,
      description: c.seoDescription || clip(c.description) || `Shop ${c.name.toLowerCase()} at Roes Outlet.`,
      path: `/collections/${params.slug}`,
      image: c.imageUrl,
      noindex: filtered,
      jsonLd: [
        breadcrumbJsonLd([
          ['Home', '/'],
          ['Shop', '/shop'],
          ...(c.parentSlug ? [[c.parentName, `/collections/${c.parentSlug}`] as [string, string]] : []),
          [c.name, `/collections/${params.slug}`],
        ]),
        { '@context': 'https://schema.org', '@type': 'CollectionPage', name: c.name, description: clip(c.description, 300) },
      ],
    })
  },
  pendingComponent: () => (
    <Container className="pt-10">
      <Skeleton className="h-56 rounded-[2rem]" />
    </Container>
  ),
  component: Collection,
})

function Collection() {
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const { data: c } = useQuery(categoryQuery(slug))
  if (!c) return null
  const chips = c.children?.length ? c.children : c.siblings
  return (
    <Container className="pt-6">
      <ShopView
        key={slug}
        search={search}
        fixedCategory={slug}
        header={
          <>
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/' },
                { label: 'Shop', to: '/shop' },
                ...(c.parentSlug ? [{ label: c.parentName, to: '/collections/$slug', params: { slug: c.parentSlug } }] : []),
                { label: c.name },
              ]}
            />
            <header className="relative mt-5 mb-8 overflow-hidden rounded-[2rem] bg-wine-gradient text-white">
              {c.imageUrl && (
                <Img src={c.imageUrl} alt="" sizes="100vw" maxWidth={1600} priority className="absolute inset-0 size-full object-cover opacity-30 mix-blend-luminosity" />
              )}
              <div className="relative grid gap-6 p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-end">
                <div>
                  {c.tagline && <p className="eyebrow text-gold-light!">{c.tagline}</p>}
                  <h1 className="font-display mt-2 text-5xl leading-none font-semibold sm:text-7xl">{c.name}</h1>
                </div>
                {c.description && <div className="rich-content text-sm text-white/85 [&_a]:text-gold-light" dangerouslySetInnerHTML={{ __html: c.description }} />}
              </div>
            </header>
            {chips?.length > 0 && (
              <div className="no-scrollbar -mt-2 mb-6 flex gap-2 overflow-x-auto">
                {chips.map((s: { slug: string; name: string }) => (
                  <Link
                    key={s.slug}
                    to="/collections/$slug"
                    params={{ slug: s.slug }}
                    className={cn('shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary', s.slug === slug && 'border-primary bg-primary text-primary-foreground hover:text-primary-foreground')}
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            )}
          </>
        }
      />
    </Container>
  )
}
