import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { FileText, Plus } from 'lucide-react'
import { api } from '#/lib/api-client'
import { relative } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Badge, Card } from '#/components/ui/misc'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/overlay'
import { EmptyState, PageHeader, Table, TableSkeleton, Td, Th } from '#/components/admin/kit'

export const Route = createFileRoute('/admin/content/')({
  validateSearch: z.object({ kind: z.enum(['page', 'post']).optional().catch(undefined) }),
  component: Content,
})

interface Row {
  id: number
  title: string
  slug: string
  status: 'draft' | 'published'
  showInFooter: number
  updatedAt: string
  author: string | null
  seoDescription: string | null
}

function Content() {
  const { kind = 'page' } = Route.useSearch()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'pages', kind], queryFn: () => api.get<Array<Row>>('/admin/pages', { kind }) })
  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Pages & journal"
        description="Store pages (About, Shipping, FAQ…) and journal articles that bring in search traffic."
        actions={
          <Button asChild>
            <Link to="/admin/content/$pageId" params={{ pageId: 'new' }} search={{ kind }}>
              <Plus /> New {kind === 'post' ? 'article' : 'page'}
            </Link>
          </Button>
        }
      />
      <Tabs value={kind} onValueChange={(v) => void navigate({ to: '.', search: { kind: v as 'page' | 'post' } })} className="mb-5">
        <TabsList>
          <TabsTrigger value="page">Pages</TabsTrigger>
          <TabsTrigger value="post">Journal</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card className="overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : !data?.length ? (
          <EmptyState icon={FileText} title="Nothing here yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Status</Th>
                <Th>SEO</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-muted/40">
                  <Td>
                    <Link to="/admin/content/$pageId" params={{ pageId: String(p.id) }} search={{ kind }} className="font-medium hover:text-primary">
                      {p.title}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {kind === 'post' ? '/journal/' : '/pages/'}
                      {p.slug}
                      {p.showInFooter ? ' · in footer' : ''}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={p.status === 'published' ? 'success' : 'warning'} dot className="capitalize">
                      {p.status}
                    </Badge>
                  </Td>
                  <Td>{p.seoDescription ? <Badge tone="success">Description set</Badge> : <Badge tone="neutral">Auto</Badge>}</Td>
                  <Td className="text-muted-foreground">
                    {relative(p.updatedAt)}
                    {p.author && ` · ${p.author}`}
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
