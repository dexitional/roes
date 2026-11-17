import { useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute, useBlocker, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowUp, BarChart3, ExternalLink, ImagePlus, Plus, Star, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@roes/ui'
import { GENDERS, MATERIALS } from '@roes/db/types'
import { api, errorMessage } from '#/lib/api-client'
import { money, slugify } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Field, Input, NativeSelect, Textarea } from '#/components/ui/input'
import { Skeleton, Switch } from '#/components/ui/misc'
import { Confirm, Section } from '#/components/admin/kit'
import { DropZone, MediaPicker, useUpload } from '#/components/admin/media-picker'
import { RichTextEditor } from '#/components/admin/rich-text-editor'
import { SeoPanel } from '#/components/admin/seo-panel'
import { Img } from '#/components/site/image'

export const Route = createFileRoute('/admin/products/$productId')({ component: ProductEditor })

interface Variant {
  id?: number | null
  optionName: string
  optionValue: string
  priceAdjustment: number
  stock: number
}
interface ImageRow {
  url: string
  alt: string | null
  width?: number | null
  height?: number | null
}
interface Form {
  name: string
  slug: string
  sku: string
  categoryId: number | null
  shortDescription: string
  description: string
  price: number | string
  compareAtPrice: number | string
  costPrice: number | string
  stock: number | string
  trackStock: boolean
  material: string
  finish: string
  gender: (typeof GENDERS)[number]
  tags: Array<string>
  isFeatured: boolean
  isNew: boolean
  status: 'active' | 'draft' | 'archived'
  seoTitle: string
  seoDescription: string
  focusKeyword: string
  images: Array<ImageRow>
  variants: Array<Variant>
}

const EMPTY: Form = {
  name: '',
  slug: '',
  sku: '',
  categoryId: null,
  shortDescription: '',
  description: '',
  price: '',
  compareAtPrice: '',
  costPrice: '',
  stock: 1,
  trackStock: true,
  material: '',
  finish: '',
  gender: 'women',
  tags: [],
  isFeatured: false,
  isNew: true,
  status: 'active',
  seoTitle: '',
  seoDescription: '',
  focusKeyword: '',
  images: [],
  variants: [],
}

function fromApi(p: Record<string, any>): Form {
  return {
    name: p.name,
    slug: p.slug,
    sku: p.sku ?? '',
    categoryId: p.categoryId,
    shortDescription: p.shortDescription ?? '',
    description: p.description ?? '',
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice ?? '',
    costPrice: p.costPrice ?? '',
    stock: p.stock,
    trackStock: Boolean(p.trackStock),
    material: p.material ?? '',
    finish: p.finish ?? '',
    gender: p.gender,
    tags: p.tags ?? [],
    isFeatured: Boolean(p.isFeatured),
    isNew: Boolean(p.isNew),
    status: p.status,
    seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '',
    focusKeyword: p.focusKeyword ?? '',
    images: p.images.map((i: ImageRow) => ({ url: i.url, alt: i.alt, width: i.width, height: i.height })),
    variants: p.variants.map((v: Variant & { priceAdjustment: number | string }) => ({ ...v, priceAdjustment: Number(v.priceAdjustment) })),
  }
}

function Gallery({ images, onChange, name }: { images: Array<ImageRow>; onChange: (images: Array<ImageRow>) => void; name: string }) {
  const [picker, setPicker] = useState(false)
  const { upload, uploading } = useUpload('products')
  const [drag, setDrag] = useState<number | null>(null)
  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return
    const next = [...images]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it!)
    onChange(next)
  }
  const add = (items: Array<{ url: string; alt: string | null; width: number | null; height: number | null }>) =>
    onChange([...images, ...items.filter((i) => !images.some((x) => x.url === i.url)).map((i) => ({ url: i.url, alt: i.alt || name, width: i.width, height: i.height }))])
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <div
            key={img.url}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drag !== null && (move(drag, i), setDrag(null))}
            className={cn('group relative overflow-hidden rounded-2xl border bg-muted', i === 0 && 'col-span-2 row-span-2', drag === i && 'opacity-50')}
          >
            <Img src={img.url} alt={img.alt ?? ''} sizes="300px" maxWidth={640} className="aspect-square size-full cursor-grab object-cover" />
            {i === 0 && <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">Cover</span>}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
              {i > 0 && (
                <button type="button" onClick={() => move(i, 0)} className="grid size-7 place-items-center rounded-full bg-background/90 shadow" aria-label="Make cover">
                  <Star className="size-3.5" />
                </button>
              )}
              <button type="button" onClick={() => move(i, i - 1)} className="grid size-7 place-items-center rounded-full bg-background/90 shadow" aria-label="Move earlier">
                <ArrowUp className="size-3.5" />
              </button>
              <button type="button" onClick={() => move(i, i + 1)} className="grid size-7 place-items-center rounded-full bg-background/90 shadow" aria-label="Move later">
                <ArrowDown className="size-3.5" />
              </button>
              <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-full bg-destructive text-white shadow" aria-label="Remove">
                <X className="size-3.5" />
              </button>
            </div>
            <input
              value={img.alt ?? ''}
              onChange={(e) => onChange(images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))}
              placeholder="Alt text (describe the photo)"
              className="absolute inset-x-2 bottom-2 rounded-lg bg-background/90 px-2 py-1 text-xs shadow outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
        <DropZone
          uploading={uploading}
          className="aspect-square"
          compact
          onFiles={async (files) => add(await upload(files))}
        />
      </div>
      <Button type="button" variant="link" size="sm" className="mt-2" onClick={() => setPicker(true)}>
        <ImagePlus /> Choose from media library
      </Button>
      <MediaPicker open={picker} onOpenChange={setPicker} multiple onSelect={add} />
    </div>
  )
}

function Variants({ variants, onChange }: { variants: Array<Variant>; onChange: (v: Array<Variant>) => void }) {
  const set = (i: number, patch: Partial<Variant>) => onChange(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)))
  return (
    <div className="grid gap-3">
      {variants.length > 0 && (
        <div className="hidden grid-cols-[1fr_1fr_8rem_6rem_2.5rem] gap-2 px-1 text-xs font-semibold text-muted-foreground sm:grid">
          <span>Option</span>
          <span>Value</span>
          <span>Price +/−</span>
          <span>Stock</span>
          <span />
        </div>
      )}
      {variants.map((v, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_8rem_6rem_2.5rem]">
          <Input value={v.optionName} onChange={(e) => set(i, { optionName: e.target.value })} placeholder="Colour" list="option-names" />
          <Input value={v.optionValue} onChange={(e) => set(i, { optionValue: e.target.value })} placeholder="Gold" />
          <Input type="number" step="0.01" value={v.priceAdjustment} onChange={(e) => set(i, { priceAdjustment: Number(e.target.value) })} />
          <Input type="number" min={0} value={v.stock} onChange={(e) => set(i, { stock: Number(e.target.value) })} />
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(variants.filter((_, j) => j !== i))} aria-label="Remove option">
            <Trash2 />
          </Button>
        </div>
      ))}
      <datalist id="option-names">
        <option value="Colour" />
        <option value="Size" />
        <option value="Length" />
        <option value="Style" />
      </datalist>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => onChange([...variants, { optionName: variants.at(-1)?.optionName ?? 'Colour', optionValue: '', priceAdjustment: 0, stock: 1 }])}
      >
        <Plus /> Add option
      </Button>
      {variants.length > 0 && <p className="text-xs text-muted-foreground">With options, the product's stock is the total of its options.</p>}
    </div>
  )
}

function TagInput({ value, onChange }: { value: Array<string>; onChange: (v: Array<string>) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setDraft('')
  }
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-card px-2 py-1.5">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={add}
        placeholder={value.length ? '' : 'gift, wedding, gold…'}
        className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none"
      />
    </div>
  )
}

function ProductEditor() {
  const { productId } = Route.useParams()
  const isNew = productId === 'new'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<Form>(EMPTY)
  const [dirty, setDirty] = useState(false)
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const product = useQuery({ queryKey: ['admin', 'product', productId], queryFn: () => api.get<Record<string, any>>(`/admin/products/${productId}`), enabled: !isNew })
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api.get<Array<{ id: number; name: string; parentId: number | null }>>('/admin/categories') })

  useEffect(() => {
    if (product.data) {
      setForm(fromApi(product.data))
      setDirty(false)
    }
  }, [product.data])

  useBlocker({ shouldBlockFn: () => dirty && !window.confirm('You have unsaved changes. Leave anyway?'), enableBeforeUnload: () => dirty })

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value }
      if (key === 'name' && !slugTouched) next.slug = slugify(String(value))
      return next
    })
    setDirty(true)
  }

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        price: Number(form.price) || 0,
        compareAtPrice: form.compareAtPrice === '' ? null : Number(form.compareAtPrice),
        costPrice: form.costPrice === '' ? null : Number(form.costPrice),
        stock: Number(form.stock) || 0,
      }
      return isNew ? api.post<{ id: number }>('/admin/products', body) : api.put<{ id: number }>(`/admin/products/${productId}`, body)
    },
    onSuccess: async (r) => {
      setDirty(false)
      toast.success(isNew ? 'Product created' : 'Product saved')
      await qc.invalidateQueries({ queryKey: ['admin', 'products'] })
      await qc.invalidateQueries({ queryKey: ['admin', 'product', String(r.id)] })
      qc.removeQueries({ queryKey: ['product'] })
      if (isNew) void navigate({ to: '/admin/products/$productId', params: { productId: String(r.id) }, replace: true })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const remove = useMutation({
    mutationFn: () => api.delete<{ archived: boolean }>(`/admin/products/${productId}`),
    onSuccess: (r) => {
      setDirty(false)
      toast.success(r.archived ? 'Product archived (it has orders)' : 'Product deleted')
      void qc.invalidateQueries({ queryKey: ['admin', 'products'] })
      void navigate({ to: '/admin/products' })
    },
  })

  const margin = useMemo(() => {
    const price = Number(form.price)
    const cost = Number(form.costPrice)
    return price && cost ? ((price - cost) / price) * 100 : null
  }, [form.price, form.costPrice])

  if (!isNew && !product.data) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Skeleton className="h-[70vh] rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <div className="sticky top-14 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8">
        <Link to="/admin/products" className="rounded-lg p-1.5 hover:bg-muted" aria-label="Back to products">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{isNew ? 'New product' : form.name || 'Untitled'}</h1>
          {dirty && <p className="text-xs text-warning">Unsaved changes</p>}
        </div>
        {!isNew && (
          <>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link to="/admin/analytics/$productId" params={{ productId }}>
                <BarChart3 /> Analytics
              </Link>
            </Button>
            <Button type="button" variant="ghost" size="sm" asChild>
              <a href={`/p/${form.slug}`} target="_blank">
                <ExternalLink /> View
              </a>
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 />
            </Button>
          </>
        )}
        <Button type="submit" loading={save.isPending}>
          {isNew ? 'Create product' : 'Save'}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_25rem]">
        <div className="grid content-start gap-6">
          <Section title="Details">
            <div className="grid gap-4">
              <Field label="Name">
                <Input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Gold Zirconia Necklace" />
              </Field>
              <Field label="Short summary" hint="Shown beside the price and in search results. One or two sentences.">
                <Textarea value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} className="min-h-16" maxLength={400} />
              </Field>
              <Field label="Description">
                <RichTextEditor value={form.description} onChange={(html) => set('description', html)} placeholder="Describe the piece: materials, how it looks and feels, how to style it…" />
              </Field>
            </div>
          </Section>
          <Section title="Photos" description="Drag to reorder. The first photo is the cover. Alt text helps Google Images.">
            <Gallery images={form.images} onChange={(images) => set('images', images)} name={form.name} />
          </Section>
          <Section title="Pricing">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Price (GH₵)">
                <Input required type="number" min={0} step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} />
              </Field>
              <Field label="Compare-at price" hint="Original price, to show a sale.">
                <Input type="number" min={0} step="0.01" value={form.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value)} />
              </Field>
              <Field label="Cost per item" hint={margin !== null ? `Margin ${margin.toFixed(0)}% · profit ${money(Number(form.price) - Number(form.costPrice))}` : 'Private: for profit reports.'}>
                <Input type="number" min={0} step="0.01" value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} />
              </Field>
            </div>
          </Section>
          <Section title="Inventory & options">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="SKU">
                <Input value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="RO-1234" />
              </Field>
              <Field label="Stock">
                <Input type="number" min={0} value={form.variants.length ? form.variants.reduce((s, v) => s + Number(v.stock), 0) : form.stock} disabled={form.variants.length > 0} onChange={(e) => set('stock', e.target.value)} />
              </Field>
              <label className="flex items-center gap-3 pt-6 text-sm">
                <Switch checked={form.trackStock} onCheckedChange={(v) => set('trackStock', v)} /> Track stock
              </label>
            </div>
            <div className="mt-6 border-t pt-5">
              <p className="mb-3 text-sm font-semibold">Options (colour, size…)</p>
              <Variants variants={form.variants} onChange={(v) => set('variants', v)} />
            </div>
          </Section>
        </div>

        <div className="grid content-start gap-6">
          <Section title="Status">
            <div className="grid gap-4">
              <NativeSelect value={form.status} onChange={(e) => set('status', e.target.value as Form['status'])}>
                <option value="active">Active: visible in the store</option>
                <option value="draft">Draft: hidden</option>
                <option value="archived">Archived</option>
              </NativeSelect>
              <label className="flex items-center justify-between text-sm">
                Feature on the homepage <Switch checked={form.isFeatured} onCheckedChange={(v) => set('isFeatured', v)} />
              </label>
              <label className="flex items-center justify-between text-sm">
                Mark as new arrival <Switch checked={form.isNew} onCheckedChange={(v) => set('isNew', v)} />
              </label>
            </div>
          </Section>
          <Section title="Organisation">
            <div className="grid gap-4">
              <Field label="Collection">
                <NativeSelect value={form.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">None</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parentId ? '— ' : ''}
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Material">
                  <Input value={form.material} onChange={(e) => set('material', e.target.value)} list="materials" />
                  <datalist id="materials">
                    {MATERIALS.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </Field>
                <Field label="For">
                  <NativeSelect value={form.gender} onChange={(e) => set('gender', e.target.value as Form['gender'])}>
                    {GENDERS.map((g) => (
                      <option key={g} value={g} className="capitalize">
                        {g}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <Field label="Tags" hint="Press Enter after each tag. Tags are searchable.">
                <TagInput value={form.tags} onChange={(t) => set('tags', t)} />
              </Field>
            </div>
          </Section>
          <Section title="Search engine listing">
            <div className="grid gap-4">
              <Field label="URL" hint={`/p/${form.slug || '…'}`}>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    set('slug', slugify(e.target.value))
                  }}
                />
              </Field>
              <SeoPanel
                value={{
                  name: form.name,
                  slug: form.slug,
                  pathPrefix: '/p/',
                  seoTitle: form.seoTitle,
                  seoDescription: form.seoDescription,
                  focusKeyword: form.focusKeyword,
                  body: `${form.shortDescription} ${form.description}`,
                  imageCount: form.images.length,
                  imagesWithAlt: form.images.filter((i) => (i.alt ?? '').trim().length > 3).length,
                }}
                onChange={(patch) => {
                  setForm((f) => ({ ...f, ...patch }))
                  setDirty(true)
                }}
              />
            </div>
          </Section>
        </div>
      </div>
      <Confirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this product?"
        description="If it has been ordered it will be archived instead."
        destructive
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </form>
  )
}
