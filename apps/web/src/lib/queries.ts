// Query options shared by route loaders (SSR + prefetch on hover) and components.
import { queryOptions } from '@tanstack/react-query'
import type { StoreSettings } from '@roes/db/settings'
import { api } from './api-client'
import { getSession } from '#/server/session'

export interface Card {
  id: number
  slug: string
  name: string
  price: number
  compareAtPrice: number | null
  stock: number
  isNew: boolean
  isFeatured: boolean
  ratingAvg: number
  ratingCount: number
  categoryName: string | null
  categorySlug: string | null
  image: string | null
  imageAlt: string | null
  hoverImage: string | null
  variantCount: number
}

export interface NavCategory {
  id: number
  parentId: number | null
  name: string
  slug: string
  imageUrl: string | null
  productCount: number
}

export interface Bootstrap {
  store: StoreSettings['store']
  announcement: StoreSettings['announcement']
  seo: StoreSettings['seo']
  delivery: StoreSettings['delivery']
  payments: { momoNumber: string; momoName: string; momoNetwork: string; instructions: string; paystack: boolean }
  categories: Array<NavCategory>
  footerPages: Array<{ title: string; slug: string }>
}

export interface ProductList {
  data: Array<Card>
  total: number
  page: number
  pageSize: number
  sort: string
  facets: { materials: Array<{ value: string; count: number }>; priceRange: { min: number; max: number } }
}

export interface ProductDetail {
  id: number
  slug: string
  name: string
  sku: string | null
  shortDescription: string | null
  description: string | null
  price: number
  compareAtPrice: number | null
  stock: number
  trackStock: number
  material: string | null
  finish: string | null
  gender: string
  tags: Array<string>
  isNew: number
  isFeatured: number
  ratingAvg: number
  ratingCount: number
  seoTitle: string | null
  seoDescription: string | null
  soldCount: number
  updatedAt: string
  categoryId: number | null
  categoryName: string | null
  categorySlug: string | null
  parentName: string | null
  parentSlug: string | null
  images: Array<{ id: number; url: string; alt: string | null; width: number | null; height: number | null }>
  variants: Array<{ id: number; optionName: string; optionValue: string; priceAdjustment: number; stock: number }>
  related: Array<Card>
  ratingBreakdown: Record<string, number>
}

export const STALE = { short: 30_000, medium: 120_000, long: 600_000 }

export const sessionQuery = queryOptions({ queryKey: ['session'], queryFn: () => getSession(), staleTime: 60_000 })
export const bootstrapQuery = queryOptions({ queryKey: ['bootstrap'], queryFn: () => api.get<Bootstrap>('/store/bootstrap'), staleTime: STALE.long })
export const homeQuery = queryOptions({ queryKey: ['home'], queryFn: () => api.get<Record<string, any>>('/store/home'), staleTime: STALE.medium })

export interface ShopSearch {
  q?: string
  category?: string
  min?: number
  max?: number
  material?: string
  sale?: boolean
  instock?: boolean
  new?: boolean
  sort?: string
  page?: number
}
export const productsQuery = (search: ShopSearch) =>
  queryOptions({
    queryKey: ['products', search],
    queryFn: () => api.get<ProductList>('/store/products', search),
    staleTime: STALE.short,
  })
export const productQuery = (slug: string) =>
  queryOptions({ queryKey: ['product', slug], queryFn: () => api.get<ProductDetail>(`/store/products/${slug}`), staleTime: STALE.medium })
export const categoryQuery = (slug: string) =>
  queryOptions({ queryKey: ['category', slug], queryFn: () => api.get<Record<string, any>>(`/store/categories/${slug}`), staleTime: STALE.long })
export const pageQuery = (slug: string) =>
  queryOptions({ queryKey: ['page', slug], queryFn: () => api.get<Record<string, any>>(`/store/pages/${slug}`), staleTime: STALE.long })
export const journalQuery = queryOptions({ queryKey: ['journal'], queryFn: () => api.get<Array<Record<string, any>>>('/store/journal'), staleTime: STALE.long })
export const postQuery = (slug: string) =>
  queryOptions({ queryKey: ['post', slug], queryFn: () => api.get<Record<string, any>>(`/store/journal/${slug}`), staleTime: STALE.long })
