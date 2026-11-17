import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { relative } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Field, Input, NativeSelect } from '#/components/ui/input'
import { Avatar, Badge, Card, Switch } from '#/components/ui/misc'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/overlay'
import { EmptyState, PageHeader, Section, Table, TableSkeleton, Td, Th } from '#/components/admin/kit'

export const Route = createFileRoute('/admin/staff')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'admin') throw redirect({ to: '/admin' })
  },
  component: Staff,
})

interface Member {
  id: number
  fullName: string
  email: string
  role: 'staff' | 'admin'
  isActive: number
  lastLoginAt: string | null
  hasPassword: number
}

function PasswordForm() {
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const save = useMutation({
    mutationFn: () => api.post('/auth/password', { currentPassword, newPassword }),
    onSuccess: () => {
      toast.success('Password changed')
      setCurrent('')
      setNew('')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Section title="Your password" actions={<KeyRound className="size-5 text-muted-foreground" />}>
      <form
        className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <Field label="Current password">
          <Input type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </Field>
        <Field label="New password">
          <Input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" minLength={8} required />
        </Field>
        <Button type="submit" loading={save.isPending}>
          Change
        </Button>
      </form>
    </Section>
  )
}

function Staff() {
  const { user } = Route.useRouteContext()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'staff'], queryFn: () => api.get<Array<Member>>('/admin/staff') })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', role: 'staff' as 'staff' | 'admin', password: '' })
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin', 'staff'] })
  const create = useMutation({
    mutationFn: () => api.post('/admin/staff', form),
    onSuccess: () => {
      toast.success('Staff member saved')
      setOpen(false)
      setForm({ fullName: '', email: '', role: 'staff', password: '' })
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const update = useMutation({ mutationFn: ({ id, ...body }: { id: number; role?: string; isActive?: boolean }) => api.patch(`/admin/staff/${id}`, body), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) })
  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Staff"
        description="Staff manage products, orders and content. Administrators can also change settings and staff."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Add staff
          </Button>
        }
      />
      <Card className="mb-6 overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : !data?.length ? (
          <EmptyState icon={UserCog} title="No staff" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Sign-in</Th>
                <Th>Last seen</Th>
                <Th>Active</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={m.fullName} />
                      <span>
                        <span className="block font-medium">{m.fullName}</span>
                        <span className="text-xs text-muted-foreground">{m.email}</span>
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <NativeSelect className="h-8 w-32" value={m.role} disabled={m.id === user.id} onChange={(e) => update.mutate({ id: m.id, role: e.target.value })}>
                      <option value="staff">Staff</option>
                      <option value="admin">Administrator</option>
                      <option value="customer">Remove access</option>
                    </NativeSelect>
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      <Badge>Google</Badge>
                      {m.hasPassword ? <Badge tone="info">Password</Badge> : null}
                    </div>
                  </Td>
                  <Td className="text-muted-foreground">{m.lastLoginAt ? relative(m.lastLoginAt) : 'Never'}</Td>
                  <Td>
                    <Switch checked={Boolean(m.isActive)} disabled={m.id === user.id} onCheckedChange={(v) => update.mutate({ id: m.id, isActive: v })} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <PasswordForm />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a staff member</DialogTitle>
            <DialogDescription>If they already have a customer account (Google), it is promoted. A password is optional: they can always sign in with Google.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Full name">
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </Field>
            <Field label="Email (their Google account)">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Role">
              <NativeSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'staff' | 'admin' })}>
                <option value="staff">Staff</option>
                <option value="admin">Administrator</option>
              </NativeSelect>
            </Field>
            <Field label="Password (optional)" hint="At least 8 characters.">
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
