const cedi = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 })
const cediRound = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 0 })

/** GH₵1,250.00 (or GH₵1,250 with round). */
export function money(value: number | string | null | undefined, round = false) {
  const n = Number(value ?? 0)
  return (round ? cediRound : cedi).format(Number.isFinite(n) ? n : 0).replace('GHS', 'GH₵')
}

export const num = (value: number | string | null | undefined) => Number(value ?? 0).toLocaleString('en-US')

export function compact(value: number) {
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export const percent = (value: number, digits = 1) => `${(Number.isFinite(value) ? value : 0).toFixed(digits)}%`

const parse = (value: string | Date) => (value instanceof Date ? value : new Date(value.includes('T') ? value : value.replace(' ', 'T')))

export function date(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—'
  return parse(value).toLocaleDateString('en-GB', opts)
}

export function dateTime(value: string | Date | null | undefined) {
  if (!value) return '—'
  return parse(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function relative(value: string | Date | null | undefined) {
  if (!value) return '—'
  const seconds = Math.round((Date.now() - parse(value).getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (Math.abs(seconds) < 60) return 'just now'
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2592000],
    ['year', 31536000],
  ]
  let unit: Intl.RelativeTimeFormatUnit = 'minute'
  let size = 60
  for (const [u, s] of units) if (Math.abs(seconds) >= s) [unit, size] = [u, s]
  return rtf.format(-Math.round(seconds / size), unit)
}

export const discountPercent = (price: number, compareAt: number | null | undefined) =>
  compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150)
