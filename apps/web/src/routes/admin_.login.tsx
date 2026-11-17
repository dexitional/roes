import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { sessionQuery } from '#/lib/queries'
import { googleUrl } from '#/hooks/use-session'
import { Button } from '#/components/ui/button'
import { Field, Input } from '#/components/ui/input'
import { Logo } from '#/components/site/logo'

const safe = (next?: string) => (next && next.startsWith('/admin') ? next : '/admin')

export const Route = createFileRoute('/admin_/login')({
  validateSearch: z.object({ next: z.string().optional().catch(undefined) }),
  beforeLoad: async ({ context, search }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery)
    if (user && user.role !== 'customer') throw redirect({ href: safe(search.next) })
  },
  head: () => ({ meta: [{ title: 'Admin sign in | Roes Outlet' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: AdminLogin,
})

function AdminLogin() {
  const { next } = Route.useSearch()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="bg-wine-gradient grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md rounded-[2rem] bg-card p-8 shadow-2xl sm:p-10">
        <Logo height={96} plain className="-ml-1" />
        <h1 className="mt-8 text-2xl font-bold">Admin sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage products, orders and content.</p>
        <form
          className="mt-8 grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            try {
              await api.post('/auth/admin/login', { email, password })
              await qc.invalidateQueries({ queryKey: sessionQuery.queryKey })
              await navigate({ href: safe(next) })
            } catch (err) {
              toast.error(errorMessage(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          <Field label="Email">
            <Input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" loading={busy} className="mt-2">
            <Lock /> Sign in
          </Button>
        </form>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>
        <Button asChild variant="outline" className="w-full">
          <a href={googleUrl(safe(next))}>Continue with Google (staff accounts)</a>
        </Button>
      </div>
    </div>
  )
}
