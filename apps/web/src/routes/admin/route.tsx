import { useState } from 'react'
import { Link, Outlet, createFileRoute, redirect, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  ExternalLink,
  FileText,
  FolderTree,
  Image,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Monitor,
  Moon,
  Package,
  Settings,
  ShoppingCart,
  Star,
  Sun,
  TicketPercent,
  UserCog,
  Users,
  GalleryHorizontalEnd,
} from 'lucide-react'
import { cn } from '@roes/ui'
import { api } from '#/lib/api-client'
import { sessionQuery } from '#/lib/queries'
import { useTheme } from '#/lib/theme'
import { useSignOut } from '#/hooks/use-session'
import { Avatar } from '#/components/ui/misc'
import { Dialog, SheetContent } from '#/components/ui/overlay'
import { Logo } from '#/components/site/logo'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery)
    if (!user) throw redirect({ to: '/admin/login', search: { next: location.href } })
    if (user.role === 'customer') throw redirect({ to: '/' })
    return { user }
  },
  head: () => ({ meta: [{ title: 'Roes Outlet Admin' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: AdminLayout,
})

type NavItem = { to: string; label: string; icon: typeof Package; exact?: boolean; badge?: 'orders' | 'reviews'; adminOnly?: boolean }
const NAV: Array<{ title: string; items: Array<NavItem> }> = [
  {
    title: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { to: '/admin/analytics', label: 'Product analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: ShoppingCart, badge: 'orders' },
      { to: '/admin/customers', label: 'Customers', icon: Users },
      { to: '/admin/coupons', label: 'Discounts', icon: TicketPercent },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { to: '/admin/products', label: 'Products', icon: Package },
      { to: '/admin/categories', label: 'Collections', icon: FolderTree },
      { to: '/admin/reviews', label: 'Reviews', icon: Star, badge: 'reviews' },
    ],
  },
  {
    title: 'Content',
    items: [
      { to: '/admin/content', label: 'Pages & journal', icon: FileText },
      { to: '/admin/slides', label: 'Homepage slides', icon: GalleryHorizontalEnd },
      { to: '/admin/media', label: 'Media library', icon: Image },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/admin/sms', label: 'SMS', icon: MessageSquareText },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
      { to: '/admin/staff', label: 'Staff', icon: UserCog, adminOnly: true },
    ],
  },
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = Route.useRouteContext()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const badges = useQuery({
    queryKey: ['admin', 'badges'],
    queryFn: () => api.get<{ orders: number; reviews: number }>('/admin/badges'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
  const signOut = useSignOut()
  const { choice, setTheme } = useTheme()
  return (
    <div className="flex h-full flex-col">
      <Link to="/admin" className="flex h-20 items-center gap-2 px-5" onClick={onNavigate}>
        <Logo height={54} />
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-bold tracking-widest text-primary uppercase">Admin</span>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => (
          <div key={g.title} className="mt-4">
            <p className="px-3 pb-1.5 text-[0.65rem] font-bold tracking-[0.15em] text-muted-foreground/80 uppercase">{g.title}</p>
            {g.items
              .filter((i) => !i.adminOnly || user.role === 'admin')
              .map((item) => {
                const active = item.exact ? path === item.to || path === `${item.to}/` : path.startsWith(item.to)
                const count = item.badge ? badges.data?.[item.badge] : 0
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-foreground/75 transition hover:bg-muted hover:text-foreground',
                      active && 'bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary hover:text-primary-foreground',
                    )}
                  >
                    <item.icon className="size-4" />
                    <span className="flex-1">{item.label}</span>
                    {count ? (
                      <span className={cn('rounded-full px-1.5 text-[0.65rem] font-bold', active ? 'bg-white/25' : 'bg-crimson text-white')}>{count}</span>
                    ) : null}
                  </Link>
                )
              })}
          </div>
        ))}
      </nav>
      <div className="border-t p-3">
        <div className="mb-2 flex gap-1 rounded-xl bg-muted p-1">
          {(
            [
              ['light', Sun],
              ['dark', Moon],
              ['system', Monitor],
            ] as const
          ).map(([v, Icon]) => (
            <button key={v} onClick={() => setTheme(v)} className={cn('flex flex-1 justify-center rounded-lg py-1.5 text-muted-foreground transition', choice === v && 'bg-card text-foreground shadow-sm')} aria-label={v}>
              <Icon className="size-4" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 rounded-xl p-2">
          <Avatar src={user.avatarUrl} name={user.fullName} className="size-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="truncate text-xs text-muted-foreground capitalize">{user.role}</p>
          </div>
          <a href="/" target="_blank" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="View store">
            <ExternalLink className="size-4" />
          </a>
          <button onClick={() => void signOut('/admin/login')} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Sign out">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar lg:block">
        <Sidebar />
      </aside>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-muted" aria-label="Menu">
          <Menu className="size-5" />
        </button>
        <Logo height={40} />
        <span className="font-semibold">Admin</span>
      </header>
      <Dialog open={open} onOpenChange={setOpen}>
        <SheetContent side="left" title="Admin menu" className="bg-sidebar">
          <Sidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Dialog>
      <main className="lg:pl-64">
        <div className="mx-auto max-w-[96rem] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
