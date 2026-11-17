import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowLeft, ExternalLink, Eye, Heart, Pencil, Percent, ShoppingBag, Trophy, Wallet } from 'lucide-react'
import { api } from '#/lib/api-client'
import { money, num, percent } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/misc'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/overlay'
import { BarsChart, Donut, Funnel, TrendChart } from '#/components/admin/charts'
import { PageHeader, Section, StatCard, StatSkeletons } from '#/components/admin/kit'
import { Img } from '#/components/site/image'

export const Route = createFileRoute('/admin/analytics/$productId')({
  validateSearch: z.object({ days: z.coerce.number().optional().catch(undefined) }),
  component: ProductReport,
})

interface Report {
  product: { id: number; name: string; slug: string; price: number; stock: number; soldCount: number; viewCount: number; ratingAvg: number; ratingCount: number; category: string | null; image: string | null }
  totals: { views: number; visitors: number; carts: number; wishlists: number; units: number; revenue: number; viewToCart: number; conversion: number }
  rank: { position: number; total: number }
  series: Array<{ day: string; views: number; carts: number; units: number; revenue: number }>
  sources: Array<{ source: string; views: number }>
  devices: Array<{ device: string; views: number }>
}

function ProductReport() {
  const { productId } = Route.useParams()
  const { days = 30 } = Route.useSearch()
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: ['admin', 'analytics', 'product', productId, days],
    queryFn: () => api.get<Report>(`/admin/analytics/products/${productId}`, { days }),
    placeholderData: keepPreviousData,
  })
  const t = data?.totals
  return (
    <>
      <Link to="/admin/analytics" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Product analytics
      </Link>
      <PageHeader
        title={
          data ? (
            <span className="flex items-center gap-3">
              <Img src={data.product.image} alt="" sizes="48px" maxWidth={96} className="size-12 rounded-xl object-cover" />
              {data.product.name}
            </span>
          ) : (
            <Skeleton className="h-10 w-72" />
          )
        }
        description={data ? `${data.product.category ?? 'Uncategorised'} · ${money(data.product.price)} · ${data.product.stock} in stock · ${num(data.product.soldCount)} sold all-time` : undefined}
        actions={
          <>
            <Tabs value={String(days)} onValueChange={(v) => void navigate({ to: '.', search: { days: Number(v) } })}>
              <TabsList>
                {[7, 30, 90, 365].map((d) => (
                  <TabsTrigger key={d} value={String(d)}>
                    {d === 365 ? '12 months' : `${d} days`}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {data && (
              <>
                <Button variant="outline" asChild>
                  <a href={`/p/${data.product.slug}`} target="_blank">
                    <ExternalLink /> View
                  </a>
                </Button>
                <Button asChild>
                  <Link to="/admin/products/$productId" params={{ productId }}>
                    <Pencil /> Edit
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />
      {!t || !data ? (
        <StatSkeletons count={6} />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Views" value={num(t.views)} icon={Eye} spark={data.series} sparkKey="views" hint={`${num(t.visitors)} visitors`} />
          <StatCard label="Added to bag" value={num(t.carts)} icon={ShoppingBag} tone="gold" spark={data.series} sparkKey="carts" />
          <StatCard label="Units sold" value={num(t.units)} icon={Trophy} tone="success" spark={data.series} sparkKey="units" />
          <StatCard label="Revenue" value={money(t.revenue, true)} icon={Wallet} tone="success" />
          <StatCard label="Conversion" value={percent(t.conversion)} icon={Percent} tone="info" hint={`${percent(t.viewToCart)} view → bag`} />
          <StatCard label="Wishlisted" value={num(t.wishlists)} icon={Heart} hint={data.rank.position ? `#${data.rank.position} of ${data.rank.total} by views` : undefined} />
        </div>
      )}
      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Section title="Daily performance">
          {data ? (
            <TrendChart
              data={data.series}
              series={{ views: { label: 'Views', color: 'var(--chart-1)' }, carts: { label: 'Added to bag', color: 'var(--chart-2)' }, units: { label: 'Units sold', color: 'var(--chart-5)' } }}
            />
          ) : (
            <Skeleton className="h-[300px]" />
          )}
        </Section>
        <Section title="Funnel">
          {t ? (
            <Funnel
              stages={[
                { stage: 'Viewed', value: t.views },
                { stage: 'Added to bag', value: t.carts },
                { stage: 'Sold', value: t.units },
              ]}
            />
          ) : (
            <Skeleton className="h-48" />
          )}
        </Section>
      </div>
      {data && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Section title="Traffic sources">
            {data.sources.length ? (
              <BarsChart data={data.sources} categoryKey="source" series={{ views: { label: 'Views', color: 'var(--chart-1)' } }} height={240} />
            ) : (
              <p className="text-sm text-muted-foreground">No views in this period.</p>
            )}
          </Section>
          <Section title="Devices">
            {data.devices.length ? <Donut data={data.devices.map((d) => ({ name: d.device, value: d.views }))} centerLabel="views" /> : <p className="text-sm text-muted-foreground">No views in this period.</p>}
          </Section>
        </div>
      )}
    </>
  )
}
