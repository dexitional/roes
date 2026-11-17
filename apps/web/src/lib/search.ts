import { z } from 'zod'
import type { ShopSearch } from './queries'

const flag = z
  .union([z.boolean(), z.literal('1'), z.literal('true'), z.literal(1)])
  .transform(() => true)
  .optional()
  .catch(undefined)
const positive = z.coerce.number().min(0).optional().catch(undefined)

// Shop/collection URL search params, validated (bad values are dropped, not errors).
export const shopSearchSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.string().max(150).optional().catch(undefined),
  min: positive,
  max: positive,
  material: z.string().max(80).optional().catch(undefined),
  sale: flag,
  instock: flag,
  new: flag,
  sort: z.enum(['featured', 'newest', 'popular', 'price-asc', 'price-desc', 'relevance']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
})

export const validateShopSearch = (input: Record<string, unknown>): ShopSearch => shopSearchSchema.parse(input)
