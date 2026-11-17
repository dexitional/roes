import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { slugify } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Field, Input, NativeSelect, Textarea } from '#/components/ui/input'
import { Skeleton, Switch } from '#/components/ui/misc'
import { Confirm, Section } from '#/components/admin/kit'
import { ImageField } from '#/components/admin/media-picker'
import { RichTextEditor } from '#/components/admin/rich-text-editor'
import { SeoPanel } from '#/components/admin/seo-panel'

export const Route = createFileRoute('/admin/content/$pageId')({
  validateSearch: z.object({ kind: z.enum(['page', 'post']).optional().catch(undefined) }),
  component: PageEditor,
})

function PageEditor() {
  const { pageId } = Route.useParams()
  const search = Route.useSearch()
  const isNew = pageId === 'new'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    kind: (search.kind ?? 'page') as 'page' | 'post',
    title: '',
    slug: '',
    excerpt: '',
    coverUrl: null as string | null,
    body: '',
    seoTitle: '',
    seoDescription: '',
    status: 'draft' as 'draft' | 'published',
    showInFooter: false,
  })
  const [confirm, setConfirm] = useState(false)
  const existing = useQuery({ queryKey: ['admin', 'page', pageId], queryFn: () => api.get<Record<string, any>>(`/admin/pages/${pageId}`), enabled: !isNew })
  useEffect(() => {
    const p = existing.data
    if (p)
      setForm({
        kind: p.kind,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt ?? '',
        coverUrl: p.coverUrl,
        body: p.body ?? '',
        seoTitle: p.seoTitle ?? '',
        seoDescription: p.seoDescription ?? '',
        status: p.status,
        showInFooter: Boolean(p.showInFooter),
      })
  }, [existing.data])
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v, ...(k === 'title' && isNew ? { slug: slugify(String(v)) } : {}) }))
  const save = useMutation({
    mutationFn: (status?: 'draft' | 'published') => {
      const body = { ...form, status: status ?? form.status }
      return isNew ? api.post<{ id: number }>('/admin/pages', body) : api.put<{ id: number }>(`/admin/pages/${pageId}`, body)
    },
    onSuccess: (r, status) => {
      if (status) setForm((f) => ({ ...f, status }))
      toast.success('Saved')
      void qc.invalidateQueries({ queryKey: ['admin', 'pages'] })
      if (isNew) void navigate({ to: '/admin/content/$pageId', params: { pageId: String(r.id) }, search: { kind: form.kind }, replace: true })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: () => api.delete(`/admin/pages/${pageId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'pages'] })
      void navigate({ to: '/admin/content', search: { kind: form.kind } })
    },
  })
  if (!isNew && !existing.data) return <Skeleton className="h-[70vh] rounded-2xl" />
  const prefix = form.kind === 'post' ? '/journal/' : '/pages/'
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(undefined)
      }}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/admin/content" search={{ kind: form.kind }} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Back">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="flex-1 text-xl font-bold">{isNew ? `New ${form.kind === 'post' ? 'article' : 'page'}` : form.title}</h1>
        {!isNew && (
          <>
            <Button type="button" variant="ghost" asChild>
              <a href={`${prefix}${form.slug}`} target="_blank">
                <ExternalLink /> View
              </a>
            </Button>
            <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>
              <Trash2 />
            </Button>
          </>
        )}
        <Button type="submit" variant="outline" loading={save.isPending && save.variables === undefined}>
          Save
        </Button>
        {form.status === 'draft' ? (
          <Button type="button" onClick={() => save.mutate('published')} loading={save.isPending && save.variables === 'published'}>
            Publish
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={() => save.mutate('draft')}>
            Unpublish
          </Button>
        )}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="grid content-start gap-4">
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Title"
            required
            className="font-display w-full bg-transparent text-4xl font-semibold outline-none placeholder:text-muted-foreground/50 sm:text-5xl"
          />
          <Textarea value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} placeholder="Short summary / standfirst" className="min-h-16 text-base" maxLength={400} />
          <RichTextEditor value={form.body} onChange={(h) => set('body', h)} minHeight={480} placeholder="Write something wonderful…" />
        </div>
        <div className="grid content-start gap-6">
          <Section title="Settings">
            <div className="grid gap-4">
              <Field label="Type">
                <NativeSelect value={form.kind} onChange={(e) => set('kind', e.target.value as 'page' | 'post')} disabled={!isNew}>
                  <option value="page">Page</option>
                  <option value="post">Journal article</option>
                </NativeSelect>
              </Field>
              <Field label="URL" hint={`${prefix}${form.slug}`}>
                <Input value={form.slug} onChange={(e) => set('slug', slugify(e.target.value))} />
              </Field>
              {form.kind === 'page' && (
                <label className="flex items-center justify-between text-sm">
                  Show in footer <Switch checked={form.showInFooter} onCheckedChange={(v) => set('showInFooter', v)} />
                </label>
              )}
            </div>
          </Section>
          <Section title="Cover image">
            <ImageField value={form.coverUrl} onChange={(v) => set('coverUrl', v)} />
          </Section>
          <Section title="Search engine listing">
            <SeoPanel
              showKeyword={false}
              value={{ name: form.title, slug: form.slug, pathPrefix: prefix, seoTitle: form.seoTitle, seoDescription: form.seoDescription, body: `${form.excerpt} ${form.body}` }}
              onChange={(p) => setForm((f) => ({ ...f, ...p }))}
            />
          </Section>
        </div>
      </div>
      <Confirm open={confirm} onOpenChange={setConfirm} title="Delete this page?" destructive confirmLabel="Delete" loading={remove.isPending} onConfirm={() => remove.mutate()} />
    </form>
  )
}
