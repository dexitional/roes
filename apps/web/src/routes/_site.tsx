import { Outlet, createFileRoute } from '@tanstack/react-router'
import { bootstrapQuery, sessionQuery } from '#/lib/queries'
import { CartDrawer } from '#/components/site/cart-drawer'
import { SiteFooter } from '#/components/site/site-footer'
import { SiteHeader } from '#/components/site/site-header'

export const Route = createFileRoute('/_site')({
  // Navigation, settings and the session are cached, so this costs nothing after the first page.
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(bootstrapQuery), context.queryClient.ensureQueryData(sessionQuery)]),
  component: SiteLayout,
})

function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
      <CartDrawer />
    </div>
  )
}
