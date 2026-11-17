import type { OrderStatus, PaymentStatus } from '@roes/db/types'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Awaiting payment',
  confirmed: 'Confirmed',
  processing: 'Being prepared',
  shipped: 'On its way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Not paid',
  submitted: 'Proof sent',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
}

export const ORDER_STATUS_TONE: Record<OrderStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'gold'> = {
  pending: 'warning',
  confirmed: 'info',
  processing: 'gold',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
}

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'gold'> = {
  pending: 'neutral',
  submitted: 'warning',
  paid: 'success',
  failed: 'danger',
  refunded: 'neutral',
}

export const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most popular' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
] as const
export type SortOption = (typeof SORT_OPTIONS)[number]['value']
