// Ghana phone numbers. Accepts 024 412 3456, +233 24 412 3456, 233244123456...
export function normalizePhone(value: string | null | undefined): string | null {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (/^0\d{9}$/.test(digits)) return `233${digits.slice(1)}`
  if (/^233\d{9}$/.test(digits)) return digits
  if (/^\d{9}$/.test(digits)) return `233${digits}`
  return null
}

/** 233244123456 → 024 412 3456 */
export function displayPhone(value: string | null | undefined): string {
  const n = normalizePhone(value)
  if (!n) return String(value ?? '')
  const local = `0${n.slice(3)}`
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
}
