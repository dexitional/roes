import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Bell, CheckCircle2, CreditCard, Globe, Megaphone, Plus, Store, Trash2, Truck, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { StoreSettings } from '@roes/db/settings'
import { api, errorMessage } from '#/lib/api-client'
import { Button } from '#/components/ui/button'
import { Field, Input, Textarea } from '#/components/ui/input'
import { Badge, Skeleton, Switch } from '#/components/ui/misc'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/overlay'
import { PageHeader, Section } from '#/components/admin/kit'

export const Route = createFileRoute('/admin/settings')({
  validateSearch: z.object({ tab: z.string().optional().catch(undefined) }),
  component: Settings,
})

interface SettingsResponse {
  settings: StoreSettings
  integrations: { sms: { configured: boolean; simulated: boolean }; paystack: boolean; google: boolean }
}

function useSection<K extends keyof StoreSettings>(key: K, initial: StoreSettings[K] | undefined) {
  const qc = useQueryClient()
  const [value, setValue] = useState<StoreSettings[K] | undefined>(initial)
  useEffect(() => setValue(initial), [initial])
  const save = useMutation({
    mutationFn: () => api.put<SettingsResponse>(`/admin/settings/${key}`, value),
    onSuccess: (r) => {
      qc.setQueryData(['admin', 'settings'], (old: SettingsResponse | undefined) => (old ? { ...old, settings: r.settings } : old))
      qc.removeQueries({ queryKey: ['bootstrap'] })
      toast.success('Settings saved')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const patch = (p: Partial<StoreSettings[K]>) => setValue((v) => (v ? { ...v, ...p } : v))
  return { value, patch, save }
}

function SaveBar({ save, disabled }: { save: { mutate: () => void; isPending: boolean }; disabled?: boolean }) {
  return (
    <div className="mt-6 flex justify-end border-t pt-5">
      <Button onClick={() => save.mutate()} loading={save.isPending} disabled={disabled}>
        Save changes
      </Button>
    </div>
  )
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge tone={ok ? 'success' : 'neutral'}>
      {ok ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />} {label}
    </Badge>
  )
}

function Settings() {
  const { user } = Route.useRouteContext()
  const { tab = 'store' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api.get<SettingsResponse>('/admin/settings') })
  const s = data?.settings
  const store = useSection('store', s?.store)
  const payments = useSection('payments', s?.payments)
  const delivery = useSection('delivery', s?.delivery)
  const notifications = useSection('notifications', s?.notifications)
  const seo = useSection('seo', s?.seo)
  const announcement = useSection('announcement', s?.announcement)
  const readOnly = user.role !== 'admin'

  if (!data || !store.value || !payments.value || !delivery.value || !notifications.value || !seo.value || !announcement.value) {
    return <Skeleton className="h-[70vh] rounded-2xl" />
  }
  return (
    <>
      <PageHeader eyebrow="System" title="Settings" description={readOnly ? 'Only administrators can change settings.' : 'Store details, payments, delivery, notifications and SEO.'} />
      <Tabs value={tab} onValueChange={(t) => void navigate({ search: { tab: t } })}>
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="store">
            <Store className="size-4" /> Store
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="size-4" /> Payments
          </TabsTrigger>
          <TabsTrigger value="delivery">
            <Truck className="size-4" /> Delivery
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="size-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="seo">
            <Globe className="size-4" /> SEO
          </TabsTrigger>
          <TabsTrigger value="announcement">
            <Megaphone className="size-4" /> Announcement
          </TabsTrigger>
        </TabsList>

        <fieldset disabled={readOnly} className="max-w-4xl">
          <TabsContent value="store">
            <Section title="Store details" description="Shown in the footer, on receipts and in Google results.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Store name">
                  <Input value={store.value.name} onChange={(e) => store.patch({ name: e.target.value })} />
                </Field>
                <Field label="Tagline">
                  <Input value={store.value.tagline} onChange={(e) => store.patch({ tagline: e.target.value })} />
                </Field>
                <Field label="About" className="sm:col-span-2">
                  <Textarea value={store.value.about} onChange={(e) => store.patch({ about: e.target.value })} />
                </Field>
                <Field label="Email">
                  <Input value={store.value.email} onChange={(e) => store.patch({ email: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <Input value={store.value.phone} onChange={(e) => store.patch({ phone: e.target.value })} />
                </Field>
                <Field label="WhatsApp number">
                  <Input value={store.value.whatsapp} onChange={(e) => store.patch({ whatsapp: e.target.value })} />
                </Field>
                <Field label="Address">
                  <Input value={store.value.address} onChange={(e) => store.patch({ address: e.target.value })} />
                </Field>
                {(['instagram', 'tiktok', 'twitter', 'facebook', 'snapchat'] as const).map((k) => (
                  <Field key={k} label={`${k[0]!.toUpperCase()}${k.slice(1)} handle`}>
                    <Input value={store.value!.socials[k]} onChange={(e) => store.patch({ socials: { ...store.value!.socials, [k]: e.target.value } })} />
                  </Field>
                ))}
              </div>
              {!readOnly && <SaveBar save={store.save} />}
            </Section>
          </TabsContent>

          <TabsContent value="payments">
            <Section
              title="Mobile Money"
              description="Every order is paid to this MoMo number. Customers see it after checkout and enter their transaction ID; you confirm it on the order."
              actions={<Status ok label="Active" />}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="MoMo number">
                  <Input value={payments.value.momoNumber} onChange={(e) => payments.patch({ momoNumber: e.target.value })} />
                </Field>
                <Field label="Account name">
                  <Input value={payments.value.momoName} onChange={(e) => payments.patch({ momoName: e.target.value })} />
                </Field>
                <Field label="Network">
                  <Input value={payments.value.momoNetwork} onChange={(e) => payments.patch({ momoNetwork: e.target.value })} placeholder="MTN MoMo" />
                </Field>
                <Field label="Instructions for customers" className="sm:col-span-3">
                  <Textarea value={payments.value.instructions} onChange={(e) => payments.patch({ instructions: e.target.value })} />
                </Field>
              </div>
              {!readOnly && <SaveBar save={payments.save} />}
            </Section>
            <Section
              title="Paystack (card & MoMo online)"
              description="Provisioned for later. Set PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY on the server, register the webhook /api/payments/paystack/webhook, then switch it on here."
              actions={<Status ok={data.integrations.paystack} label={data.integrations.paystack ? 'Keys found' : 'No keys'} />}
              className="mt-6"
            >
              <label className="flex items-center justify-between text-sm">
                Offer Paystack at checkout
                <Switch checked={payments.value.paystackEnabled} disabled={!data.integrations.paystack} onCheckedChange={(v) => payments.patch({ paystackEnabled: v })} />
              </label>
              {!readOnly && <SaveBar save={payments.save} />}
            </Section>
          </TabsContent>

          <TabsContent value="delivery">
            <Section title="Delivery fees" description="Fees by region. Regions not listed use the default fee.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Default delivery fee (GH₵)">
                  <Input type="number" value={delivery.value.defaultFee} onChange={(e) => delivery.patch({ defaultFee: Number(e.target.value) })} />
                </Field>
                <Field label="Free delivery over (GH₵)" hint="0 turns free delivery off.">
                  <Input type="number" value={delivery.value.freeOver} onChange={(e) => delivery.patch({ freeOver: Number(e.target.value) })} />
                </Field>
              </div>
              <div className="mt-5 grid gap-2">
                {delivery.value.regions.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_8rem_2.5rem] gap-2">
                    <Input value={r.name} onChange={(e) => delivery.patch({ regions: delivery.value!.regions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    <Input type="number" value={r.fee} onChange={(e) => delivery.patch({ regions: delivery.value!.regions.map((x, j) => (j === i ? { ...x, fee: Number(e.target.value) } : x)) })} />
                    <Button variant="ghost" size="icon" onClick={() => delivery.patch({ regions: delivery.value!.regions.filter((_, j) => j !== i) })} aria-label="Remove region">
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="justify-self-start" onClick={() => delivery.patch({ regions: [...delivery.value!.regions, { name: '', fee: delivery.value!.defaultFee }] })}>
                  <Plus /> Add region
                </Button>
              </div>
              <div className="mt-5 grid gap-4">
                <Field label="Pickup address">
                  <Textarea value={delivery.value.pickupAddress} onChange={(e) => delivery.patch({ pickupAddress: e.target.value })} className="min-h-16" />
                </Field>
                <Field label="Delivery note" hint="Shown on product pages.">
                  <Textarea value={delivery.value.note} onChange={(e) => delivery.patch({ note: e.target.value })} className="min-h-16" />
                </Field>
              </div>
              {!readOnly && <SaveBar save={delivery.save} />}
            </Section>
          </TabsContent>

          <TabsContent value="notifications">
            <Section
              title="SMS notifications"
              description="Sent with SMSOnlineGH. The sender ID must be registered in your SMSOnlineGH account."
              actions={<Status ok={data.integrations.sms.configured} label={data.integrations.sms.configured ? 'Gateway connected' : data.integrations.sms.simulated ? 'Simulated' : 'No API key'} />}
            >
              <div className="grid gap-4">
                <label className="flex items-center justify-between text-sm font-semibold">
                  Send SMS notifications <Switch checked={notifications.value.smsEnabled} onCheckedChange={(v) => notifications.patch({ smsEnabled: v })} />
                </label>
                <Field label="Sender ID" hint="Up to 11 letters or numbers, e.g. RoesOutlet.">
                  <Input value={notifications.value.smsSender} maxLength={11} onChange={(e) => notifications.patch({ smsSender: e.target.value })} />
                </Field>
                <Field label="Admin phones for new-order alerts" hint="Comma-separated. These numbers get a text for every new order and every MoMo payment sent.">
                  <Input value={notifications.value.adminPhones.join(', ')} onChange={(e) => notifications.patch({ adminPhones: e.target.value.split(',').map((x) => x.trim()) })} />
                </Field>
                <div className="grid gap-3 rounded-2xl bg-muted/50 p-4 text-sm">
                  <p className="font-semibold">Text customers when…</p>
                  <label className="flex items-center justify-between">
                    they place an order (with MoMo payment details) <Switch checked={notifications.value.orderPlaced} onCheckedChange={(v) => notifications.patch({ orderPlaced: v })} />
                  </label>
                  <label className="flex items-center justify-between">
                    their payment is confirmed <Switch checked={notifications.value.paymentConfirmed} onCheckedChange={(v) => notifications.patch({ paymentConfirmed: v })} />
                  </label>
                  <label className="flex items-center justify-between">
                    their order status changes (preparing, shipped, delivered…) <Switch checked={notifications.value.statusChanged} onCheckedChange={(v) => notifications.patch({ statusChanged: v })} />
                  </label>
                </div>
              </div>
              {!readOnly && <SaveBar save={notifications.save} />}
            </Section>
          </TabsContent>

          <TabsContent value="seo">
            <Section title="Search engine defaults" description="Product, collection and journal pages each have their own SEO fields; these are the fallbacks.">
              <div className="grid gap-4">
                <Field label="Title suffix">
                  <Input value={seo.value.titleSuffix} onChange={(e) => seo.patch({ titleSuffix: e.target.value })} />
                </Field>
                <Field label="Default description" hint={`${seo.value.defaultDescription.length}/160`}>
                  <Textarea value={seo.value.defaultDescription} onChange={(e) => seo.patch({ defaultDescription: e.target.value })} />
                </Field>
                <Field label="Keywords">
                  <Input value={seo.value.keywords} onChange={(e) => seo.patch({ keywords: e.target.value })} />
                </Field>
                <div className="rounded-2xl bg-muted/50 p-4 text-sm">
                  <p className="font-semibold">Built in</p>
                  <ul className="mt-2 grid gap-1 text-muted-foreground">
                    <li>
                      • <a href="/sitemap.xml" target="_blank" className="text-primary underline">sitemap.xml</a> with every product photo, and{' '}
                      <a href="/robots.txt" target="_blank" className="text-primary underline">robots.txt</a>
                    </li>
                    <li>• Product, Offer, Review, Breadcrumb, Store and Article structured data</li>
                    <li>• Canonical URLs, Open Graph & Twitter cards, image alt text</li>
                    <li>• Server-rendered pages with AVIF/WebP images for fast Core Web Vitals</li>
                  </ul>
                  <p className="mt-3">Submit the sitemap in Google Search Console once the site is live.</p>
                </div>
              </div>
              {!readOnly && <SaveBar save={seo.save} />}
            </Section>
          </TabsContent>

          <TabsContent value="announcement">
            <Section title="Announcement bar" description="The scrolling strip at the very top of the store. Separate messages with ·">
              <div className="grid gap-4">
                <label className="flex items-center justify-between text-sm font-semibold">
                  Show the bar <Switch checked={announcement.value.enabled} onCheckedChange={(v) => announcement.patch({ enabled: v })} />
                </label>
                <Field label="Text">
                  <Input value={announcement.value.text} onChange={(e) => announcement.patch({ text: e.target.value })} />
                </Field>
                <Field label="Link">
                  <Input value={announcement.value.link} onChange={(e) => announcement.patch({ link: e.target.value })} />
                </Field>
              </div>
              {!readOnly && <SaveBar save={announcement.save} />}
            </Section>
          </TabsContent>
        </fieldset>
      </Tabs>
    </>
  )
}
