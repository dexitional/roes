import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Gift, Instagram, Mail, MapPin, MessageCircle, Phone, RefreshCcw, ShieldCheck, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { displayPhone } from '#/lib/phone'
import { bootstrapQuery } from '#/lib/queries'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Logo } from './logo'
import { Container } from './section'

function TikTok(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.59-2.6 2.6 2.6 0 0 1 3.35-2.48V9.66A5.7 5.7 0 0 0 4.2 15.3a5.69 5.69 0 0 0 5.66 5.7 5.69 5.69 0 0 0 5.68-5.7V9a7.33 7.33 0 0 0 4.28 1.37V7.29s-1.88.09-3.22-1.47Z" />
    </svg>
  )
}
function XLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.2h1.7L7.4 4.73H5.58l11.09 14.47Z" />
    </svg>
  )
}

export function TrustStrip() {
  const items = [
    { icon: Truck, title: 'Nationwide delivery', text: 'Next-day FedEx, Speedaf or same-day bus' },
    { icon: Gift, title: 'Gift-boxed', text: 'Most pieces arrive ready to give' },
    { icon: RefreshCcw, title: 'Easy exchanges', text: 'Not quite right? Swap it' },
    { icon: ShieldCheck, title: 'Secure MoMo payment', text: 'Confirmed by SMS, every time' },
  ]
  return (
    <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
      {items.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex items-start gap-3.5">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold-soft text-gold">
            <Icon className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function Newsletter() {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        const v = value.trim()
        if (!v) return
        setBusy(true)
        try {
          await api.post('/store/subscribe', v.includes('@') ? { email: v } : { phone: v })
          toast.success('You’re on the list! Watch out for new drops.')
          setValue('')
        } catch (err) {
          toast.error(errorMessage(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Email or phone number"
        aria-label="Email or phone number"
        className="h-11 rounded-full border-white/15 bg-white/10 text-white placeholder:text-white/50 focus-visible:border-gold"
      />
      <Button type="submit" variant="gold" size="lg" loading={busy} className="h-11">
        Join
      </Button>
    </form>
  )
}

export function SiteFooter() {
  const { data } = useQuery(bootstrapQuery)
  const store = data?.store
  const featured = (data?.categories ?? []).filter((c) => !c.parentId).slice(0, 8)
  const socials = store?.socials
  return (
    <footer className="mt-24">
      <div className="border-y bg-card py-10">
        <Container>
          <TrustStrip />
        </Container>
      </div>
      <div className="bg-wine-gradient text-white">
        <Container className="grid gap-12 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div>
            <div className="inline-block rounded-2xl bg-[#fbf8f4] px-4 py-3 shadow-lg shadow-black/10">
              <Logo height={96} plain />
            </div>
            <p className="font-display mt-5 text-2xl text-gold-light italic">{store?.tagline ?? 'Luxury on budget'}</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
              Quality jewelry for women and men, young or old, in stainless steel, gold plate and sterling silver, delivered across Ghana.
            </p>
            <div className="mt-6 flex gap-2">
              {socials?.instagram && (
                <a href={`https://instagram.com/${socials.instagram}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-gold hover:text-gold-foreground">
                  <Instagram className="size-4" />
                </a>
              )}
              {socials?.tiktok && (
                <a href={`https://tiktok.com/@${socials.tiktok}`} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-gold hover:text-gold-foreground">
                  <TikTok className="size-4" />
                </a>
              )}
              {socials?.twitter && (
                <a href={`https://twitter.com/${socials.twitter}`} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-gold hover:text-gold-foreground">
                  <XLogo className="size-4" />
                </a>
              )}
              {store?.whatsapp && (
                <a
                  href={`https://wa.me/233${store.whatsapp.replace(/\D/g, '').replace(/^0/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-gold hover:text-gold-foreground"
                >
                  <MessageCircle className="size-4" />
                </a>
              )}
            </div>
          </div>
          <div>
            <p className="mb-4 text-xs font-bold tracking-[0.2em] text-gold-light uppercase">Shop</p>
            <ul className="grid gap-2.5 text-sm text-white/75">
              <li>
                <Link to="/shop" search={{ sort: 'newest' }} className="hover:text-white">
                  New arrivals
                </Link>
              </li>
              {featured.map((c) => (
                <li key={c.id}>
                  <Link to="/collections/$slug" params={{ slug: c.slug }} className="hover:text-white">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-4 text-xs font-bold tracking-[0.2em] text-gold-light uppercase">Help</p>
            <ul className="grid gap-2.5 text-sm text-white/75">
              {(data?.footerPages ?? []).map((p) => (
                <li key={p.slug}>
                  <Link to="/pages/$slug" params={{ slug: p.slug }} className="hover:text-white">
                    {p.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/journal" className="hover:text-white">
                  Journal
                </Link>
              </li>
              <li>
                <Link to="/account" className="hover:text-white">
                  Track an order
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-xs font-bold tracking-[0.2em] text-gold-light uppercase">Be first to new drops</p>
            <p className="mb-4 text-sm text-white/70">New pieces sell out fast. Get a heads-up by email or SMS.</p>
            <Newsletter />
            <ul className="mt-7 grid gap-2.5 text-sm text-white/75">
              {store?.phone && (
                <li className="flex items-center gap-2.5">
                  <Phone className="size-4 text-gold-light" />
                  <a href={`tel:${store.phone}`}>{displayPhone(store.phone)}</a>
                </li>
              )}
              {store?.email && (
                <li className="flex items-center gap-2.5">
                  <Mail className="size-4 text-gold-light" />
                  <a href={`mailto:${store.email}`}>{store.email}</a>
                </li>
              )}
              {store?.address && (
                <li className="flex items-center gap-2.5">
                  <MapPin className="size-4 text-gold-light" />
                  {store.address}
                </li>
              )}
            </ul>
          </div>
        </Container>
        <div className="border-t border-white/10">
          <Container className="flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-white/55">
            <p>© {new Date().getFullYear()} Roes Outlet. All rights reserved.</p>
            <p className="flex items-center gap-2">
              We accept <span className="rounded bg-[#ffcc00] px-1.5 py-0.5 font-bold text-black">MTN MoMo</span>
              <span className="rounded bg-[#e60000] px-1.5 py-0.5 font-bold text-white">Telecel Cash</span>
              <span className="rounded bg-[#0055a5] px-1.5 py-0.5 font-bold text-white">AT Money</span>
            </p>
          </Container>
        </div>
      </div>
    </footer>
  )
}
