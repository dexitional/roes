// SEO editor: title, meta description and focus keyword with a live Google
// result preview and a scored checklist, so every product page can rank.
import { CheckCircle2, Circle, Globe, Sparkles, XCircle } from 'lucide-react'
import { cn } from '@roes/ui'
import { SITE_URL, clip } from '#/lib/seo'
import { Button } from '#/components/ui/button'
import { Field, Input, Textarea } from '#/components/ui/input'

interface SeoInput {
  name: string
  slug: string
  pathPrefix: string
  seoTitle: string
  seoDescription: string
  focusKeyword?: string
  body: string
  imageCount?: number
  imagesWithAlt?: number
  suffix?: string
}

type Check = { ok: boolean | null; label: string; weight: number }

export function seoChecks(s: SeoInput): { score: number; checks: Array<Check> } {
  const title = s.seoTitle || s.name
  const desc = s.seoDescription || clip(s.body)
  const kw = (s.focusKeyword ?? '').trim().toLowerCase()
  const text = s.body.replace(/<[^>]+>/g, ' ').toLowerCase()
  const words = text.split(/\s+/).filter(Boolean).length
  const internalLinks = (s.body.match(/href="\//g) ?? []).length
  const fullTitle = `${title} | ${s.suffix ?? 'Roes Outlet'}`
  const checks: Array<Check> = [
    { ok: title.length >= 20 && fullTitle.length <= 65, label: `SEO title is ${fullTitle.length} characters (aim for 30–65 including the store name)`, weight: 15 },
    { ok: desc.length >= 110 && desc.length <= 160, label: `Meta description is ${desc.length} characters (aim for 110–160)`, weight: 15 },
    { ok: Boolean(s.seoDescription), label: 'A hand-written meta description is set', weight: 10 },
    { ok: words >= 80, label: `Description has ${words} words (80+ helps search engines understand the piece)`, weight: 15 },
    { ok: s.slug.length > 0 && s.slug.length <= 60 && /^[a-z0-9-]+$/.test(s.slug), label: 'URL is short, lowercase and readable', weight: 5 },
    { ok: internalLinks > 0, label: 'Description links to a collection or another page', weight: 5 },
  ]
  if (s.imageCount !== undefined) {
    checks.push({ ok: s.imageCount >= 2, label: `${s.imageCount} photo${s.imageCount === 1 ? '' : 's'} (2+ recommended)`, weight: 10 })
    checks.push({ ok: s.imageCount > 0 && s.imagesWithAlt === s.imageCount, label: 'Every photo has alt text', weight: 10 })
  }
  if (kw) {
    checks.push({ ok: title.toLowerCase().includes(kw), label: 'Focus keyword appears in the SEO title', weight: 5 })
    checks.push({ ok: desc.toLowerCase().includes(kw), label: 'Focus keyword appears in the meta description', weight: 5 })
    checks.push({ ok: s.slug.includes(kw.replace(/\s+/g, '-')), label: 'Focus keyword appears in the URL', weight: 3 })
    checks.push({ ok: text.includes(kw), label: 'Focus keyword appears in the description', weight: 2 })
  } else {
    checks.push({ ok: null, label: 'Set a focus keyword to check keyword placement', weight: 15 })
  }
  const total = checks.reduce((n, c) => n + c.weight, 0)
  const got = checks.reduce((n, c) => n + (c.ok ? c.weight : 0), 0)
  return { score: Math.round((got / total) * 100), checks }
}

export function SeoScore({ score, className }: { score: number; className?: string }) {
  const tone = score >= 80 ? 'var(--success)' : score >= 55 ? 'var(--warning)' : 'var(--destructive)'
  return (
    <div className={cn('relative grid size-14 place-items-center', className)}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--muted)" strokeWidth="3.5" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={tone} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(score / 100) * 97.4} 97.4`} />
      </svg>
      <span className="text-sm font-bold tabular-nums">{score}</span>
    </div>
  )
}

export function SeoPanel({
  value,
  onChange,
  showKeyword = true,
}: {
  value: SeoInput
  onChange: (patch: { seoTitle?: string; seoDescription?: string; focusKeyword?: string }) => void
  showKeyword?: boolean
}) {
  const { score, checks } = seoChecks(value)
  const title = value.seoTitle || value.name || 'Untitled'
  const desc = value.seoDescription || clip(value.body) || 'Add a meta description to control how this page appears in Google.'
  const url = `${SITE_URL.replace(/^https?:\/\//, '')}${value.pathPrefix}${value.slug || '…'}`
  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-4">
        <SeoScore score={score} />
        <div>
          <p className="font-semibold">SEO score</p>
          <p className="text-xs text-muted-foreground">{score >= 80 ? 'Great: ready to rank.' : score >= 55 ? 'Good, with room to improve.' : 'Needs work before it can rank well.'}</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 text-left dark:bg-[#202124]">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-[#f1f3f4] dark:bg-[#303134]">
            <Globe className="size-3.5 text-[#5f6368]" />
          </span>
          <div className="leading-tight">
            <p className="text-xs text-[#202124] dark:text-[#dadce0]">Roes Outlet</p>
            <p className="truncate text-[0.7rem] text-[#4d5156] dark:text-[#bdc1c6]">{url}</p>
          </div>
        </div>
        <p className="mt-2 line-clamp-1 text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
          {title} | {value.suffix ?? 'Roes Outlet'}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[0.8rem] leading-relaxed text-[#4d5156] dark:text-[#bdc1c6]">{desc}</p>
      </div>

      <Field label="SEO title" hint={`${(value.seoTitle || value.name).length}/60 · Leave blank to use the name.`}>
        <Input value={value.seoTitle} onChange={(e) => onChange({ seoTitle: e.target.value })} placeholder={value.name} maxLength={120} />
      </Field>
      <Field
        label={
          <span className="flex items-center justify-between">
            Meta description
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => onChange({ seoDescription: clip(`${value.name}. ${value.body}`, 155) })}
            >
              <Sparkles className="size-3" /> Generate from description
            </Button>
          </span>
        }
        hint={`${value.seoDescription.length}/160`}
      >
        <Textarea value={value.seoDescription} onChange={(e) => onChange({ seoDescription: e.target.value })} className="min-h-20" maxLength={300} />
      </Field>
      {showKeyword && (
        <Field label="Focus keyword" hint="The phrase shoppers would search for, e.g. “gold hoop earrings”.">
          <Input value={value.focusKeyword ?? ''} onChange={(e) => onChange({ focusKeyword: e.target.value })} maxLength={120} />
        </Field>
      )}
      <ul className="grid gap-2">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2 text-xs">
            {c.ok === null ? (
              <Circle className="mt-px size-3.5 shrink-0 text-muted-foreground" />
            ) : c.ok ? (
              <CheckCircle2 className="mt-px size-3.5 shrink-0 text-success" />
            ) : (
              <XCircle className="mt-px size-3.5 shrink-0 text-destructive" />
            )}
            <span className={cn(c.ok ? 'text-muted-foreground' : 'text-foreground')}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
