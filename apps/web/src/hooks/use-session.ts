import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { api } from '#/lib/api-client'
import { sessionQuery } from '#/lib/queries'

export function useSession() {
  const { data } = useQuery(sessionQuery)
  return data ?? null
}

export function useSignOut() {
  const qc = useQueryClient()
  const router = useRouter()
  return async (to = '/') => {
    await api.post('/auth/logout')
    qc.setQueryData(sessionQuery.queryKey, null)
    qc.removeQueries({ queryKey: ['wishlist'] })
    qc.removeQueries({ queryKey: ['me'] })
    await router.invalidate()
    await router.navigate({ to })
  }
}

/** Where "Continue with Google" sends the shopper. */
export const googleUrl = (next: string) => `/api/auth/google?next=${encodeURIComponent(next)}`
