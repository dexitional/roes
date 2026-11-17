import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, TicketPercent, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { date, money } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Field, Input, NativeSelect } from '#/components/ui/input'
import { Badge, Card, Switch } from '#/components/ui/misc'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/overlay'
import { EmptyState, PageHeader, Table, TableSkeleton, Td, Th } from '#/components/admin/kit'

export const Route = createFileRoute('/admin/coupons')({ component: Coupons })

interface Coupon {
  id: number
  code: string
  description: string | null
  kind: 'percent' | 'fixed'
  value: number
  minSubtotal: number
  usageLimit: number | null
  usedCount: number
  startsAt: string | null
  endsAt: string | null
  isActive: number
}

const EMPTY = { code: '', description: '', kind: 'percent' as 'percent' | 'fixed', value: 10, minSubtotal: 0, usageLimit: '' as number | '', startsAt: '', endsAt: '', isActive: true }

function Coupons() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => api.get<Array<Coupon>>('/admin/coupons') })
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const open = (c?: Coupon) => {
    setEditing(c ? c.id : 'new')
    setForm(
      c
        ? {
            code: c.code,
            description: c.description ?? '',
            kind: c.kind,
            value: Number(c.value),
            minSubtotal: Number(c.minSubtotal),
            usageLimit: c.usageLimit ?? '',
            startsAt: c.startsAt?.slice(0, 10) ?? '',
            endsAt: c.endsAt?.slice(0, 10) ?? '',
            isActive: Boolean(c.isActive),
          }
        : EMPTY,
    )
  }
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, usageLimit: form.usageLimit === '' ? null : form.usageLimit, startsAt: form.startsAt || null, endsAt: form.endsAt ? `${form.endsAt} 23:59:59` : null }
      return editing === 'new' ? api.post('/admin/coupons', body) : api.put(`/admin/coupons/${editing}`, body)
    },
    onSuccess: () => {
      toast.success('Discount saved')
      setEditing(null)
      void qc.invalidateQueries({ queryKey: ['admin', 'coupons'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({ mutationFn: (id: number) => api.delete(`/admin/coupons/${id}`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }) })
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Discount codes"
        description="Codes customers enter at checkout."
        actions={
          <Button onClick={() => open()}>
            <Plus /> New code
          </Button>
        }
      />
      <Card className="overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : !data?.length ? (
          <EmptyState icon={TicketPercent} title="No discount codes" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Discount</Th>
                <Th>Minimum</Th>
                <Th>Used</Th>
                <Th>Valid</Th>
                <Th>Status</Th>
                <Th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <Td>
                    <span className="font-mono font-bold">{c.code}</span>
                    {c.description && <span className="block text-xs text-muted-foreground">{c.description}</span>}
                  </Td>
                  <Td className="font-semibold">{c.kind === 'percent' ? `${Number(c.value)}% off` : `${money(c.value, true)} off`}</Td>
                  <Td>{Number(c.minSubtotal) ? money(c.minSubtotal, true) : '—'}</Td>
                  <Td className="tabular-nums">
                    {c.usedCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {c.startsAt ? date(c.startsAt) : 'Now'} → {c.endsAt ? date(c.endsAt) : 'no end'}
                  </Td>
                  <Td>
                    <Badge tone={c.isActive ? 'success' : 'neutral'} dot>
                      {c.isActive ? 'Active' : 'Off'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex">
                      <Button size="icon-sm" variant="ghost" onClick={() => open(c)} aria-label="Edit">
                        <Pencil />
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => remove.mutate(c.id)} aria-label="Delete">
                        <Trash2 />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'New discount code' : 'Edit discount code'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code">
              <Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="SUMMER15" className="font-mono uppercase" />
            </Field>
            <Field label="Type">
              <NativeSelect value={form.kind} onChange={(e) => set('kind', e.target.value as 'percent' | 'fixed')}>
                <option value="percent">Percentage</option>
                <option value="fixed">Fixed amount (GH₵)</option>
              </NativeSelect>
            </Field>
            <Field label={form.kind === 'percent' ? 'Percent off' : 'Amount off (GH₵)'}>
              <Input type="number" min={1} value={form.value} onChange={(e) => set('value', Number(e.target.value))} />
            </Field>
            <Field label="Minimum subtotal (GH₵)">
              <Input type="number" min={0} value={form.minSubtotal} onChange={(e) => set('minSubtotal', Number(e.target.value))} />
            </Field>
            <Field label="Starts">
              <Input type="date" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
            </Field>
            <Field label="Ends">
              <Input type="date" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
            </Field>
            <Field label="Usage limit" hint="Leave blank for unlimited.">
              <Input type="number" min={1} value={form.usageLimit} onChange={(e) => set('usageLimit', e.target.value ? Number(e.target.value) : '')} />
            </Field>
            <Field label="Description">
              <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Shown when applied" />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => set('isActive', v)} /> Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
