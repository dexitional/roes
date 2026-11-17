import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { sessionQuery } from '#/lib/queries'
import { pageSeo } from '#/lib/seo'
import { useWishlist } from '#/hooks/use-wishlist'
import { Button } from '#/components/ui/button'
import { ProductGrid, ProductGridSkeleton } from '#/components/site/product-card'
import { Container } from '#/components/site/section'

export const Route = createFileRoute('/_site/wishlist')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery)
    if (!user) throw redirect({ to: '/login', search: { next: '/wishlist' } })
  },
  head: () => pageSeo({ title: 'Wishlist', description: 'Your saved pieces.', path: '/wishlist', noindex: true }),
  component: Wishlist,
})

function Wishlist() {
  const wishlist = useWishlist()
  const products = wishlist.products.filter((p) => wishlist.ids.has(p.id))
  return (
    <Container className="py-10">
      <p className="eyebrow">Saved for later</p>
      <h1 className="font-display mt-2 text-5xl font-semibold">Your wishlist</h1>
      <div className="mt-10">
        {wishlist.isLoading ? (
          <ProductGridSkeleton count={4} />
        ) : products.length ? (
          <ProductGrid products={products} source="wishlist" />
        ) : (
          <div className="rounded-3xl border border-dashed py-20 text-center">
            <Heart className="mx-auto size-10 text-primary" />
            <p className="font-display mt-4 text-3xl">Nothing saved yet</p>
            <p className="mt-2 text-muted-foreground">Tap the heart on any piece to keep it here.</p>
            <Button asChild className="mt-6">
              <Link to="/shop">Explore the shop</Link>
            </Button>
          </div>
        )}
      </div>
    </Container>
  )
}
