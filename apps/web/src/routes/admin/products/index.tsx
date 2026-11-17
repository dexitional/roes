import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Archive, BarChart3, CheckCircle2, ExternalLink, FileEdit, MoreHorizontal, Package, Plus, Star, StarOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@roes/ui'
import { api, errorMessage } from '#/lib/api-client'
import type { Page } from '#/lib/api-client'
import { money, num, relative } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Badge, Card, Checkbox } from '#/components/ui/misc'
import { NativeSelect } from '#/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tabs, TabsList, TabsTrigger } from '#/components/ui/overlay'
import { Confirm, EmptyState, PageHeader, Pager, SearchInput, Table, TableSkeleton, Td, Th } from '#/components/admin/kit'
import { SeoScore } from '#/components/admin/seo-panel'
import { Img } from '#/components/site/image'

const search = z.object({
  q: z.string().optional().catch(undefined),
  status: z.string().optional().catch(undefined),
  categoryId: z.coerce.number().optional().catch(undefined),
  stock: z.enum(['low', 'out']).optional().catch(undefined),
  seo: z.literal('missing').optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
  page: z.coerce.number().optional().catch(undefined),
})
type Search = z.infer<typeof search>

export const Route = createFileRoute('/admin/products/')({ validateSearch: search, component: Products })

interface Row {
  id: number
  name: string
  slug: string
  sku: string | null
  price: number
  compareAtPrice: number | null
  stock: number
  status: 'active' | 'draft' | 'archived'
  isFeatured: number
  viewCount: number
  soldCount: number
  seoTitle: string | null
  seoDescription: string | null
  updatedAt: string
  categoryName: string | null
  image: string | null
  imageCount: number
}

function Products() {
  const s = Route.useSearch()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Array<number>>([])
  const [confirmDelete, setConfirmDelete] = useState<Array<number> | null>(null)
  const set = (patch: Partial<Search>) => void navigate({ to: '.', search: (prev: Search) => ({ ...prev, ...patch, page: patch.page }) })
  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['admin', 'products', s],
    queryFn: () => api.get<Page<Row> & { counts: Record<string, number> }>('/admin/products', s),
    placeholderData: keepPreviousData,
  })
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api.get<Array<{ id: number; name: string; parentId: number | null }>>('/admin/categories') })
  const bulk = useMutation({
    mutationFn: (body: { ids: Array<number>; action: string; categoryId?: number }) => api.post('/admin/products/bulk', body),
    onSuccess: () => {
      toast.success('Products updated')
      setSelected([])
      setConfirmDelete(null)
      void qc.invalidateQueries({ queryKey: ['admin', 'products'] })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const rows = data?.data ?? []
  const allOn = rows.length > 0 && rows.every((r) => selected.includes(r.id))
  const total = Object.values(data?.counts ?? {}).reduce((a, b) => a + b, 0)

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description={`${num(total)} products in your catalogue`}
        actions={
          <Button asChild>
            <Link to="/admin/products/$productId" params={{ productId: 'new' }}>
              <Plus /> Add product
            </Link>
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <Tabs value={s.status ?? 'all'} onValueChange={(v) => set({ status: v === 'all' ? undefined : v })}>
            <TabsList>
              <TabsTrigger value="all">All {total ? <span className="text-xs opacity-60">{total}</span> : null}</TabsTrigger>
              {(['active', 'draft', 'archived'] as const).map((st) => (
                <TabsTrigger key={st} value={st} className="capitalize">
                  {st} {data?.counts[st] ? <span className="text-xs opacity-60">{data.counts[st]}</span> : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <SearchInput value={s.q ?? ''} onChange={(q) => set({ q: q || undefined })} placeholder="Search name, SKU…" className="w-full sm:w-64" />
          <NativeSelect className="w-auto" value={s.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">All collections</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? '— ' : ''}
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect className="w-auto" value={s.stock ?? s.seo ?? ''} onChange={(e) => set({ stock: (['low', 'out'].includes(e.target.value) ? e.target.value : undefined) as Search['stock'], seo: e.target.value === 'missing' ? 'missing' : undefined })}>
            <option value="">Any stock / SEO</option>
            <option value="low">Low stock (1–3)</option>
            <option value="out">Sold out</option>
            <option value="missing">Missing SEO</option>
          </NativeSelect>
          <NativeSelect className="ml-auto w-auto" value={s.sort ?? 'newest'} onChange={(e) => set({ sort: e.target.value })}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="price-desc">Price high–low</option>
            <option value="price-asc">Price low–high</option>
            <option value="stock">Lowest stock</option>
            <option value="popular">Most viewed</option>
            <option value="sales">Best selling</option>
          </NativeSelect>
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-4 py-2.5 text-sm animate-in fade-in">
            <span className="font-semibold">{selected.length} selected</span>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate({ ids: selected, action: 'activate' })}>
              <CheckCircle2 /> Publish
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate({ ids: selected, action: 'draft' })}>
              <FileEdit /> Draft
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate({ ids: selected, action: 'feature' })}>
              <Star /> Feature
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate({ ids: selected, action: 'unfeature' })}>
              <StarOff /> Unfeature
            </Button>
            <NativeSelect
              className="h-8 w-auto text-xs"
              value=""
              onChange={(e) => e.target.value && bulk.mutate({ ids: selected, action: 'category', categoryId: Number(e.target.value) })}
            >
              <option value="">Move to collection…</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate({ ids: selected, action: 'archive' })}>
              <Archive /> Archive
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(selected)}>
              <Trash2 /> Delete
            </Button>
          </div>
        )}
        {isLoading ? (
          <TableSkeleton cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Package} title="No products found" description="Try a different filter, or add your first product." />
        ) : (
          <Table className={cn(isPlaceholderData && 'opacity-60')}>
            <thead>
              <tr>
                <Th className="w-10">
                  <Checkbox checked={allOn} onCheckedChange={(v) => setSelected(v ? rows.map((r) => r.id) : [])} aria-label="Select all" />
                </Th>
                <Th>Product</Th>
                <Th>Status</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Stock</Th>
                <Th className="text-right">Views</Th>
                <Th className="text-right">Sold</Th>
                <Th>SEO</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                // Quick list-level SEO health; the editor shows the full score.
                const seoParts = [Boolean(r.seoTitle), (r.seoDescription ?? '').length >= 110, Number(r.imageCount) >= 2]
                const score = Math.round((seoParts.filter(Boolean).length / seoParts.length) * 100)
                return (
                  <tr key={r.id} className={cn('hover:bg-muted/40', selected.includes(r.id) && 'bg-primary/5')}>
                    <Td>
                      <Checkbox checked={selected.includes(r.id)} onCheckedChange={(v) => setSelected((sel) => (v ? [...sel, r.id] : sel.filter((x) => x !== r.id)))} aria-label={`Select ${r.name}`} />
                    </Td>
                    <Td>
                      <Link to="/admin/products/$productId" params={{ productId: String(r.id) }} className="flex items-center gap-3">
                        <Img src={r.image} alt="" sizes="44px" maxWidth={96} className="size-11 rounded-lg object-cover" />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="max-w-64 truncate">{r.name}</span>
                            {r.isFeatured ? <Star className="size-3.5 shrink-0 fill-gold text-gold" /> : null}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {r.categoryName ?? 'No collection'} · {r.sku ?? 'no SKU'} · updated {relative(r.updatedAt)}
                          </span>
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={r.status === 'active' ? 'success' : r.status === 'draft' ? 'warning' : 'neutral'} dot className="capitalize">
                        {r.status}
                      </Badge>
                    </Td>
                    <Td className="text-right tabular-nums">
                      <span className="font-semibold">{money(r.price)}</span>
                      {r.compareAtPrice ? <span className="block text-xs text-muted-foreground line-through">{money(r.compareAtPrice)}</span> : null}
                    </Td>
                    <Td className={cn('text-right font-semibold tabular-nums', r.stock <= 0 ? 'text-destructive' : r.stock <= 3 && 'text-warning')}>{r.stock}</Td>
                    <Td className="text-right tabular-nums">{num(r.viewCount)}</Td>
                    <Td className="text-right tabular-nums">{num(r.soldCount)}</Td>
                    <Td>
                      <SeoScore score={score} className="size-9 text-[0.65rem]" />
                    </Td>
                    <Td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Actions">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem asChild>
                            <Link to="/admin/products/$productId" params={{ productId: String(r.id) }}>
                              <FileEdit /> Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/admin/analytics/$productId" params={{ productId: String(r.id) }}>
                              <BarChart3 /> Analytics
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={`/p/${r.slug}`} target="_blank">
                              <ExternalLink /> View in store
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive onSelect={() => setConfirmDelete([r.id])}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => set({ page })} />}
      </Card>
      <Confirm
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.length ?? 0} product${confirmDelete?.length === 1 ? '' : 's'}?`}
        description="Products that have been ordered are archived instead, so your order history stays intact."
        confirmLabel="Delete"
        destructive
        loading={bulk.isPending}
        onConfirm={() => confirmDelete && bulk.mutate({ ids: confirmDelete, action: 'delete' })}
      />
    </>
  )
}
