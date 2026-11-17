import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, GalleryHorizontalEnd, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { Button } from '#/components/ui/button'
import { Field, Input, NativeSelect, Textarea } from '#/components/ui/input'
import { Badge, Card, Skeleton, Switch } from '#/components/ui/misc'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/overlay'
import { EmptyState, PageHeader } from '#/components/admin/kit'
import { ImageField } from '#/components/admin/media-picker'
import { Img } from '#/components/site/image'

export const Route = createFileRoute('/admin/slides')({ component: Slides })

interface Slide {
  id: number
  eyebrow: string | null
  title: string
  subtitle: string | null
  imageUrl: string
  ctaLabel: string | null
  ctaUrl: string | null
  align: 'left' | 'center' | 'right'
  isActive: number
  sortOrder: number
}
const EMPTY = { eyebrow: '', title: '', subtitle: '', imageUrl: '', ctaLabel: 'Shop now', ctaUrl: '/shop', align: 'left' as Slide['align'], isActive: true, sortOrder: 0 }

function Slides() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'slides'], queryFn: () => api.get<Array<Slide>>('/admin/slides') })
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'slides'] })
    qc.removeQueries({ queryKey: ['home'] })
  }
  const save = useMutation({
    mutationFn: () => (editing === 'new' ? api.post('/admin/slides', { ...form, sortOrder: data?.length ?? 0 }) : api.put(`/admin/slides/${editing}`, form)),
    onSuccess: () => {
      toast.success('Slide saved')
      setEditing(null)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({ mutationFn: (id: number) => api.delete(`/admin/slides/${id}`), onSuccess: refresh })
  const reorder = useMutation({ mutationFn: (ids: Array<number>) => api.post('/admin/slides/reorder', { ids }), onSuccess: refresh })
  const move = (i: number, d: number) => {
    const ids = (data ?? []).map((s) => s.id)
    const j = i + d
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    reorder.mutate(ids)
  }
  const open = (s?: Slide) => {
    setEditing(s ? s.id : 'new')
    setForm(
      s
        ? { eyebrow: s.eyebrow ?? '', title: s.title, subtitle: s.subtitle ?? '', imageUrl: s.imageUrl, ctaLabel: s.ctaLabel ?? '', ctaUrl: s.ctaUrl ?? '', align: s.align, isActive: Boolean(s.isActive), sortOrder: s.sortOrder }
        : EMPTY,
    )
  }
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Homepage slides"
        description="The hero slider at the top of the homepage. Use wide, bright photos (at least 1600px)."
        actions={
          <Button onClick={() => open()}>
            <Plus /> Add slide
          </Button>
        }
      />
      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={GalleryHorizontalEnd} title="No slides" description="Add a slide to show a hero banner on the homepage." />
        </Card>
      ) : (
        <div className="grid gap-4">
          {data.map((s, i) => (
            <Card key={s.id} className="flex flex-wrap items-center gap-5 overflow-hidden p-3">
              <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl sm:w-80">
                <Img src={s.imageUrl} alt="" sizes="320px" maxWidth={640} className="size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent p-4 text-white">
                  <p className="text-[0.6rem] font-bold tracking-widest uppercase opacity-80">{s.eyebrow}</p>
                  <p className="font-display text-xl leading-tight">{s.title}</p>
                </div>
              </div>
              <div className="min-w-48 flex-1">
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.subtitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.ctaLabel} → {s.ctaUrl}
                </p>
              </div>
              <Badge tone={s.isActive ? 'success' : 'neutral'} dot>
                {s.isActive ? 'Showing' : 'Hidden'}
              </Badge>
              <div className="flex gap-1 pr-2">
                <Button size="icon-sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  <ArrowUp />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === data.length - 1} aria-label="Move down">
                  <ArrowDown />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => open(s)} aria-label="Edit">
                  <Pencil />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => remove.mutate(s.id)} aria-label="Delete">
                  <Trash2 />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'New slide' : 'Edit slide'}</DialogTitle>
          </DialogHeader>
          <ImageField value={form.imageUrl || null} onChange={(v) => set('imageUrl', v ?? '')} aspect="aspect-[21/9]" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Eyebrow">
              <Input value={form.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} placeholder="New season" />
            </Field>
            <Field label="Title">
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="Subtitle" className="sm:col-span-2">
              <Textarea value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} className="min-h-16" />
            </Field>
            <Field label="Button label">
              <Input value={form.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} />
            </Field>
            <Field label="Button link">
              <Input value={form.ctaUrl} onChange={(e) => set('ctaUrl', e.target.value)} placeholder="/collections/necklaces" />
            </Field>
            <Field label="Text position">
              <NativeSelect value={form.align} onChange={(e) => set('align', e.target.value as Slide['align'])}>
                <option value="left">Left</option>
                <option value="center">Centre</option>
                <option value="right">Right</option>
              </NativeSelect>
            </Field>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <Switch checked={form.isActive} onCheckedChange={(v) => set('isActive', v)} /> Show on homepage
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.imageUrl || !form.title}>
              Save slide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
