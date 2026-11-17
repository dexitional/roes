import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import type { Card } from '#/lib/queries'
import { useSession } from './use-session'

interface Wishlist {
  ids: Array<number>
  products: Array<Card>
}

export function useWishlist() {
  const user = useSession()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const query = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => api.get<Wishlist>('/me/wishlist'),
    enabled: Boolean(user),
    staleTime: 60_000,
  })
  const ids = new Set(query.data?.ids ?? [])
  const toggle = useMutation({
    mutationFn: (productId: number) => api.post<{ saved: boolean }>(`/me/wishlist/${productId}`),
    onMutate: async (productId) => {
      await qc.cancelQueries({ queryKey: ['wishlist'] })
      const prev = qc.getQueryData<Wishlist>(['wishlist'])
      if (prev) {
        const has = prev.ids.includes(productId)
        qc.setQueryData<Wishlist>(['wishlist'], {
          ...prev,
          ids: has ? prev.ids.filter((i) => i !== productId) : [productId, ...prev.ids],
        })
      }
      return { prev }
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['wishlist'], ctx.prev)
      toast.error(errorMessage(err))
    },
    onSuccess: (r) => toast.success(r.saved ? 'Saved to your wishlist' : 'Removed from your wishlist'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  })
  return {
    ids,
    products: query.data?.products ?? [],
    isLoading: query.isLoading,
    has: (id: number) => ids.has(id),
    toggle: (id: number) => {
      if (!user) {
        toast('Sign in to save favourites', { description: 'It takes one tap with Google.' })
        void navigate({ to: '/login', search: { next: href } })
        return
      }
      toggle.mutate(id)
    },
  }
}
