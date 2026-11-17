import { useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ImageUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@roes/ui'
import { api, errorMessage } from '#/lib/api-client'
import type { Page } from '#/lib/api-client'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/misc'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '#/components/ui/overlay'
import { Img } from '#/components/site/image'
import { SearchInput } from './kit'

export interface MediaItem {
  id: number
  url: string
  filename: string
  width: number | null
  height: number | null
  alt: string | null
  size?: number
}

/** Uploads files to the media library (stored locally as WebP). */
export function useUpload(folder = 'uploads') {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(0)
  const upload = async (files: FileList | Array<File>) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'))
    if (!list.length) return [] as Array<MediaItem>
    setBusy((n) => n + list.length)
    const done: Array<MediaItem> = []
    await Promise.all(
      list.map(async (f) => {
        try {
          done.push(await api.upload<MediaItem>('/admin/media', f, { folder }))
        } catch (err) {
          toast.error(`${f.name}: ${errorMessage(err)}`)
        } finally {
          setBusy((n) => n - 1)
        }
      }),
    )
    void qc.invalidateQueries({ queryKey: ['admin', 'media'] })
    return done
  }
  return { upload, uploading: busy > 0 }
}

export function DropZone({ onFiles, uploading, className, compact }: { onFiles: (files: FileList) => void; uploading: boolean; className?: string; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
      }}
      className={cn(
        'grid place-items-center rounded-2xl border-2 border-dashed text-center text-sm text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5',
        over && 'border-primary bg-primary/5',
        compact ? 'p-4' : 'p-8',
        className,
      )}
    >
      {uploading ? <Loader2 className="size-6 animate-spin text-primary" /> : <ImageUp className="size-6 text-primary" />}
      <span className="mt-2 font-semibold text-foreground">{uploading ? 'Uploading & optimising…' : 'Drop images or click to upload'}</span>
      {!compact && <span className="mt-0.5 text-xs">JPG, PNG, WebP or AVIF up to 15 MB. Saved as optimised WebP.</span>}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && onFiles(e.target.files)} />
    </button>
  )
}

export function MediaPicker({
  open,
  onOpenChange,
  onSelect,
  multiple = false,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSelect: (items: Array<MediaItem>) => void
  multiple?: boolean
}) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Array<MediaItem>>([])
  const { upload, uploading } = useUpload()
  const query = useInfiniteQuery({
    queryKey: ['admin', 'media', q],
    queryFn: ({ pageParam }) => api.get<Page<MediaItem>>('/admin/media', { q, page: pageParam, pageSize: 48 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled: open,
  })
  const items = query.data?.pages.flatMap((p) => p.data) ?? []
  const toggle = (m: MediaItem) => {
    if (!multiple) return setSelected([m])
    setSelected((s) => (s.some((x) => x.id === m.id) ? s.filter((x) => x.id !== m.id) : [...s, m]))
  }
  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setSelected([]))}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
          <DialogDescription>Choose {multiple ? 'images' : 'an image'} or upload new ones.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
          <SearchInput value={q} onChange={setQ} placeholder="Search by name or alt text" />
          <DropZone
            compact
            uploading={uploading}
            onFiles={async (files) => {
              const added = await upload(files)
              if (added.length) setSelected((s) => (multiple ? [...added, ...s] : [added[0]!]))
            }}
          />
        </div>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
            {query.isLoading &&
              Array.from({ length: 18 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
            {items.map((m) => {
              const on = selected.some((s) => s.id === m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m)}
                  onDoubleClick={() => (onSelect([m]), onOpenChange(false))}
                  className={cn('group relative aspect-square overflow-hidden rounded-xl border-2 bg-muted transition', on ? 'border-primary ring-4 ring-primary/20' : 'border-transparent hover:border-foreground/20')}
                  title={m.alt ?? m.filename}
                >
                  <Img src={m.url} alt={m.alt ?? ''} sizes="160px" maxWidth={256} className="size-full object-cover" />
                  {on && (
                    <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {query.hasNextPage && (
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-muted-foreground">{selected.length} selected</span>
          <Button
            disabled={!selected.length}
            onClick={() => {
              onSelect(selected)
              setSelected([])
              onOpenChange(false)
            }}
          >
            Use {selected.length > 1 ? `${selected.length} images` : 'image'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A single image field: preview, choose from library, upload or clear. */
export function ImageField({ value, onChange, aspect = 'aspect-video', label = 'Image' }: { value: string | null | undefined; onChange: (url: string | null) => void; aspect?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const { upload, uploading } = useUpload()
  return (
    <div>
      {value ? (
        <div className={cn('group relative overflow-hidden rounded-2xl border bg-muted', aspect)}>
          <Img src={value} alt={label} sizes="400px" maxWidth={768} className="size-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition group-hover:opacity-100">
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
              Replace
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => onChange(null)}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <DropZone
            uploading={uploading}
            className={aspect}
            onFiles={async (files) => {
              const [first] = await upload(files)
              if (first) onChange(first.url)
            }}
          />
          <Button type="button" variant="link" size="sm" onClick={() => setOpen(true)}>
            or choose from the media library
          </Button>
        </div>
      )}
      <MediaPicker open={open} onOpenChange={setOpen} onSelect={([m]) => m && onChange(m.url)} />
    </div>
  )
}
