import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, FolderTree, Plus, Star } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { Button } from '#/components/ui/button'
import { Badge, Card } from '#/components/ui/misc'
import { EmptyState, PageHeader, Table, TableSkeleton, Td, Th } from '#/components/admin/kit'
import { Img } from '#/components/site/image'

export const Route = createFileRoute('/admin/categories/')({ component: Categories })

interface Row {
  id: number
  parentId: number | null
  name: string
  slug: string
  tagline: string | null
  imageUrl: string | null
  isFeatured: number
  isActive: number
  productCount: number
  parentName: string | null
  seoDescription: string | null
}

function Categories() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api.get<Array<Row>>('/admin/categories') })
  const reorder = useMutation({
    mutationFn: (ids: Array<number>) => api.post('/admin/categories/reorder', { ids }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'categories'] }),
    onError: (err) => toast.error(errorMessage(err)),
  })
  const rows = data ?? []
  const move = (i: number, d: number) => {
    const ids = rows.map((r) => r.id)
    const j = i + d
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    qc.setQueryData(['admin', 'categories'], ids.map((id) => rows.find((r) => r.id === id)))
    reorder.mutate(ids)
  }
  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Collections"
        description="Group products into collections. Each one gets its own SEO landing page."
        actions={
          <Button asChild>
            <Link to="/admin/categories/$categoryId" params={{ categoryId: 'new' }}>
              <Plus /> New collection
            </Link>
          </Button>
        }
      />
      <Card className="overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : !rows.length ? (
          <EmptyState icon={FolderTree} title="No collections yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-20">Order</Th>
                <Th>Collection</Th>
                <Th>Parent</Th>
                <Th className="text-right">Products</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <Td>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                        <ArrowUp />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down">
                        <ArrowDown />
                      </Button>
                    </div>
                  </Td>
                  <Td>
                    <Link to="/admin/categories/$categoryId" params={{ categoryId: String(c.id) }} className="flex items-center gap-3">
                      <Img src={c.imageUrl} alt="" sizes="44px" maxWidth={96} className="size-11 rounded-lg object-cover" />
                      <span>
                        <span className="flex items-center gap-1.5 font-medium">
                          {c.name} {c.isFeatured ? <Star className="size-3.5 fill-gold text-gold" /> : null}
                        </span>
                        <span className="text-xs text-muted-foreground">/collections/{c.slug}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td className="text-muted-foreground">{c.parentName ?? '—'}</Td>
                  <Td className="text-right tabular-nums">{Number(c.productCount)}</Td>
                  <Td>
                    <Badge tone={c.isActive ? 'success' : 'neutral'} dot>
                      {c.isActive ? 'Visible' : 'Hidden'}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
