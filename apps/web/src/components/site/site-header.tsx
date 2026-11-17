import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Sun,
  User,
  X,
} from 'lucide-react'
import { cn } from '@roes/ui'
import { api } from '#/lib/api-client'
import { cart, useCart } from '#/lib/cart'
import { money } from '#/lib/format'
import { bootstrapQuery } from '#/lib/queries'
import type { NavCategory, ProductList } from '#/lib/queries'
import { useTheme } from '#/lib/theme'
import { useSession, useSignOut } from '#/hooks/use-session'
import { Button } from '#/components/ui/button'
import { Avatar, Kbd } from '#/components/ui/misc'
import {
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SheetContent,
} from '#/components/ui/overlay'
import { Img } from './image'
import { Logo } from './logo'
import { Container } from './section'

function useCategoryTree() {
  const { data } = useQuery(bootstrapQuery)
  return useMemo(() => {
    const list = data?.categories ?? []
    const roots = list.filter((c) => !c.parentId)
    const children = (id: number) => list.filter((c) => c.parentId === id)
    return { roots, children, all: list }
  }, [data])
}

// Navigation groups for the mega menu.
const GROUPS: Array<{ title: string; match: RegExp }> = [
  { title: 'Earrings', match: /earring|ear cuff/i },
  { title: 'Necklaces & Sets', match: /necklace|matching|statement|combo|pearl/i },
  { title: 'Wrists & Ankles', match: /bracelet|bangle|watch|anklet/i },
  { title: 'Gifts & Extras', match: /brooch|keyholder|charm|organi/i },
]

function groupCategories(all: Array<NavCategory>) {
  const used = new Set<number>()
  const groups = GROUPS.map((g) => {
    const items = all.filter((c) => !used.has(c.id) && g.match.test(c.name))
    items.forEach((c) => used.add(c.id))
    return { title: g.title, items }
  })
  const rest = all.filter((c) => !used.has(c.id))
  if (rest.length) groups[groups.length - 1]!.items.push(...rest)
  return groups.filter((g) => g.items.length)
}

export function AnnouncementBar() {
  const { data } = useQuery(bootstrapQuery)
  const a = data?.announcement
  if (!a?.enabled || !a.text) return null
  const parts = a.text.split('·').map((s) => s.trim())
  const row = (
    <div className="flex shrink-0 items-center gap-10 pr-10">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-10">
          <span>{p}</span>
          <Sparkles className="size-3 text-gold-light" />
        </span>
      ))}
    </div>
  )
  return (
    <div className="bg-wine-gradient overflow-hidden text-[0.72rem] font-semibold tracking-wide text-white/90">
      <Link to={a.link || '/shop'} className="flex h-9 items-center">
        <div className="animate-marquee flex w-max">
          {row}
          {row}
          {row}
          {row}
        </div>
      </Link>
    </div>
  )
}

function ThemeMenu() {
  const { choice, resolved, setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Theme">
          {resolved === 'dark' ? <Moon /> : <Sun />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-36">
        {(
          [
            ['light', 'Light', Sun],
            ['dark', 'Dark', Moon],
            ['system', 'System', Monitor],
          ] as const
        ).map(([value, label, Icon]) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)} className={cn(choice === value && 'font-semibold text-primary')}>
            <Icon /> {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AccountMenu() {
  const user = useSession()
  const signOut = useSignOut()
  const href = useRouterState({ select: (s) => s.location.href })
  if (!user) {
    return (
      <Button variant="ghost" size="icon" asChild aria-label="Sign in">
        <Link to="/login" search={{ next: href }}>
          <User />
        </Link>
      </Button>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="grid size-10 place-items-center rounded-full transition hover:bg-muted" aria-label="Account">
          <Avatar src={user.avatarUrl} name={user.fullName} className="size-8 ring-2 ring-gold/40" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-semibold text-foreground">{user.fullName}</div>
          <div className="truncate text-xs">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account">
            <Package /> My orders
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/wishlist">
            <Heart /> Wishlist
          </Link>
        </DropdownMenuItem>
        {user.role !== 'customer' && (
          <DropdownMenuItem asChild>
            <Link to="/admin">
              <LayoutDashboard /> Admin dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [term, setTerm] = useState('')
  const q = useDebounced(term.trim(), 180)
  const navigate = useNavigate()
  const { all } = useCategoryTree()
  const results = useQuery({
    queryKey: ['search-suggest', q],
    queryFn: () => api.get<ProductList>('/store/products', { q, pageSize: 6 }),
    enabled: q.length >= 2,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })
  const matchingCategories = q.length >= 2 ? all.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 4) : []
  const go = (to: string, search?: Record<string, unknown>) => {
    onOpenChange(false)
    setTerm('')
    void navigate({ to, search: search as never })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="top-[12vh] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (term.trim()) go('/shop', { q: term.trim() })
          }}
          className="flex items-center gap-3 border-b px-5"
        >
          <Search className="size-5 text-muted-foreground" />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search earrings, necklaces, watch sets…"
            className="h-16 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            aria-label="Search the shop"
          />
          <Kbd>Esc</Kbd>
        </form>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {q.length < 2 ? (
            <div className="p-3">
              <p className="eyebrow mb-3">Popular collections</p>
              <div className="flex flex-wrap gap-2">
                {all
                  .filter((c) => !c.parentId)
                  .slice(0, 10)
                  .map((c) => (
                    <button
                      key={c.id}
                      onClick={() => go(`/collections/${c.slug}`)}
                      className="rounded-full border px-3.5 py-1.5 text-sm transition hover:border-primary hover:text-primary"
                    >
                      {c.name}
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <>
              {matchingCategories.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2 px-2 pt-1 pb-3">
                  {matchingCategories.map((c) => (
                    <button key={c.id} onClick={() => go(`/collections/${c.slug}`)} className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                      {c.name} · {c.productCount}
                    </button>
                  ))}
                </div>
              )}
              {results.data?.data.length ? (
                <ul className="grid gap-1">
                  {results.data.data.map((p) => (
                    <li key={p.id}>
                      <button onClick={() => go(`/p/${p.slug}`)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-muted">
                        <Img src={p.image} alt="" sizes="56px" maxWidth={128} className="size-14 rounded-lg object-cover" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.categoryName}</span>
                        </span>
                        <span className="text-sm font-bold">{money(p.price)}</span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button onClick={() => go('/shop', { q })} className="flex w-full items-center justify-center gap-2 rounded-xl p-3 text-sm font-semibold text-primary hover:bg-muted">
                      See all {results.data.total} results <ArrowRight className="size-4" />
                    </button>
                  </li>
                </ul>
              ) : results.isFetching ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Searching…</p>
              ) : (
                <p className="p-6 text-center text-sm text-muted-foreground">No pieces match “{q}”. Try “earrings” or “gold”.</p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MegaMenu() {
  const { all } = useCategoryTree()
  const groups = groupCategories(all)
  const { data } = useQuery(bootstrapQuery)
  const feature = all.find((c) => c.slug === 'luxe-earrings') ?? all[0]
  // Closes after a link is clicked, until the pointer leaves the menu.
  const [suppressed, setSuppressed] = useState(false)
  const close = () => {
    setSuppressed(true)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }
  return (
    // `static` so the panel is positioned against the full-width sticky header,
    // not the Shop link, and is centred on the page instead of running off it.
    <div className="group/mega static" onMouseLeave={() => setSuppressed(false)}>
      <Link to="/shop" onClick={close} className="flex h-[4.5rem] items-center text-sm font-semibold transition hover:text-primary" activeProps={{ className: 'text-primary' }}>
        Shop
      </Link>
      <div
        className={cn(
          'invisible absolute inset-x-0 top-full z-40 translate-y-2 px-4 pt-2 opacity-0 transition-all duration-200 sm:px-6 lg:px-10',
          !suppressed && 'group-hover/mega:visible group-hover/mega:translate-y-0 group-hover/mega:opacity-100 group-focus-within/mega:visible group-focus-within/mega:translate-y-0 group-focus-within/mega:opacity-100',
        )}
        onClick={(e) => (e.target as HTMLElement).closest('a') && close()}
      >
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_1fr_1fr_1fr_15rem] gap-6 rounded-3xl border bg-popover p-7 shadow-2xl">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="eyebrow mb-3">{g.title}</p>
              <ul className="grid gap-2">
                {g.items.map((c) => (
                  <li key={c.id}>
                    <Link to="/collections/$slug" params={{ slug: c.slug }} className="text-sm text-foreground/80 transition hover:text-primary">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {feature && (
            <Link to="/collections/$slug" params={{ slug: feature.slug }} className="group/f relative overflow-hidden rounded-2xl bg-muted">
              <Img src={feature.imageUrl} alt={feature.name} sizes="240px" maxWidth={512} className="aspect-[3/4] size-full object-cover transition duration-700 group-hover/f:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <p className="text-[0.65rem] font-bold tracking-[0.2em] text-gold-light uppercase">Best sellers</p>
                <p className="font-display text-2xl">{feature.name}</p>
              </div>
            </Link>
          )}
        </div>
        {data && <p className="sr-only">{data.store.tagline}</p>}
      </div>
    </div>
  )
}

function MobileMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { roots, children } = useCategoryTree()
  const user = useSession()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" title="Menu">
        <div className="flex h-20 items-center justify-between border-b px-5">
          <Logo height={56} />
          <button onClick={() => onOpenChange(false)} className="rounded-full p-2 hover:bg-muted" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-5 py-4" onClick={(e) => (e.target as HTMLElement).closest('a') && onOpenChange(false)}>
          <div className="grid gap-1 border-b pb-4">
            <Link to="/shop" className="py-2 text-lg font-semibold">
              Shop all
            </Link>
            <Link to="/shop" search={{ sort: 'newest' }} className="py-2 text-lg font-semibold">
              New arrivals
            </Link>
            <Link to="/shop" search={{ sale: true }} className="py-2 text-lg font-semibold text-crimson">
              Sale
            </Link>
          </div>
          <p className="eyebrow mt-5 mb-2">Collections</p>
          <ul className="grid gap-0.5">
            {roots.map((c) => (
              <li key={c.id}>
                <Link to="/collections/$slug" params={{ slug: c.slug }} className="flex items-center justify-between py-2 text-[0.95rem]">
                  {c.name}
                  <span className="text-xs text-muted-foreground">{c.productCount}</span>
                </Link>
                {children(c.id).map((s) => (
                  <Link key={s.id} to="/collections/$slug" params={{ slug: s.slug }} className="block py-1.5 pl-4 text-sm text-muted-foreground">
                    {s.name}
                  </Link>
                ))}
              </li>
            ))}
          </ul>
          <div className="mt-5 grid gap-1 border-t pt-4 text-sm">
            <Link to="/journal" className="py-2">
              Journal
            </Link>
            <Link to="/pages/$slug" params={{ slug: 'about' }} className="py-2">
              About us
            </Link>
            <Link to={user ? '/account' : '/login'} className="py-2 font-semibold">
              {user ? 'My account' : 'Sign in'}
            </Link>
          </div>
        </nav>
      </SheetContent>
    </Dialog>
  )
}

export function SiteHeader() {
  const { count } = useCart()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const user = useSession()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === '/' && !(e.target as HTMLElement).closest('input, textarea, [contenteditable]')) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <>
      <AnnouncementBar />
      <header
        className={cn(
          'sticky top-0 z-40 border-b border-transparent transition-all duration-300',
          scrolled ? 'border-border bg-background/85 shadow-sm backdrop-blur-xl' : 'bg-background',
        )}
      >
        <Container className="flex h-[4.5rem] items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <Link to="/" aria-label="Roes Outlet home" className="mr-4 shrink-0">
            <Logo height={64} priority />
          </Link>
          <nav className="hidden items-center gap-7 lg:flex">
            <MegaMenu />
            <Link to="/shop" search={{ sort: 'newest' }} className="text-sm font-semibold transition hover:text-primary">
              New in
            </Link>
            <Link to="/collections/$slug" params={{ slug: 'luxe-earrings' }} className="text-sm font-semibold transition hover:text-primary">
              Earrings
            </Link>
            <Link to="/collections/$slug" params={{ slug: '4-in-1-watch-sets' }} className="text-sm font-semibold transition hover:text-primary">
              Gift sets
            </Link>
            <Link to="/shop" search={{ sale: true }} className="text-sm font-semibold text-crimson transition hover:opacity-80">
              Sale
            </Link>
            <Link to="/journal" className="text-sm font-semibold transition hover:text-primary" activeProps={{ className: 'text-primary' }}>
              Journal
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-0.5">
            <button
              onClick={() => setSearchOpen(true)}
              className="mr-1 hidden h-10 w-56 items-center gap-2 rounded-full border bg-muted/50 px-4 text-sm text-muted-foreground transition hover:border-foreground/20 md:flex xl:w-64"
            >
              <Search className="size-4" /> Search jewelry…
              <Kbd className="ml-auto">⌘K</Kbd>
            </button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearchOpen(true)} aria-label="Search">
              <Search />
            </Button>
            <ThemeMenu />
            {user && (
              <Button variant="ghost" size="icon" asChild aria-label="Wishlist" className="max-sm:hidden">
                <Link to="/wishlist">
                  <Heart />
                </Link>
              </Button>
            )}
            <AccountMenu />
            <Button variant="ghost" size="icon" className="relative" onClick={() => cart.setOpen(true)} aria-label={`Bag, ${count} items`}>
              <ShoppingBag />
              {count > 0 && (
                <span className="absolute top-1 right-0.5 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[0.62rem] leading-[18px] font-bold text-primary-foreground animate-in zoom-in">
                  {count}
                </span>
              )}
            </Button>
          </div>
        </Container>
      </header>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <MobileMenu open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  )
}
