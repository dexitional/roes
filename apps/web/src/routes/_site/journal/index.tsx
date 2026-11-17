import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { date } from '#/lib/format'
import { journalQuery } from '#/lib/queries'
import { pageSeo } from '#/lib/seo'
import { Img } from '#/components/site/image'
import { Container } from '#/components/site/section'

export const Route = createFileRoute('/_site/journal/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(journalQuery),
  head: () =>
    pageSeo({
      title: 'The Journal: Jewelry Style Guides & Care Tips',
      description: 'Styling ideas, gift guides and jewelry care tips from Roes Outlet.',
      path: '/journal',
    }),
  component: Journal,
})

function Journal() {
  const { data: posts = [] } = useQuery(journalQuery)
  return (
    <Container className="py-12">
      <p className="eyebrow">The journal</p>
      <h1 className="font-display mt-2 text-5xl font-semibold sm:text-6xl">Style notes & care guides</h1>
      <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <Link key={p.slug} to="/journal/$slug" params={{ slug: p.slug }} className="group">
            {p.coverUrl ? (
              <Img src={p.coverUrl} alt={p.title} sizes="(min-width: 1024px) 30vw, 100vw" maxWidth={768} className="aspect-[16/10] w-full rounded-3xl object-cover" />
            ) : (
              <div className="bg-wine-gradient grid aspect-[16/10] place-items-center rounded-3xl">
                <span className="font-display text-7xl text-gold-light/50 italic">R</span>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">{date(p.publishedAt)}</p>
            <h2 className="font-display mt-1 text-3xl leading-tight font-semibold group-hover:text-primary">{p.title}</h2>
            {p.excerpt && <p className="mt-2 text-sm text-muted-foreground">{p.excerpt}</p>}
          </Link>
        ))}
      </div>
    </Container>
  )
}
