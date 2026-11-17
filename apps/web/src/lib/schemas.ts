// Request schemas shared by the API (validation) and the forms (types).
import { z } from 'zod'
import { DELIVERY_METHODS, GENDERS, ORDER_STATUSES, PAGE_KINDS, PAYMENT_METHODS, PRODUCT_STATUSES, REVIEW_STATUSES } from '@roes/db/types'

const text = (max: number) => z.string().trim().max(max)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null)
const money = z.coerce.number().min(0).max(10_000_000)
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .max(150)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes')

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => /^(\+?233|0)?\d{9}$/.test(v.replace(/[\s-]/g, '')), 'Enter a valid Ghana phone number')

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})

export const profileSchema = z.object({
  fullName: text(150).min(2, 'Enter your full name'),
  phone: phoneSchema.nullish().or(z.literal('')),
})

export const cartItemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullish(),
  quantity: z.number().int().min(1).max(50),
})

export const quoteSchema = z.object({
  items: z.array(cartItemSchema).max(60),
  couponCode: optionalText(40),
  deliveryMethod: z.enum(DELIVERY_METHODS).default('delivery'),
  region: optionalText(80),
})

export const checkoutSchema = quoteSchema.extend({
  items: z.array(cartItemSchema).min(1, 'Your bag is empty').max(60),
  customerName: text(150).min(2, 'Enter your name'),
  phone: phoneSchema,
  city: optionalText(80),
  address: optionalText(300),
  notes: optionalText(500),
  paymentMethod: z.enum(PAYMENT_METHODS).default('momo'),
})

export const momoProofSchema = z.object({
  sender: phoneSchema,
  transactionId: text(60).min(4, 'Enter the MoMo transaction ID'),
})

export const reviewSchema = z.object({
  productId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  title: optionalText(140),
  body: optionalText(2000),
})

export const trackSchema = z.object({
  productId: z.number().int().positive(),
  event: z.enum(['view', 'add_to_cart', 'wishlist', 'checkout']),
  quantity: z.number().int().min(1).max(50).optional(),
  source: optionalText(60),
})

export const subscribeSchema = z
  .object({ email: z.string().trim().toLowerCase().email().nullish(), phone: phoneSchema.nullish() })
  .refine((v) => v.email || v.phone, 'Enter an email or phone number')

// ---- Admin ----

export const variantInputSchema = z.object({
  id: z.number().int().positive().nullish(),
  optionName: text(40).min(1),
  optionValue: text(80).min(1),
  priceAdjustment: z.coerce.number().min(-1_000_000).max(1_000_000).default(0),
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
})

export const imageInputSchema = z.object({
  url: z.string().trim().max(500).min(1),
  alt: optionalText(200),
  width: z.number().int().nullish(),
  height: z.number().int().nullish(),
})

export const productSchema = z.object({
  name: text(160).min(2, 'Enter a product name'),
  slug: slug.optional().or(z.literal('')),
  sku: optionalText(60),
  categoryId: z.coerce.number().int().positive().nullish(),
  shortDescription: optionalText(400),
  description: z.string().max(200_000).nullish(),
  price: money,
  compareAtPrice: money.nullish(),
  costPrice: money.nullish(),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  trackStock: z.boolean().default(true),
  material: optionalText(80),
  finish: optionalText(80),
  gender: z.enum(GENDERS).default('women'),
  tags: z.array(text(40)).max(20).default([]),
  isFeatured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  status: z.enum(PRODUCT_STATUSES).default('active'),
  seoTitle: optionalText(120),
  seoDescription: optionalText(300),
  focusKeyword: optionalText(120),
  images: z.array(imageInputSchema).max(20).default([]),
  variants: z.array(variantInputSchema).max(60).default([]),
})
export type ProductInput = z.input<typeof productSchema>

export const categorySchema = z.object({
  name: text(120).min(2, 'Enter a name'),
  slug: slug.optional().or(z.literal('')),
  parentId: z.coerce.number().int().positive().nullish(),
  tagline: optionalText(200),
  description: z.string().max(100_000).nullish(),
  imageUrl: optionalText(500),
  seoTitle: optionalText(120),
  seoDescription: optionalText(300),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
})

export const orderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: optionalText(500),
  notify: z.boolean().default(true),
})

export const reviewStatusSchema = z.object({ status: z.enum(REVIEW_STATUSES) })

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, 'Letters, numbers, dashes and underscores only'),
  description: optionalText(200),
  kind: z.enum(['percent', 'fixed']),
  value: z.coerce.number().positive(),
  minSubtotal: money.default(0),
  usageLimit: z.coerce.number().int().positive().nullish(),
  startsAt: optionalText(30),
  endsAt: optionalText(30),
  isActive: z.boolean().default(true),
})

export const pageSchema = z.object({
  kind: z.enum(PAGE_KINDS),
  title: text(200).min(2, 'Enter a title'),
  slug: slug.optional().or(z.literal('')),
  excerpt: optionalText(400),
  coverUrl: optionalText(500),
  body: z.string().max(500_000).nullish(),
  seoTitle: optionalText(120),
  seoDescription: optionalText(300),
  status: z.enum(['draft', 'published']),
  showInFooter: z.boolean().default(false),
})

export const slideSchema = z.object({
  eyebrow: optionalText(80),
  title: text(160).min(2),
  subtitle: optionalText(300),
  imageUrl: text(500).min(1, 'Choose an image'),
  ctaLabel: optionalText(60),
  ctaUrl: optionalText(300),
  align: z.enum(['left', 'center', 'right']).default('left'),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
})

export const staffSchema = z.object({
  fullName: text(150).min(2),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['staff', 'admin']),
  password: z.string().min(8, 'Use at least 8 characters').max(200).optional().or(z.literal('')),
})

export const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Use at least 8 characters').max(200),
})
