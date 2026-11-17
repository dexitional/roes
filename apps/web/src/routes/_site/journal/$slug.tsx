import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '#/lib/api-client'
import { date } from '#/lib/format'
import { optimizeHtmlImages } from '#/lib/image'
import { postQuery } from '#/lib/queries'
import { SITE_NAME, absoluteUrl, breadcrumbJsonLd, clip, pageSeo, shareImage } from '#/lib/seo'
import { Skeleton } from '#/components/ui/misc'
import { Img } from '#/components/site/image'
import { Breadcrumbs, Container } from '#/components/site/section'

export const Route = createFileRoute('/_site/journal/$slug')({
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(postQuery(params.slug))
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
          path: `/journal/${params.slug}`,
          image: p.coverUrl,
          type: 'article',
          jsonLd: [
            {
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: p.title,
              description: p.excerpt ?? clip(p.body),
              image: absoluteUrl(shareImage(p.coverUrl)),
              datePublished: p.publishedAt,
              dateModified: p.updatedAt,
              author: { '@type': 'Organization', name: SITE_NAME },
              publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: absoluteUrl('/logo.png') } },
              mainEntityOfPage: absoluteUrl(`/journal/${params.slug}`),
            },
            breadcrumbJsonLd([
              ['Home', '/'],
              ['Journal', '/journal'],
              [p.title, `/journal/${params.slug}`],
            ]),
          ],
        })
      : {},
  pendingComponent: () => (
    <Container className="max-w-3xl py-16">
      <Skeleton className="h-14 w-2/3" />
      <Skeleton className="mt-8 h-96" />
    </Container>
  ),
  component: Post,
})

function Post() {
  const { slug } = Route.useParams()
  const { data: p } = useQuery(postQuery(slug))
  if (!p) return null
  return (
    <article>
      <Container className="max-w-3xl py-12">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Journal', to: '/journal' }, { label: p.title }]} />
        <p className="mt-8 text-sm text-muted-foreground">{date(p.publishedAt, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <h1 className="font-display mt-2 text-5xl leading-[1.05] font-semibold sm:text-6xl">{p.title}</h1>
        {p.excerpt && <p className="mt-5 text-xl text-muted-foreground">{p.excerpt}</p>}
      </Container>
      {p.coverUrl && (
        <Container className="max-w-5xl">
          <Img src={p.coverUrl} alt={p.title} sizes="(min-width: 1024px) 960px, 100vw" maxWidth={1600} priority className="aspect-[16/8] w-full rounded-[2rem] object-cover" />
        </Container>
      )}
      <Container className="max-w-3xl py-12">
        <div className="rich-content" dangerouslySetInnerHTML={{ __html: optimizeHtmlImages(p.body ?? '') }} />
        {p.more?.length > 0 && (
          <aside className="mt-16 border-t pt-10">
            <p className="eyebrow mb-4">Keep reading</p>
            <ul className="grid gap-4">
              {p.more.map((m: { slug: string; title: string; excerpt: string | null }) => (
                <li key={m.slug}>
                  <Link to="/journal/$slug" params={{ slug: m.slug }} className="font-display text-2xl hover:text-primary">
                    {m.title}
                  </Link>
                  {m.excerpt && <p className="text-sm text-muted-foreground">{m.excerpt}</p>}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </Container>
    </article>
  )
}
