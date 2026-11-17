import { createFileRoute } from '@tanstack/react-router'

// Hands /api/* to the Hono app. The app is imported dynamically INSIDE the
// handler: routeTree.gen.ts imports every route file into both bundles, and a
// static import here would drag mysql2 and friends into the browser.
export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const { apiApp } = await import('#/server/api/app')
        const url = new URL(request.url)
        url.pathname = url.pathname.replace(/^\/api/, '') || '/'
        const rewritten = new Request(url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          duplex: 'half',
        } as RequestInit & { duplex: 'half' })
        return apiApp.fetch(rewritten)
      },
    },
  },
})
