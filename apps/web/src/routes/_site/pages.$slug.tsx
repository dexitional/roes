import { createFileRoute, notFound } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '#/lib/api-client'
import { date } from '#/lib/format'
import { optimizeHtmlImages } from '#/lib/image'
import { pageQuery } from '#/lib/queries'
import { breadcrumbJsonLd, clip, pageSeo } from '#/lib/seo'
import { Skeleton } from '#/components/ui/misc'
import { Breadcrumbs, Container } from '#/components/site/section'

export const Route = createFileRoute('/_site/pages/$slug')({
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(pageQuery(params.slug))
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) throw notFound()
      throw err
    }
  },
  head: ({ loaderData: p, params }) =>
    p
      ? pageSeo({
          title: p.seoTitle || p.title,
          description: p.seoDescription || p.excerpt || clip(p.body),
          path: `/pages/${params.slug}`,
          image: p.coverUrl,
          jsonLd: [breadcrumbJsonLd([['Home', '/'], [p.title, `/pages/${params.slug}`]])],
        })
      : {},
  pendingComponent: () => (
    <Container className="max-w-3xl py-16">
      <Skeleton className="h-14 w-2/3" />
      <Skeleton className="mt-8 h-96" />
    </Container>
  ),
  component: Page,
})

function Page() {
  const { slug } = Route.useParams()
  const { data: p } = useQuery(pageQuery(slug))
  if (!p) return null
  return (
    <Container className="max-w-3xl py-12">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: p.title }]} />
      <h1 className="font-display mt-6 text-5xl leading-tight font-semibold sm:text-6xl">{p.title}</h1>
      {p.excerpt && <p className="mt-4 text-lg text-muted-foreground">{p.excerpt}</p>}
      <p className="mt-3 text-xs text-muted-foreground">Updated {date(p.updatedAt)}</p>
      <div className="rich-content mt-10" dangerouslySetInnerHTML={{ __html: optimizeHtmlImages(p.body ?? '') }} />
    </Container>
  )
}
