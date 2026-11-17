// The shopping bag lives in localStorage, so it survives reloads and works
// before sign-in. Lines keep a snapshot (name, photo, price) for an instant
// UI; the server re-prices everything (POST /api/store/quote) before checkout.
import { useSyncExternalStore } from 'react'
import { track } from './track'

export interface CartItem {
  productId: number
  variantId: number | null
  quantity: number
  name: string
  slug: string
  image: string | null
  price: number
  variantLabel: string | null
}

interface CartState {
  items: Array<CartItem>
  open: boolean
  coupon: string | null
}

const KEY = 'roes-bag-v1'
const EMPTY: CartState = { items: [], open: false, coupon: null }
let state: CartState = EMPTY
let loaded = false
const listeners = new Set<() => void>()

function load() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<CartState> | null
    if (saved?.items) state = { ...EMPTY, items: saved.items.filter((i) => i.productId && i.quantity > 0), coupon: saved.coupon ?? null }
  } catch {
    // Corrupt or blocked storage: start empty.
  }
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    loaded = false
    load()
    emit()
  })
}

function emit() {
  listeners.forEach((l) => l())
}

function set(next: Partial<CartState>) {
  state = { ...state, ...next }
  try {
    localStorage.setItem(KEY, JSON.stringify({ items: state.items, coupon: state.coupon }))
  } catch {
    // Ignore quota/private-mode errors.
  }
  emit()
}

const same = (a: { productId: number; variantId: number | null }, b: { productId: number; variantId: number | null }) =>
  a.productId === b.productId && (a.variantId ?? null) === (b.variantId ?? null)

export const cart = {
  get: () => {
    load()
    return state
  },
  subscribe(cb: () => void) {
    load()
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
  add(item: Omit<CartItem, 'quantity'>, quantity = 1, opts: { open?: boolean; source?: string } = {}) {
    load()
    const existing = state.items.find((i) => same(i, item))
    const items = existing
      ? state.items.map((i) => (same(i, item) ? { ...i, ...item, quantity: Math.min(50, i.quantity + quantity) } : i))
      : [...state.items, { ...item, quantity }]
    set({ items, open: opts.open ?? true })
    track(item.productId, 'add_to_cart', { quantity, source: opts.source })
  },
  setQuantity(productId: number, variantId: number | null, quantity: number) {
    const items =
      quantity <= 0
        ? state.items.filter((i) => !same(i, { productId, variantId }))
        : state.items.map((i) => (same(i, { productId, variantId }) ? { ...i, quantity: Math.min(50, quantity) } : i))
    set({ items })
  },
  remove(productId: number, variantId: number | null) {
    set({ items: state.items.filter((i) => !same(i, { productId, variantId })) })
  },
  clear() {
    set({ items: [], coupon: null })
  },
  setOpen(open: boolean) {
    set({ open })
  },
  setCoupon(coupon: string | null) {
    set({ coupon })
  },
}

export function useCart() {
  const s = useSyncExternalStore(cart.subscribe, cart.get, () => EMPTY)
  const count = s.items.reduce((n, i) => n + i.quantity, 0)
  const subtotal = s.items.reduce((n, i) => n + i.price * i.quantity, 0)
  return { ...s, count, subtotal }
}
