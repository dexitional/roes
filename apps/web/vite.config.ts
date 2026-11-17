import { defineConfig, loadEnv } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    define: {
      // Optional CDN origin for /files and /img (src/lib/image.ts).
      __CDN_URL__: JSON.stringify((env.CDN_URL ?? '').trim().replace(/\/+$/, '')),
      // The public address, for canonical links and structured data (src/lib/seo.ts).
      __SITE_URL__: JSON.stringify((env.APP_URL ?? '').trim().replace(/\/+$/, '')),
    },
    // Optional overrides for when node_modules/.vite or .nitro aren't writable.
    cacheDir: process.env.VITE_CACHE_DIR,
    resolve: { tsconfigPaths: true },
    server: {
      // Compile the storefront and admin in the background at startup instead of on first visit.
      warmup: { clientFiles: ['./src/routes/**/*.tsx', './src/components/**/*.tsx'] },
    },
    build: { chunkSizeWarningLimit: 900 },
    plugins: [
      nitro({
        ...(process.env.NITRO_BUILD_DIR ? { buildDir: process.env.NITRO_BUILD_DIR } : {}),
        compressPublicAssets: { gzip: true, brotli: true },
        handlers: [
          // Image optimiser: resized AVIF/WebP variants, cached on disk and for a year in browsers.
          { route: '/img', method: 'GET', handler: './src/server/img-handler.ts' },
          // Uploaded and imported photos in local storage.
          { route: '/files/**', handler: './src/server/files-handler.ts' },
          { route: '/sitemap.xml', method: 'GET', handler: './src/server/sitemap-handler.ts' },
          { route: '/robots.txt', method: 'GET', handler: './src/server/robots-handler.ts' },
        ],
        routeRules: {
          '/assets/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
          '/logo.jpg': { headers: { 'cache-control': 'public, max-age=604800' } },
          '/logo-mark.png': { headers: { 'cache-control': 'public, max-age=604800' } },
          '/favicon.png': { headers: { 'cache-control': 'public, max-age=604800' } },
        },
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})
