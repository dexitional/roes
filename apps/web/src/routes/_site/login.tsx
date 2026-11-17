import { useState } from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Heart, Package, Sparkles } from 'lucide-react'
import { api } from '#/lib/api-client'
import { sessionQuery } from '#/lib/queries'
import { pageSeo } from '#/lib/seo'
import { googleUrl } from '#/hooks/use-session'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Logo } from '#/components/site/logo'
import { Container } from '#/components/site/section'

const ERRORS: Record<string, string> = {
  google_not_configured: 'Google sign-in is not set up on this server yet.',
  google_failed: 'Google could not confirm your account. Please try again.',
  cancelled: 'Sign-in was cancelled.',
  invalid_state: 'That sign-in link expired. Please try again.',
  account_disabled: 'This account has been disabled. Please contact us.',
}

const safe = (next?: string) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/account')

export const Route = createFileRoute('/_site/login')({
  validateSearch: z.object({ next: z.string().optional().catch(undefined), error: z.string().optional().catch(undefined) }),
  beforeLoad: async ({ context, search }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery)
    if (user) throw redirect({ href: safe(search.next) })
  },
  head: () => pageSeo({ title: 'Sign in', description: 'Sign in to Roes Outlet with Google.', path: '/login', noindex: true }),
  component: Login,
})

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

function Login() {
  const { next, error } = Route.useSearch()
  const target = safe(next)
  const config = useQuery({ queryKey: ['auth-config'], queryFn: () => api.get<{ google: boolean; devLogin: boolean }>('/auth/config'), staleTime: Infinity })
  const [devEmail, setDevEmail] = useState('')
  return (
    <Container className="grid min-h-[75vh] place-items-center py-16">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[2rem] border bg-card shadow-2xl lg:grid-cols-2">
        <div className="bg-wine-gradient relative hidden p-10 text-white lg:block">
          <div className="inline-block rounded-2xl bg-[#fbf8f4] px-3 py-2"><Logo height={84} plain /></div>
          <h2 className="font-display mt-8 text-5xl leading-none">Welcome to the inner circle</h2>
          <ul className="mt-10 grid gap-5 text-sm text-white/85">
            <li className="flex items-center gap-3">
              <Package className="size-5 text-gold-light" /> Track every order, with SMS updates
            </li>
            <li className="flex items-center gap-3">
              <Heart className="size-5 text-gold-light" /> Save favourites to your wishlist
            </li>
            <li className="flex items-center gap-3">
              <Sparkles className="size-5 text-gold-light" /> First to know about new drops
            </li>
          </ul>
        </div>
        <div className="p-8 sm:p-12">
          <p className="eyebrow">Sign in or create an account</p>
          <h1 className="font-display mt-2 text-4xl font-semibold">One tap with Google</h1>
          <p className="mt-3 text-sm text-muted-foreground">No passwords to remember. New here? Your account is created automatically.</p>
          {error && <p className="mt-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{ERRORS[error] ?? 'Sign-in failed. Please try again.'}</p>}
          <Button asChild size="xl" variant="outline" className="mt-8 w-full border-2">
            <a href={googleUrl(target)}>
              <GoogleIcon /> Continue with Google
            </a>
          </Button>
          {config.data && !config.data.google && !config.data.devLogin && (
            <p className="mt-3 text-xs text-muted-foreground">Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.</p>
          )}
          {config.data?.devLogin && (
            <form
              className="mt-8 rounded-2xl border border-dashed p-4"
              onSubmit={(e) => {
                e.preventDefault()
                window.location.href = `/api/auth/dev?email=${encodeURIComponent(devEmail)}&next=${encodeURIComponent(target)}`
              }}
            >
              <p className="text-xs font-semibold text-muted-foreground">Development sign-in (DEV_LOGIN=true)</p>
              <div className="mt-2 flex gap-2">
                <Input type="email" required value={devEmail} onChange={(e) => setDevEmail(e.target.value)} placeholder="you@example.com" />
                <Button type="submit" variant="secondary">
                  Go
                </Button>
              </div>
            </form>
          )}
          <p className="mt-8 text-xs text-muted-foreground">
            By continuing you agree to our{' '}
            <Link to="/pages/$slug" params={{ slug: 'terms' }} className="underline">
              terms
            </Link>{' '}
            and{' '}
            <Link to="/pages/$slug" params={{ slug: 'privacy' }} className="underline">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </Container>
  )
}
