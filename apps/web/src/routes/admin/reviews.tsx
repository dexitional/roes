import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Check, MessageSquareQuote, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { relative } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Badge, Card, Skeleton } from '#/components/ui/misc'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/overlay'
import { EmptyState, PageHeader } from '#/components/admin/kit'
import { Img } from '#/components/site/image'
import { Stars } from '#/components/site/price'

export const Route = createFileRoute('/admin/reviews')({ component: Reviews })

interface Review {
  id: number
  rating: number
  title: string | null
  body: string | null
  status: string
  isVerifiedBuyer: number
  createdAt: string
  fullName: string
  email: string
  productName: string
  productSlug: string
  image: string | null
}

function Reviews() {
  const [status, setStatus] = useState('pending')
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'reviews', status], queryFn: () => api.get<{ data: Array<Review>; counts: Record<string, number> }>('/admin/reviews', { status }) })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'reviews'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'badges'] })
  }
  const update = useMutation({ mutationFn: ({ id, status: st }: { id: number; status: string }) => api.patch(`/admin/reviews/${id}`, { status: st }), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) })
  const remove = useMutation({ mutationFn: (id: number) => api.delete(`/admin/reviews/${id}`), onSuccess: refresh })
  return (
    <>
      <PageHeader eyebrow="Catalogue" title="Reviews" description="Approved reviews show on product pages and in Google rich results (star ratings)." />
      <Tabs value={status} onValueChange={setStatus} className="mb-5">
        <TabsList>
          {['pending', 'approved', 'rejected'].map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">
              {s} {data?.counts[s] ? <span className="text-xs opacity-60">{data.counts[s]}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : !data?.data.length ? (
        <Card>
          <EmptyState icon={MessageSquareQuote} title={`No ${status} reviews`} />
        </Card>
      ) : (
        <div className="grid gap-4">
          {data.data.map((r) => (
            <Card key={r.id} className="flex flex-wrap gap-5 p-5">
              <a href={`/p/${r.productSlug}`} target="_blank" className="shrink-0">
                <Img src={r.image} alt="" sizes="64px" maxWidth={128} className="size-16 rounded-xl object-cover" />
              </a>
              <div className="min-w-60 flex-1">
                <p className="text-xs text-muted-foreground">{r.productName}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Stars value={r.rating} />
                  {r.isVerifiedBuyer ? (
                    <Badge tone="success">
                      <BadgeCheck className="size-3" /> Verified buyer
                    </Badge>
                  ) : null}
                </div>
                {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
                {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {r.fullName} · {r.email} · {relative(r.createdAt)}
                </p>
              </div>
              <div className="flex items-start gap-2">
                {r.status !== 'approved' && (
                  <Button size="sm" onClick={() => update.mutate({ id: r.id, status: 'approved' })}>
                    <Check /> Approve
                  </Button>
                )}
                {r.status !== 'rejected' && (
                  <Button size="sm" variant="outline" onClick={() => update.mutate({ id: r.id, status: 'rejected' })}>
                    <X /> Reject
                  </Button>
                )}
                <Button size="icon-sm" variant="ghost" onClick={() => remove.mutate(r.id)} aria-label="Delete">
                  <Trash2 />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
