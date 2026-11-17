import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, CheckCircle2, MessageCircle, MessageSquareText, Phone, Printer, Send, Smartphone, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ORDER_STATUSES } from '@roes/db/types'
import type { OrderStatus, PaymentStatus } from '@roes/db/types'
import { api, errorMessage } from '#/lib/api-client'
import { dateTime, money } from '#/lib/format'
import { ORDER_STATUS_LABELS } from '#/lib/labels'
import { displayPhone } from '#/lib/phone'
import { Button } from '#/components/ui/button'
import { Field, Input, NativeSelect, Textarea } from '#/components/ui/input'
import { Avatar, Badge, Skeleton, Switch } from '#/components/ui/misc'
import { Confirm, Section } from '#/components/admin/kit'
import { Img } from '#/components/site/image'
import { OrderProgress, OrderStatusBadge, PaymentBadge } from '#/components/site/order-bits'

export const Route = createFileRoute('/admin/orders/$reference')({ component: OrderDetail })

interface Order {
  reference: string
  userId: number | null
  avatarUrl: string | null
  customerOrders: number
  customerName: string
  email: string
  phone: string
  deliveryMethod: 'delivery' | 'pickup'
  region: string | null
  city: string | null
  address: string | null
  notes: string | null
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  couponCode: string | null
  paymentMethod: string
  paymentStatus: PaymentStatus
  momoSender: string | null
  momoTransactionId: string | null
  status: OrderStatus
  paidAt: string | null
  createdAt: string
  items: Array<{ id: number; productId: number | null; name: string; variantLabel: string | null; imageUrl: string | null; unitPrice: number; quantity: number; lineTotal: number; slug: string | null; currentStock: number | null }>
  events: Array<{ kind: string; note: string | null; createdAt: string; byName: string | null }>
  sms: Array<{ recipient: string; message: string; status: string; error: string | null; createdAt: string }>
}

function OrderDetail() {
  const { reference } = Route.useParams()
  const qc = useQueryClient()
  const key = ['admin', 'order', reference]
  const { data: o } = useQuery({ queryKey: key, queryFn: () => api.get<Order>(`/admin/orders/${reference}`) })
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(true)
  const [sms, setSms] = useState('')
  const [reject, setReject] = useState(false)
  const [rejectNote, setRejectNote] = useState('')

  const done = (msg: string) => (data: Order) => {
    qc.setQueryData(key, data)
    void qc.invalidateQueries({ queryKey: ['admin', 'orders'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'badges'] })
    toast.success(msg)
  }
  const onError = (err: unknown) => toast.error(errorMessage(err))
  const confirmPay = useMutation({ mutationFn: () => api.post<Order>(`/admin/orders/${reference}/confirm-payment`, {}), onSuccess: done('Payment confirmed. Customer notified by SMS.'), onError })
  const rejectPay = useMutation({
    mutationFn: () => api.post<Order>(`/admin/orders/${reference}/reject-payment`, { note: rejectNote }),
    onSuccess: (d) => (done('Customer asked to resend payment')(d), setReject(false)),
    onError,
  })
  const changeStatus = useMutation({
    mutationFn: () => api.patch<Order>(`/admin/orders/${reference}/status`, { status, note: note || null, notify }),
    onSuccess: (d) => (done('Status updated')(d), setStatus(''), setNote('')),
    onError,
  })
  const sendSms = useMutation({ mutationFn: () => api.post<Order>(`/admin/orders/${reference}/sms`, { message: sms }), onSuccess: (d) => (done('SMS sent')(d), setSms('')), onError })
  const addNote = useMutation({ mutationFn: (text: string) => api.post<Order>(`/admin/orders/${reference}/note`, { note: text }), onSuccess: done('Note added'), onError })
  const [internal, setInternal] = useState('')

  if (!o) return <Skeleton className="h-[70vh] rounded-2xl" />
  const wa = `https://wa.me/${o.phone}`
  return (
    <>
      <Link to="/admin/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden">
        <ArrowLeft className="size-4" /> Orders
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Placed {dateTime(o.createdAt)}</p>
          <h1 className="font-mono text-3xl font-bold">{o.reference}</h1>
          <div className="mt-2 flex gap-2">
            <OrderStatusBadge status={o.status} />
            <PaymentBadge status={o.paymentStatus} />
            <Badge tone="neutral" className="uppercase">
              {o.paymentMethod}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" asChild>
            <a href={`tel:+${o.phone}`}>
              <Phone /> Call
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> WhatsApp
            </a>
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Packing slip
          </Button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border bg-card p-5 print:hidden">
        <OrderProgress status={o.status} />
      </div>

      {o.paymentStatus !== 'paid' && o.status !== 'cancelled' && (
        <div className="mb-6 overflow-hidden rounded-2xl border-2 border-gold/40 print:hidden">
          <div className="flex flex-wrap items-center gap-4 bg-gold-soft/60 p-5">
            <Smartphone className="size-6 text-gold" />
            <div className="flex-1">
              {o.paymentStatus === 'submitted' ? (
                <>
                  <p className="font-bold">Customer says they’ve paid {money(o.total)}</p>
                  <p className="text-sm">
                    MoMo transaction <span className="font-mono font-bold">{o.momoTransactionId}</span> from {displayPhone(o.momoSender)}. Check your MoMo statement, then confirm.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold">Awaiting payment of {money(o.total)}</p>
                  <p className="text-sm">The customer has been sent the MoMo number and reference. Confirm here once the money arrives.</p>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {o.paymentStatus === 'submitted' && (
                <Button variant="outline" onClick={() => setReject(true)}>
                  <XCircle /> Not received
                </Button>
              )}
              <Button onClick={() => confirmPay.mutate()} loading={confirmPay.isPending}>
                <CheckCircle2 /> Confirm payment
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="grid content-start gap-6">
          <Section title={`Items (${o.items.reduce((n, i) => n + i.quantity, 0)})`}>
            <ul className="divide-y">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 py-3">
                  <Img src={i.imageUrl} alt="" sizes="56px" maxWidth={128} className="size-14 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    {i.productId ? (
                      <Link to="/admin/products/$productId" params={{ productId: String(i.productId) }} className="font-medium hover:text-primary">
                        {i.name}
                      </Link>
                    ) : (
                      <p className="font-medium">{i.name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {i.variantLabel ? `${i.variantLabel} · ` : ''}
                      {money(i.unitPrice)} × {i.quantity}
                      {i.currentStock !== null && ` · ${i.currentStock} left in stock`}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">{money(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 grid gap-1.5 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{money(o.subtotal)}</dd>
              </div>
              {o.discount > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Discount {o.couponCode && <Badge tone="success">{o.couponCode}</Badge>}</dt>
                  <dd className="tabular-nums">−{money(o.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="tabular-nums">{o.deliveryMethod === 'pickup' ? 'Pickup' : money(o.deliveryFee)}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(o.total)}</dd>
              </div>
            </dl>
          </Section>

          <Section title="Update status" description="Customers get an SMS for each change when notifications are on." className="print:hidden">
            <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
              <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                <option value="">Choose new status…</option>
                {ORDER_STATUSES.filter((st) => st !== o.status).map((st) => (
                  <option key={st} value={st}>
                    {ORDER_STATUS_LABELS[st]}
                  </option>
                ))}
              </NativeSelect>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the customer (e.g. FedEx tracking number)" />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={notify} onCheckedChange={setNotify} /> Text the customer
              </label>
              <Button disabled={!status} loading={changeStatus.isPending} onClick={() => changeStatus.mutate()} variant={status === 'cancelled' ? 'destructive' : 'default'}>
                {status === 'cancelled' ? <Ban /> : <CheckCircle2 />} Update status
              </Button>
            </div>
            {status === 'cancelled' && <p className="mt-2 text-xs text-muted-foreground">Cancelling returns the items to stock.</p>}
          </Section>

          <Section title="Timeline">
            <ol className="grid gap-4 border-l pl-5">
              {o.events.map((e, i) => (
                <li key={i} className="relative text-sm">
                  <span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-primary ring-4 ring-card" />
                  <p className="font-medium">{e.note}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateTime(e.createdAt)}
                    {e.byName && ` · ${e.byName}`}
                  </p>
                </li>
              ))}
            </ol>
            <form
              className="mt-5 flex gap-2 print:hidden"
              onSubmit={(e) => {
                e.preventDefault()
                if (internal.trim()) addNote.mutate(internal.trim(), { onSuccess: () => setInternal('') })
              }}
            >
              <Input value={internal} onChange={(e) => setInternal(e.target.value)} placeholder="Add an internal note…" />
              <Button type="submit" variant="outline" loading={addNote.isPending}>
                Add
              </Button>
            </form>
          </Section>
        </div>

        <div className="grid content-start gap-6">
          <Section title="Customer">
            <div className="flex items-center gap-3">
              <Avatar src={o.avatarUrl} name={o.customerName} className="size-11" />
              <div className="min-w-0">
                <p className="font-semibold">{o.customerName}</p>
                <p className="truncate text-xs text-muted-foreground">{o.email}</p>
              </div>
            </div>
            <dl className="mt-4 grid gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{displayPhone(o.phone)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Orders</dt>
                <dd>{Number(o.customerOrders)}</dd>
              </div>
            </dl>
            {o.userId && (
              <Button variant="link" size="sm" asChild className="mt-2">
                <Link to="/admin/customers/$customerId" params={{ customerId: String(o.userId) }}>
                  View customer
                </Link>
              </Button>
            )}
          </Section>
          <Section title={o.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery address'}>
            {o.deliveryMethod === 'pickup' ? (
              <p className="text-sm">Customer will collect the order.</p>
            ) : (
              <address className="text-sm leading-relaxed not-italic">
                {o.address}
                <br />
                {[o.city, o.region].filter(Boolean).join(', ')}
              </address>
            )}
            {o.notes && <p className="mt-3 rounded-xl bg-muted p-3 text-sm">“{o.notes}”</p>}
          </Section>
          <Section title="Message the customer" className="print:hidden">
            <Textarea value={sms} onChange={(e) => setSms(e.target.value)} placeholder={`Hi ${o.customerName.split(' ')[0]}, …`} maxLength={480} className="min-h-24" />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {sms.length}/160 · {Math.max(1, Math.ceil(sms.length / 153))} SMS
              </span>
              <Button size="sm" onClick={() => sendSms.mutate()} disabled={sms.trim().length < 2} loading={sendSms.isPending}>
                <Send /> Send SMS
              </Button>
            </div>
          </Section>
          <Section title="SMS sent" className="print:hidden">
            {o.sms.length ? (
              <ul className="grid gap-3">
                {o.sms.map((m, i) => (
                  <li key={i} className="rounded-xl bg-muted/60 p-3 text-xs">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1 font-semibold">
                        <MessageSquareText className="size-3" /> {displayPhone(m.recipient)}
                      </span>
                      <Badge tone={m.status === 'sent' ? 'success' : m.status === 'simulated' ? 'gold' : 'danger'}>{m.status}</Badge>
                    </div>
                    <p className="text-muted-foreground">{m.message}</p>
                    {m.error && <p className="mt-1 text-destructive">{m.error}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            )}
          </Section>
        </div>
      </div>
      <Confirm
        open={reject}
        onOpenChange={setReject}
        title="Payment not received?"
        description="The order goes back to “not paid” and the customer is asked by SMS to check and resend."
        confirmLabel="Ask customer to resend"
        loading={rejectPay.isPending}
        onConfirm={() => rejectPay.mutate()}
      >
        <Field label="Message (optional)">
          <Input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="We could not find this MoMo payment." />
        </Field>
      </Confirm>
    </>
  )
}
