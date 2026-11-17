import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, Coins, MessageSquareText, Send, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import type { Page } from '#/lib/api-client'
import { dateTime } from '#/lib/format'
import { displayPhone } from '#/lib/phone'
import { Button } from '#/components/ui/button'
import { Field, Textarea } from '#/components/ui/input'
import { Badge, Card } from '#/components/ui/misc'
import { EmptyState, PageHeader, Pager, Section, StatCard, Table, TableSkeleton, Td, Th } from '#/components/admin/kit'

export const Route = createFileRoute('/admin/sms')({ component: Sms })

interface Log {
  id: number
  recipient: string
  message: string
  context: string | null
  status: 'sent' | 'failed' | 'simulated'
  error: string | null
  createdAt: string
  reference: string | null
}

function Sms() {
  const { user } = Route.useRouteContext()
  const [page, setPage] = useState(1)
  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'sms', page],
    queryFn: () =>
      api.get<Page<Log> & { stats: Record<string, number>; status: { configured: boolean; simulated: boolean }; balance: { balance: number; model: string } | null }>('/admin/sms', { page }),
    placeholderData: keepPreviousData,
  })
  const send = useMutation({
    mutationFn: () => api.post<{ sent: number; failed: Array<{ to: string; error: string }> }>('/admin/sms/send', { recipients: to.split(/[\s,;]+/).filter(Boolean), message }),
    onSuccess: (r) => {
      if (r.sent) toast.success(`Sent to ${r.sent} number${r.sent === 1 ? '' : 's'}`)
      if (r.failed.length) toast.error(`${r.failed.length} failed: ${r.failed[0]?.error}`)
      setMessage('')
      void refetch()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <>
      <PageHeader eyebrow="System" title="SMS notifications" description="Sent through SMSOnlineGH. Customers get texts when they order, when payment is confirmed and when their order moves." />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Gateway"
          value={data ? (data.status.configured ? 'Connected' : data.status.simulated ? 'Simulated' : 'Not set up') : '…'}
          icon={data?.status.configured ? CheckCircle2 : XCircle}
          tone={data?.status.configured ? 'success' : 'primary'}
          hint="SMSONLINEGH_API_KEY"
        />
        <StatCard label="Credit balance" value={data?.balance ? data.balance.balance.toLocaleString() : '—'} icon={Coins} tone="gold" hint={data?.balance?.model} />
        <StatCard label="Sent (30 days)" value={(data?.stats.sent ?? 0) + (data?.stats.simulated ?? 0)} icon={MessageSquareText} tone="info" />
        <StatCard label="Failed (30 days)" value={data?.stats.failed ?? 0} icon={XCircle} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Card className="overflow-hidden">
          {isLoading ? (
            <TableSkeleton />
          ) : !data?.data.length ? (
            <EmptyState icon={MessageSquareText} title="No messages yet" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>To</Th>
                  <Th>Message</Th>
                  <Th>Status</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((m) => (
                  <tr key={m.id}>
                    <Td className="whitespace-nowrap">
                      {displayPhone(m.recipient)}
                      {m.reference && (
                        <Link to="/admin/orders/$reference" params={{ reference: m.reference }} className="block font-mono text-xs text-primary">
                          {m.reference}
                        </Link>
                      )}
                    </Td>
                    <Td className="max-w-md">
                      <p className="line-clamp-2 text-xs">{m.message}</p>
                      {m.error && <p className="text-xs text-destructive">{m.error}</p>}
                    </Td>
                    <Td>
                      <Badge tone={m.status === 'sent' ? 'success' : m.status === 'simulated' ? 'gold' : 'danger'}>{m.status}</Badge>
                      {m.context && <span className="mt-1 block text-[0.65rem] text-muted-foreground">{m.context.replace(/_/g, ' ')}</span>}
                    </Td>
                    <Td className="text-xs whitespace-nowrap text-muted-foreground">{dateTime(m.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
        </Card>
        {user.role === 'admin' && (
          <Section title="Send an SMS" description="To one or many numbers (separate with commas).">
            <div className="grid gap-4">
              <Field label="Phone numbers">
                <Textarea value={to} onChange={(e) => setTo(e.target.value)} placeholder="0244123456, 0201234567" className="min-h-16" />
              </Field>
              <Field label="Message" hint={`${message.length} characters · ${Math.max(1, Math.ceil(message.length / 153))} SMS each`}>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={480} />
              </Field>
              <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!to.trim() || message.trim().length < 2}>
                <Send /> Send
              </Button>
            </div>
          </Section>
        )}
      </div>
    </>
  )
}
