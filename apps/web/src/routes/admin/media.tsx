import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import type { Page } from '#/lib/api-client'
import { date } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Field, Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/misc'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components/ui/overlay'
import { PageHeader, SearchInput } from '#/components/admin/kit'
import { DropZone, useUpload } from '#/components/admin/media-picker'
import type { MediaItem } from '#/components/admin/media-picker'
import { Img } from '#/components/site/image'

export const Route = createFileRoute('/admin/media')({ component: Media })

function Media() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<(MediaItem & { createdAt?: string }) | null>(null)
  const [alt, setAlt] = useState('')
  const qc = useQueryClient()
  const { upload, uploading } = useUpload()
  const query = useInfiniteQuery({
    queryKey: ['admin', 'media', q],
    queryFn: ({ pageParam }) => api.get<Page<MediaItem & { createdAt: string }>>('/admin/media', { q, page: pageParam, pageSize: 48 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  })
  const items = query.data?.pages.flatMap((p) => p.data) ?? []
  const total = query.data?.pages[0]?.total ?? 0
  const saveAlt = useMutation({
    mutationFn: () => api.patch(`/admin/media/${open!.id}`, { alt }),
    onSuccess: () => {
      toast.success('Alt text saved')
      void qc.invalidateQueries({ queryKey: ['admin', 'media'] })
    },
  })
  const remove = useMutation({
    mutationFn: () => api.delete(`/admin/media/${open!.id}`),
    onSuccess: () => {
      toast.success('Image deleted')
      setOpen(null)
      void qc.invalidateQueries({ queryKey: ['admin', 'media'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <>
      <PageHeader eyebrow="Content" title="Media library" description={`${total.toLocaleString()} images, stored locally and served as optimised AVIF/WebP.`} />
      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_22rem]">
        <SearchInput value={q} onChange={setQ} placeholder="Search by file name or alt text" />
        <DropZone uploading={uploading} compact onFiles={(f) => void upload(f)} />
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7 2xl:grid-cols-9">
        {query.isLoading && Array.from({ length: 27 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        {items.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setOpen(m)
              setAlt(m.alt ?? '')
            }}
            className="group relative aspect-square overflow-hidden rounded-xl bg-muted ring-primary transition hover:ring-2"
          >
            <Img src={m.url} alt={m.alt ?? ''} sizes="140px" maxWidth={256} className="size-full object-cover transition group-hover:scale-105" />
          </button>
        ))}
      </div>
      {query.hasNextPage && (
        <div className="mt-6 text-center">
          <Button variant="outline" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
            Load more
          </Button>
        </div>
      )}
      <Dialog open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate">{open.filename}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-5 sm:grid-cols-[1fr_16rem]">
                <Img src={open.url} alt={open.alt ?? ''} sizes="480px" maxWidth={1024} className="max-h-[60vh] w-full rounded-xl bg-muted object-contain" />
                <div className="grid content-start gap-4 text-sm">
                  <dl className="grid gap-1 text-xs text-muted-foreground">
                    <div>
                      {open.width} × {open.height}px
                    </div>
                    {open.size ? <div>{(open.size / 1024).toFixed(0)} KB WebP</div> : null}
                    {open.createdAt && <div>Added {date(open.createdAt)}</div>}
                  </dl>
                  <Field label="Alt text" hint="Describe the image for Google Images and screen readers.">
                    <Input value={alt} onChange={(e) => setAlt(e.target.value)} />
                  </Field>
                  <Button size="sm" onClick={() => saveAlt.mutate()} loading={saveAlt.isPending}>
                    Save alt text
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(new URL(open.url, window.location.origin).href)
                      toast.success('URL copied')
                    }}
                  >
                    <Copy /> Copy URL
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate()} loading={remove.isPending}>
                    <Trash2 /> Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
