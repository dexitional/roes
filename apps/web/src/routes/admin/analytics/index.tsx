import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowDown, ArrowUp, Eye, Flame, Gem, HeartHandshake, MousePointerClick, PackageX, Percent, Search, ShoppingBag, TrendingUp, Users, Wallet } from 'lucide-react'
import { cn } from '@roes/ui'
import { api } from '#/lib/api-client'
import { compact, money, num, percent } from '#/lib/format'
import { Badge, Skeleton } from '#/components/ui/misc'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/overlay'
import { BarsChart, Donut, Funnel, Heatmap, TrendChart } from '#/components/admin/charts'
import { PageHeader, SearchInput, Section, StatCard, StatSkeletons, Table, TableSkeleton, Td, Th } from '#/components/admin/kit'
import { Img } from '#/components/site/image'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' },
]

export const Route = createFileRoute('/admin/analytics/')({
  validateSearch: z.object({ days: z.coerce.number().optional().catch(undefined) }),
  component: Analytics,
})

interface Totals {
  views: number
  visitors: number
  carts: number
  wishlists: number
  checkouts: number
  units: number
  orders: number
  revenue: number
  aov: number
  cartRate: number
  conversionRate: number
}
export interface ProductMetric {
  id: number
  name: string
  slug: string
  image: string | null
  category: string | null
  price: number
  stock: number
  status: string
  views: number
  visitors: number
  carts: number
  wishlists: number
  checkouts: number
  units: number
  revenue: number
  viewToCart: number
  cartToPurchase: number
  conversion: number
  trend: number
}
interface AnalyticsData {
  range: { from: string; to: string; days: number }
  current: Totals
  previous: Totals
  series: Array<{ day: string; views: number; visitors: number; carts: number; units: number; orders: number; revenue: number }>
  funnel: Array<{ stage: string; value: number }>
  categories: Array<{ name: string; views: number; carts: number; units: number; revenue: number }>
  devices: Array<{ device: string; views: number; carts: number }>
  sources: Array<{ source: string; views: number; carts: number }>
  heatmap: Array<{ dow: number; hour: number; views: number }>
  insights: { leaky: Array<ProductMetric>; hiddenGems: Array<ProductMetric>; restock: Array<ProductMetric>; trending: Array<ProductMetric>; unseen: number; activeCount: number }
  searches: { top: Array<{ term: string; searches: number; results: number }>; zero: Array<{ term: string; searches: number }> }
}

const SORTS = [
  ['revenue', 'Revenue'],
  ['units', 'Units sold'],
  ['views', 'Views'],
  ['carts', 'Add to bag'],
  ['conversion', 'Conversion'],
  ['wishlists', 'Wishlisted'],
] as const

function InsightList({ title, description, icon: Icon, tone, items, metric }: { title: string; description: string; icon: typeof Eye; tone: string; items: Array<ProductMetric>; metric: (p: ProductMetric) => React.ReactNode }) {
  return (
    <Section title={title} description={description} actions={<Icon className={cn('size-5', tone)} />}>
      {items.length ? (
        <ul className="grid gap-3">
          {items.map((p) => (
            <li key={p.id}>
              <Link to="/admin/analytics/$productId" params={{ productId: String(p.id) }} className="flex items-center gap-3 rounded-xl transition hover:bg-muted/60">
                <Img src={p.image} alt="" sizes="40px" maxWidth={96} className="size-10 rounded-lg object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.category}</span>
                </span>
                <span className="text-right text-xs">{metric(p)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing to flag in this period.</p>
      )}
    </Section>
  )
}

function ProductTable({ days }: { days: number }) {
  const [sort, setSort] = useState<string>('revenue')
  const [q, setQ] = useState('')
  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['admin', 'analytics', 'products', days, sort, q],
    queryFn: () => api.get<{ data: Array<ProductMetric> }>('/admin/analytics/products', { days, sort, q, limit: 100 }),
    placeholderData: keepPreviousData,
  })
  return (
    <Section
      title="Product performance"
      description="Every product's journey from view to sale. Click a row for its full report."
      actions={<SearchInput value={q} onChange={setQ} placeholder="Find a product" className="w-60" />}
      className="p-0 sm:p-0 [&>div:first-child]:px-5 [&>div:first-child]:pt-5"
    >
      <Table className={cn(isPlaceholderData && 'opacity-60')}>
        <thead>
          <tr>
            <Th>Product</Th>
            {SORTS.map(([key, label]) => (
              <Th key={key} className="cursor-pointer text-right select-none hover:text-foreground" onClick={() => setSort(key)}>
                <span className="inline-flex items-center gap-1">
                  {label} {sort === key && <ArrowDown className="size-3" />}
                </span>
              </Th>
            ))}
            <Th className="text-right">View → bag</Th>
            <Th className="text-right">Trend</Th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={9}>
                <TableSkeleton cols={8} />
              </td>
            </tr>
          ) : (
            data?.data.map((p) => (
              <tr key={p.id} className="hover:bg-muted/40">
                <Td>
                  <Link to="/admin/analytics/$productId" params={{ productId: String(p.id) }} className="flex items-center gap-3">
                    <Img src={p.image} alt="" sizes="40px" maxWidth={96} className="size-10 rounded-lg object-cover" />
                    <span className="min-w-0">
                      <span className="block max-w-56 truncate font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.category} · {money(p.price, true)} · {p.stock} in stock
                      </span>
                    </span>
                  </Link>
                </Td>
                <Td className="text-right font-semibold tabular-nums">{money(p.revenue, true)}</Td>
                <Td className="text-right tabular-nums">{num(p.units)}</Td>
                <Td className="text-right tabular-nums">{num(p.views)}</Td>
                <Td className="text-right tabular-nums">{num(p.carts)}</Td>
                <Td className="text-right tabular-nums">{percent(p.conversion)}</Td>
                <Td className="text-right tabular-nums">{num(p.wishlists)}</Td>
                <Td className="text-right tabular-nums">{percent(p.viewToCart)}</Td>
                <Td className="text-right">
                  {p.trend ? (
                    <span className={cn('inline-flex items-center text-xs font-semibold', p.trend > 0 ? 'text-success' : 'text-destructive')}>
                      {p.trend > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                      {Math.abs(p.trend).toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </Section>
  )
}

function Analytics() {
  const { days = 30 } = Route.useSearch()
  const navigate = useNavigate()
  const { data, isPlaceholderData } = useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => api.get<AnalyticsData>('/admin/analytics', { days }),
    placeholderData: keepPreviousData,
  })
  const c = data?.current
  const p = data?.previous
  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Product analytics"
        description="What shoppers look at, add to their bag and buy, and where to act."
        actions={
          <Tabs value={String(days)} onValueChange={(v) => void navigate({ to: '.', search: { days: Number(v) } })}>
            <TabsList>
              {RANGES.map((r) => (
                <TabsTrigger key={r.days} value={String(r.days)}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />
      <div className={cn('grid gap-6 transition-opacity', isPlaceholderData && 'opacity-60')}>
        {!c || !p ? (
          <>
            <StatSkeletons count={8} />
          </>
        ) : (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Product views" value={compact(c.views)} icon={Eye} current={c.views} previous={p.views} spark={data.series} sparkKey="views" />
            <StatCard label="Unique visitors" value={compact(c.visitors)} icon={Users} current={c.visitors} previous={p.visitors} spark={data.series} sparkKey="visitors" tone="info" />
            <StatCard label="Added to bag" value={compact(c.carts)} icon={ShoppingBag} current={c.carts} previous={p.carts} spark={data.series} sparkKey="carts" tone="gold" />
            <StatCard label="Revenue" value={money(c.revenue, true)} icon={Wallet} current={c.revenue} previous={p.revenue} spark={data.series} sparkKey="revenue" tone="success" />
            <StatCard label="Conversion rate" value={percent(c.conversionRate, 2)} icon={Percent} current={c.conversionRate} previous={p.conversionRate} hint="orders ÷ visitors" />
            <StatCard label="View → bag rate" value={percent(c.cartRate)} icon={MousePointerClick} current={c.cartRate} previous={p.cartRate} tone="gold" />
            <StatCard label="Average order" value={money(c.aov, true)} icon={TrendingUp} current={c.aov} previous={p.aov} tone="info" />
            <StatCard label="Wishlisted" value={num(c.wishlists)} icon={HeartHandshake} current={c.wishlists} previous={p.wishlists} tone="success" />
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <Section title="Shopper activity" description="Views, visitors and add-to-bags per day">
            {data ? (
              <TrendChart
                data={data.series}
                series={{
                  views: { label: 'Views', color: 'var(--chart-1)' },
                  visitors: { label: 'Visitors', color: 'var(--chart-4)' },
                  carts: { label: 'Added to bag', color: 'var(--chart-2)' },
                }}
              />
            ) : (
              <Skeleton className="h-[300px]" />
            )}
          </Section>
          <Section title="Conversion funnel" description="Unique shoppers at each step">
            {data ? <Funnel stages={data.funnel} /> : <Skeleton className="h-64" />}
          </Section>
        </div>

        {data && (
          <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-4">
            <InsightList
              title="Trending"
              description="Views rising fastest vs the previous period"
              icon={Flame}
              tone="text-crimson"
              items={data.insights.trending}
              metric={(m) => <Badge tone="success">+{m.trend.toFixed(0)}%</Badge>}
            />
            <InsightList
              title="Hidden gems"
              description="Convert well but few people see them: feature these"
              icon={Gem}
              tone="text-gold"
              items={data.insights.hiddenGems}
              metric={(m) => <span className="font-semibold text-success">{percent(m.conversion)} conv.</span>}
            />
            <InsightList
              title="Lots of looks, no bags"
              description="High views, few add-to-bags: check price & photos"
              icon={Search}
              tone="text-warning"
              items={data.insights.leaky}
              metric={(m) => (
                <span>
                  {num(m.views)} views
                  <br />
                  <span className="text-destructive">{percent(m.viewToCart)} to bag</span>
                </span>
              )}
            />
            <InsightList
              title="Restock soon"
              description="Selling and nearly gone"
              icon={PackageX}
              tone="text-destructive"
              items={data.insights.restock}
              metric={(m) => <Badge tone={m.stock <= 0 ? 'danger' : 'warning'}>{m.stock <= 0 ? 'Sold out' : `${m.stock} left`}</Badge>}
            />
          </div>
        )}

        <ProductTable days={days} />

        {data && (
          <Tabs defaultValue="categories">
            <TabsList className="mb-4">
              <TabsTrigger value="categories">Collections</TabsTrigger>
              <TabsTrigger value="traffic">Traffic</TabsTrigger>
              <TabsTrigger value="timing">When they shop</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
            </TabsList>
            <TabsContent value="categories">
              <Section title="Collection performance" description="Views and add-to-bags by collection">
                <BarsChart
                  data={data.categories.slice(0, 14)}
                  categoryKey="name"
                  horizontal
                  height={Math.max(260, data.categories.slice(0, 14).length * 34)}
                  series={{ views: { label: 'Views', color: 'var(--chart-1)' }, carts: { label: 'Added to bag', color: 'var(--chart-2)' } }}
                />
              </Section>
            </TabsContent>
            <TabsContent value="traffic">
              <div className="grid gap-6 lg:grid-cols-2">
                <Section title="Devices" description="Product views by device">
                  {data.devices.length ? <Donut data={data.devices.map((d) => ({ name: d.device, value: d.views }))} centerLabel="views" /> : <p className="text-sm text-muted-foreground">No data yet.</p>}
                </Section>
                <Section title="Where shoppers come from" description="First source of each visit">
                  <BarsChart data={data.sources} categoryKey="source" series={{ views: { label: 'Views', color: 'var(--chart-1)' }, carts: { label: 'Added to bag', color: 'var(--chart-2)' } }} height={260} />
                </Section>
              </div>
            </TabsContent>
            <TabsContent value="timing">
              <Section title="Browsing heatmap" description="Product views by day and hour. Post new drops when the grid is darkest.">
                <Heatmap cells={data.heatmap} />
              </Section>
            </TabsContent>
            <TabsContent value="search">
              <div className="grid gap-6 lg:grid-cols-2">
                <Section title="Top searches">
                  {data.searches.top.length ? (
                    <Table>
                      <thead>
                        <tr>
                          <Th>Term</Th>
                          <Th className="text-right">Searches</Th>
                          <Th className="text-right">Results</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.searches.top.map((s) => (
                          <tr key={s.term}>
                            <Td className="font-medium">{s.term}</Td>
                            <Td className="text-right tabular-nums">{s.searches}</Td>
                            <Td className="text-right tabular-nums">{s.results}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">No searches in this period.</p>
                  )}
                </Section>
                <Section title="Searches with no results" description="Demand you aren’t meeting yet: stock it, or add the word to a product’s tags">
                  {data.searches.zero.length ? (
                    <div className="flex flex-wrap gap-2">
                      {data.searches.zero.map((s) => (
                        <Badge key={s.term} tone="danger" className="text-xs">
                          {s.term} · {s.searches}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Every search found something. 🎉</p>
                  )}
                </Section>
              </div>
            </TabsContent>
          </Tabs>
        )}
        {data && data.insights.unseen > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {data.insights.unseen} of {data.insights.activeCount} active products had no views in this period.
          </p>
        )}
      </div>
    </>
  )
}
