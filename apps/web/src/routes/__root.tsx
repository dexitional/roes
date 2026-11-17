import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { THEME_SCRIPT } from '#/lib/theme'
import { ORGANIZATION, SITE_URL, websiteJsonLd } from '#/lib/seo'
import { NotFound } from '#/components/site/not-found'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Roes Outlet | Luxury Jewelry on a Budget in Ghana' },
      {
        name: 'description',
        content:
          'Shop affordable luxury jewelry in Ghana: luxe earrings, gold and silver necklaces, bracelet and watch sets, brooches and gift-boxed combos. Nationwide delivery.',
      },
      { name: 'theme-color', content: '#86012a', media: '(prefers-color-scheme: light)' },
      { name: 'theme-color', content: '#1a0c11', media: '(prefers-color-scheme: dark)' },
      { name: 'format-detection', content: 'telephone=no' },
      { name: 'application-name', content: 'Roes Outlet' },
      { property: 'og:site_name', content: 'Roes Outlet' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.png', type: 'image/png', sizes: '64x64' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'stylesheet', href: appCss },
      { rel: 'alternate', hrefLang: 'en-GH', href: SITE_URL },
    ],
    scripts: [
      // Applies the saved light/dark theme before first paint (no flash).
      { children: THEME_SCRIPT },
      { type: 'application/ld+json', children: JSON.stringify([ORGANIZATION, websiteJsonLd()]).replace(/</g, '\\u003c') },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GH" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster position="top-center" richColors closeButton theme="system" toastOptions={{ className: 'rounded-2xl' }} />
        <Scripts />
      </body>
    </html>
  )
}
