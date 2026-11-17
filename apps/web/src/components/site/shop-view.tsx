import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@roes/ui'
import { money } from '#/lib/format'
import { SORT_OPTIONS } from '#/lib/labels'
import { bootstrapQuery, productsQuery } from '#/lib/queries'
import type { ShopSearch } from '#/lib/queries'
import { Button } from '#/components/ui/button'
import { Slider, Switch } from '#/components/ui/misc'
import { Dialog, SheetContent } from '#/components/ui/overlay'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { ProductGrid, ProductGridSkeleton } from './product-card'

type Update = (patch: Partial<ShopSearch>) => void

function PriceFilter({ search, update, range }: { search: ShopSearch; update: Update; range: { min: number; max: number } }) {
  const [value, setValue] = useState<[number, number]>([search.min ?? range.min, search.max ?? range.max])
  useEffect(() => setValue([search.min ?? range.min, search.max ?? range.max]), [search.min, search.max, range.min, range.max])
  return (
    <div>
      <Slider
        min={range.min}
        max={range.max}
        step={5}
        value={value}
        onValueChange={(v) => setValue([v[0]!, v[1]!])}
        onValueCommit={(v) => update({ min: v[0] === range.min ? undefined : v[0], max: v[1] === range.max ? undefined : v[1] })}
        aria-label="Price range"
      />
      <div className="mt-2 flex justify-between text-xs font-semibold text-muted-foreground tabular-nums">
        <span>{money(value[0], true)}</span>
        <span>{money(value[1], true)}</span>
      </div>
    </div>
  )
}

function Filters({ search, update, fixedCategory, facets }: { search: ShopSearch; update: Update; fixedCategory?: string; facets?: { materials: Array<{ value: string; count: number }>; priceRange: { min: number; max: number } } }) {
  const { data: boot } = useQuery(bootstrapQuery)
  const roots = (boot?.categories ?? []).filter((c) => !c.parentId)
  return (
    <div className="grid gap-8">
      {!fixedCategory && (
        <div>
          <p className="eyebrow mb-3">Collection</p>
          <ul className="grid gap-0.5">
            <li>
              <button onClick={() => update({ category: undefined })} className={cn('w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-muted', !search.category && 'bg-accent font-semibold text-accent-foreground')}>
                All jewelry
              </button>
            </li>
            {roots.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => update({ category: c.slug })}
                  className={cn('flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-muted', search.category === c.slug && 'bg-accent font-semibold text-accent-foreground')}
                >
                  {c.name}
                  <span className="text-xs text-muted-foreground">{c.productCount}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {facets && facets.priceRange.max > facets.priceRange.min && (
        <div>
          <p className="eyebrow mb-4">Price</p>
          <PriceFilter search={search} update={update} range={facets.priceRange} />
        </div>
      )}
      {facets && facets.materials.length > 0 && (
        <div>
          <p className="eyebrow mb-3">Material</p>
          <div className="flex flex-wrap gap-2">
            {facets.materials.map((m) => (
              <button
                key={m.value}
                onClick={() => update({ material: search.material === m.value ? undefined : m.value })}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                  search.material === m.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-foreground/30',
                )}
              >
                {m.value} <span className="opacity-60">{m.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-3.5">
        <p className="eyebrow">Show only</p>
        {(
          [
            ['sale', 'On sale'],
            ['instock', 'In stock'],
            ['new', 'New arrivals'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center justify-between text-sm">
            {label}
            <Switch checked={Boolean(search[key])} onCheckedChange={(v) => update({ [key]: v || undefined })} />
          </label>
        ))}
      </div>
    </div>
  )
}

function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  const list = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
  return (
    <nav className="mt-14 flex items-center justify-center gap-1.5" aria-label="Pagination">
      <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <ChevronLeft />
      </Button>
      {list.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - list[i - 1]! > 1 && <span className="px-1 text-muted-foreground">…</span>}
          <Button variant={p === page ? 'default' : 'ghost'} size="icon" onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined}>
            {p}
          </Button>
        </span>
      ))}
      <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
        <ChevronRight />
      </Button>
    </nav>
  )
}

export function ShopView({ search, fixedCategory, header }: { search: ShopSearch; fixedCategory?: string; header?: React.ReactNode }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const effective = { ...search, category: fixedCategory ?? search.category }
  const query = useQuery({ ...productsQuery(effective), placeholderData: keepPreviousData })
  const data = query.data
  const pages = data ? Math.ceil(data.total / data.pageSize) : 0
  const page = search.page ?? 1

  // Prefetch the next page so "Next" is instant.
  useEffect(() => {
    if (data && page < pages) void qc.prefetchQuery(productsQuery({ ...effective, page: page + 1 }))
  }, [data, page, pages]) // eslint-disable-line react-hooks/exhaustive-deps

  const update: Update = (patch) => {
    void navigate({
      to: '.',
      search: (prev: ShopSearch) => {
        const next: Record<string, unknown> = { ...prev, ...patch, page: patch.page ?? undefined }
        for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === '' || next[k] === false) delete next[k]
        return next as ShopSearch
      },
      resetScroll: patch.page !== undefined,
      replace: patch.page === undefined,
    })
  }

  const active: Array<[string, Partial<ShopSearch>]> = []
  if (search.q) active.push([`“${search.q}”`, { q: undefined }])
  if (!fixedCategory && search.category) active.push([search.category.replace(/-/g, ' '), { category: undefined }])
  if (search.min !== undefined || search.max !== undefined) active.push([`${money(search.min ?? 0, true)} – ${money(search.max ?? data?.facets.priceRange.max ?? 0, true)}`, { min: undefined, max: undefined }])
  if (search.material) active.push([search.material, { material: undefined }])
  if (search.sale) active.push(['On sale', { sale: undefined }])
  if (search.instock) active.push(['In stock', { instock: undefined }])
  if (search.new) active.push(['New', { new: undefined }])

  return (
    <div>
      {header}
      <div className="sticky top-[4.5rem] z-30 -mx-4 mb-6 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal /> Filters {active.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[0.65rem] text-primary-foreground">{active.length}</span>}
        </Button>
        <p className="hidden text-sm text-muted-foreground sm:block">
          {data ? (
            <>
              <span className="font-semibold text-foreground">{data.total}</span> {data.total === 1 ? 'piece' : 'pieces'}
            </>
          ) : (
            'Loading…'
          )}
        </p>
        <div className="no-scrollbar hidden flex-1 gap-2 overflow-x-auto md:flex">
          {active.map(([label, patch]) => (
            <button key={label} onClick={() => update(patch)} className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground capitalize">
              {label} <X className="size-3" />
            </button>
          ))}
        </div>
        <div className="ml-auto w-48">
          <Select value={search.sort ?? (search.q ? 'relevance' : 'featured')} onValueChange={(v) => update({ sort: v === 'featured' || v === 'relevance' ? undefined : v })}>
            <SelectTrigger className="h-9" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {search.q && <SelectItem value="relevance">Best match</SelectItem>}
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[15rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-36">
            <Filters search={search} update={update} fixedCategory={fixedCategory} facets={data?.facets} />
          </div>
        </aside>
        <div className={cn('transition-opacity', query.isPlaceholderData && 'opacity-60')}>
          {!data ? (
            <ProductGridSkeleton count={12} className="lg:grid-cols-3 xl:grid-cols-4" />
          ) : data.data.length === 0 ? (
            <div className="rounded-3xl border border-dashed px-6 py-20 text-center">
              <h2 className="font-display text-3xl">Nothing matches just yet</h2>
              <p className="mt-2 text-muted-foreground">Try removing a filter or searching for something else.</p>
              <Button className="mt-6" variant="outline" asChild>
                <Link to="/shop">Clear all filters</Link>
              </Button>
            </div>
          ) : (
            <>
              <ProductGrid products={data.data} className="lg:grid-cols-3 xl:grid-cols-4" source={search.q ? 'search' : fixedCategory ? 'category' : 'internal'} priorityCount={4} />
              <Pagination page={page} pages={pages} onPage={(p) => update({ page: p > 1 ? p : undefined })} />
            </>
          )}
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" title="Filters">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-lg font-bold">Filters</h2>
            <button className="text-sm font-semibold text-primary" onClick={() => update({ min: undefined, max: undefined, material: undefined, sale: undefined, instock: undefined, new: undefined, category: undefined })}>
              Clear all
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-6">
            <Filters search={search} update={update} fixedCategory={fixedCategory} facets={data?.facets} />
          </div>
          <div className="border-t p-4">
            <Button className="w-full" size="lg" onClick={() => setFiltersOpen(false)}>
              Show {data?.total ?? ''} pieces
            </Button>
          </div>
        </SheetContent>
      </Dialog>
    </div>
  )
}
