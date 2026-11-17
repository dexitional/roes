// API calls made during SSR go straight into the Hono app in-process,
// carrying the visitor's cookies.
import { getRequestHeader } from '@tanstack/react-start/server'

export async function serverFetch(path: string, init?: RequestInit) {
  const { apiApp } = await import('./api/app')
  const headers = new Headers(init?.headers)
  for (const name of ['cookie', 'user-agent', 'accept-language']) {
    try {
      const value = getRequestHeader(name)
      if (value) headers.set(name, value)
    } catch {
      // Outside a request.
    }
  }
  const url = new URL(path.replace(/^\/api/, '') || '/', 'http://internal.roes')
  return apiApp.fetch(new Request(url, { ...init, headers }))
}
