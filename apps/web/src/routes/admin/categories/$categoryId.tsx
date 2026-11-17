import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { slugify } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Field, Input, NativeSelect } from '#/components/ui/input'
import { Skeleton, Switch } from '#/components/ui/misc'
import { Confirm, PageHeader, Section } from '#/components/admin/kit'
import { ImageField } from '#/components/admin/media-picker'
import { RichTextEditor } from '#/components/admin/rich-text-editor'
import { SeoPanel } from '#/components/admin/seo-panel'

export const Route = createFileRoute('/admin/categories/$categoryId')({ component: CategoryEditor })

const EMPTY = {
  name: '',
  slug: '',
  parentId: null as number | null,
  tagline: '',
  description: '',
  imageUrl: null as string | null,
  seoTitle: '',
  seoDescription: '',
  isFeatured: false,
  isActive: true,
  sortOrder: 0,
}

function CategoryEditor() {
  const { categoryId } = Route.useParams()
  const isNew = categoryId === 'new'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY)
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v, ...(k === 'name' && isNew ? { slug: slugify(String(v)) } : {}) }))
  const [confirm, setConfirm] = useState(false)
  const existing = useQuery({ queryKey: ['admin', 'category', categoryId], queryFn: () => api.get<Record<string, any>>(`/admin/categories/${categoryId}`), enabled: !isNew })
  const all = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api.get<Array<{ id: number; name: string; parentId: number | null }>>('/admin/categories') })
  useEffect(() => {
    const c = existing.data
    if (c)
      setForm({
        name: c.name,
        slug: c.slug,
        parentId: c.parentId,
        tagline: c.tagline ?? '',
        description: c.description ?? '',
        imageUrl: c.imageUrl,
        seoTitle: c.seoTitle ?? '',
        seoDescription: c.seoDescription ?? '',
        isFeatured: Boolean(c.isFeatured),
        isActive: Boolean(c.isActive),
        sortOrder: c.sortOrder,
      })
  }, [existing.data])
  const save = useMutation({
    mutationFn: () => (isNew ? api.post<{ id: number }>('/admin/categories', form) : api.put<{ id: number }>(`/admin/categories/${categoryId}`, form)),
    onSuccess: (r) => {
      toast.success('Collection saved')
      void qc.invalidateQueries({ queryKey: ['admin', 'categories'] })
      void qc.invalidateQueries({ queryKey: ['bootstrap'] })
      if (isNew) void navigate({ to: '/admin/categories/$categoryId', params: { categoryId: String(r.id) }, replace: true })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const remove = useMutation({
    mutationFn: () => api.delete(`/admin/categories/${categoryId}`),
    onSuccess: () => {
      toast.success('Collection deleted. Its products are now uncategorised.')
      void qc.invalidateQueries({ queryKey: ['admin', 'categories'] })
      void navigate({ to: '/admin/categories' })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  if (!isNew && !existing.data) return <Skeleton className="h-[60vh] rounded-2xl" />
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <Link to="/admin/categories" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Collections
      </Link>
      <PageHeader
        title={isNew ? 'New collection' : form.name}
        actions={
          <>
            {!isNew && (
              <>
                <Button type="button" variant="ghost" asChild>
                  <a href={`/collections/${form.slug}`} target="_blank">
                    <ExternalLink /> View
                  </a>
                </Button>
                <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>
                  <Trash2 />
                </Button>
              </>
            )}
            <Button type="submit" loading={save.isPending}>
              Save
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="grid content-start gap-6">
          <Section title="Details">
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <Input required value={form.name} onChange={(e) => set('name', e.target.value)} />
                </Field>
                <Field label="Tagline" hint="A short line shown above the title.">
                  <Input value={form.tagline} onChange={(e) => set('tagline', e.target.value)} />
                </Field>
              </div>
              <Field label="Introduction" hint="A few sentences about the collection. Great for SEO: mention what shoppers search for.">
                <RichTextEditor value={form.description} onChange={(h) => set('description', h)} minHeight={180} />
              </Field>
            </div>
          </Section>
          <Section title="Search engine listing">
            <div className="grid gap-4">
              <Field label="URL" hint={`/collections/${form.slug}`}>
                <Input value={form.slug} onChange={(e) => set('slug', slugify(e.target.value))} />
              </Field>
              <SeoPanel
                showKeyword={false}
                value={{ name: form.name, slug: form.slug, pathPrefix: '/collections/', seoTitle: form.seoTitle, seoDescription: form.seoDescription, body: form.description }}
                onChange={(p) => setForm((f) => ({ ...f, ...p }))}
              />
            </div>
          </Section>
        </div>
        <div className="grid content-start gap-6">
          <Section title="Cover image">
            <ImageField value={form.imageUrl} onChange={(v) => set('imageUrl', v)} aspect="aspect-[3/4]" />
          </Section>
          <Section title="Settings">
            <div className="grid gap-4">
              <Field label="Parent collection">
                <NativeSelect value={form.parentId ?? ''} onChange={(e) => set('parentId', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">None (top level)</option>
                  {all.data
                    ?.filter((c) => !c.parentId && String(c.id) !== categoryId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
              <label className="flex items-center justify-between text-sm">
                Visible in the store <Switch checked={form.isActive} onCheckedChange={(v) => set('isActive', v)} />
              </label>
              <label className="flex items-center justify-between text-sm">
                Show on the homepage <Switch checked={form.isFeatured} onCheckedChange={(v) => set('isFeatured', v)} />
              </label>
            </div>
          </Section>
        </div>
      </div>
      <Confirm open={confirm} onOpenChange={setConfirm} title="Delete this collection?" description="Its products stay in the store without a collection." destructive confirmLabel="Delete" loading={remove.isPending} onConfirm={() => remove.mutate()} />
    </form>
  )
}
