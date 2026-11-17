import { QueryClient } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'
import { RouteError } from '#/components/site/route-error'

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 10 * 60_000, retry: 1, refetchOnWindowFocus: false },
    },
  })
  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Prefetch a page's data (and code) as soon as a link is hovered or touched.
    defaultPreload: 'intent',
    defaultPreloadDelay: 40,
    // Leave freshness to TanStack Query's staleTime.
    defaultPreloadStaleTime: 0,
    // Pages show their own skeletons while their data streams in; a full-page
    // pending state appears only if a navigation takes a noticeable moment.
    defaultPendingMs: 250,
    defaultPendingMinMs: 200,
    defaultViewTransition: true,
    defaultErrorComponent: RouteError,
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
