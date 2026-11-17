// Values shared by the database schema, the API and the web app. The lists
// mirror the ENUM columns in migrations/.

export const USER_ROLES = ['customer', 'staff', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]
export const STAFF_ROLES: ReadonlyArray<UserRole> = ['staff', 'admin']

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]

export const GENDERS = ['women', 'men', 'unisex'] as const
export type Gender = (typeof GENDERS)[number]

export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const PAYMENT_STATUSES = ['pending', 'submitted', 'paid', 'failed', 'refunded'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_METHODS = ['momo', 'paystack'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const DELIVERY_METHODS = ['delivery', 'pickup'] as const
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number]

export const PRODUCT_EVENTS = ['view', 'add_to_cart', 'wishlist', 'checkout', 'purchase'] as const
export type ProductEvent = (typeof PRODUCT_EVENTS)[number]

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const PAGE_KINDS = ['page', 'post'] as const
export type PageKind = (typeof PAGE_KINDS)[number]

export const MATERIALS = [
  'Gold plated',
  'Silver plated',
  'Stainless steel',
  'Sterling silver',
  'Zirconia',
  'Pearl',
  'Crystal',
  'Mixed metals',
] as const

export const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Central',
  'Western',
  'Western North',
  'Eastern',
  'Volta',
  'Oti',
  'Northern',
  'Savannah',
  'North East',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo',
] as const
