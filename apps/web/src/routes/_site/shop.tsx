import { createFileRoute } from '@tanstack/react-router'
import { productsQuery } from '#/lib/queries'
import { validateShopSearch } from '#/lib/search'
import { breadcrumbJsonLd, pageSeo } from '#/lib/seo'
import { Container } from '#/components/site/section'
import { ShopView } from '#/components/site/shop-view'

export const Route = createFileRoute('/_site/shop')({
  validateSearch: validateShopSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(productsQuery(deps)),
  head: ({ match }) => {
    const s = match.search
    const filtered = Object.keys(s).some((k) => k !== 'page')
    const title = s.q ? `Search results for “${s.q}”` : s.sale ? 'Jewelry on Sale' : s.sort === 'newest' ? 'New Arrivals' : 'Shop All Jewelry'
    return pageSeo({
      title,
      description: s.q
        ? `Jewelry matching “${s.q}” at Roes Outlet. Nationwide delivery across Ghana.`
        : 'Browse every piece at Roes Outlet: luxe earrings, necklaces, bracelet and watch sets, brooches, anklets and gift-boxed combos, delivered across Ghana.',
      path: s.page && s.page > 1 && !filtered ? `/shop?page=${s.page}` : '/shop',
      // Filtered and searched views are duplicates of /shop for search engines.
      noindex: filtered,
      jsonLd: [breadcrumbJsonLd([['Home', '/'], ['Shop', '/shop']])],
    })
  },
  component: Shop,
})

function Shop() {
  const search = Route.useSearch()
  const title = search.q ? (
    <>
      Results for <span className="italic text-primary">“{search.q}”</span>
    </>
  ) : search.sale ? (
    'On sale'
  ) : search.sort === 'newest' ? (
    'New arrivals'
  ) : (
    'Shop all jewelry'
  )
  return (
    <Container className="pt-10">
      <ShopView
        search={search}
        header={
          <div className="mb-8">
            <p className="eyebrow">Roes Outlet</p>
            <h1 className="font-display mt-2 text-5xl font-semibold sm:text-6xl">{title}</h1>
          </div>
        }
      />
    </Container>
  )
}
