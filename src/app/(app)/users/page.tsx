'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWarehouse } from '@/contexts/warehouse-context'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Pencil, Users, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { MODULES } from '@/types'

const EMPTY_USER = { email: '', full_name: '', role_id: '', password: '', is_active: true }
const EMPTY_PERMS: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }> = {}
MODULES.forEach(m => { EMPTY_PERMS[m.key] = { view: false, create: false, edit: false, delete: false } })

export default function UsersPage() {
  const { warehouse, site } = useWarehouse()
  const { isSuperUser } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [permOpen, setPermOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_USER })
  const [editing, setEditing] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [perms, setPerms] = useState<Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>>(JSON.parse(JSON.stringify(EMPTY_PERMS)))
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const fetchUsers = async () => {
    const { data } = await supabase.from('wms_users').select('*, roles(code, name, is_super_user)').eq('warehouse', warehouse).eq('site', site).order('full_name')
    setUsers(data || [])
  }

  const fetchRoles = async () => {
    const { data } = await supabase.from('roles').select('*').eq('warehouse', warehouse).eq('site', site).order('name')
    setRoles(data || [])
  }

  useEffect(() => { if (warehouse && site) { fetchUsers(); fetchRoles() } }, [warehouse, site])

  const save = async () => {
    if (!form.email || !form.full_name || !form.role_id) { toast.error('Email, name and role are required'); return }
    setSaving(true)
    try {
      if (editing) {
        const payload: any = { full_name: form.full_name, role_id: form.role_id, is_active: form.is_active, updated_at: new Date().toISOString() }
        const { error } = await supabase.from('wms_users').update(payload).eq('id', editing)
        if (error) throw error
        toast.success('User updated')
      } else {
        if (!form.password || form.password.length < 6) { toast.error('Password must be at least 6 characters'); setSaving(false); return }
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, warehouse, site }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to create user')
        toast.success('User created')
      }
      setOpen(false); setEditing(null); setForm({ ...EMPTY_USER }); fetchUsers()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openPerms = async (user: any) => {
    setSelectedUser(user)
    const { data } = await supabase.from('user_permissions').select('*').eq('user_id', user.id)
    const newPerms = JSON.parse(JSON.stringify(EMPTY_PERMS))
    data?.forEach((p: any) => {
      if (newPerms[p.module]) {
        newPerms[p.module] = { view: p.can_view, create: p.can_create, edit: p.can_edit, delete: p.can_delete }
      }
    })
    setPerms(newPerms)
    setPermOpen(true)
  }

  const savePerms = async () => {
    if (!selectedUser) return
    setSaving(true)
    try {
      await supabase.from('user_permissions').delete().eq('user_id', selectedUser.id)
      const inserts = Object.entries(perms).map(([module, p]) => ({
        warehouse, site, user_id: selectedUser.id, module,
        can_view: p.view, can_create: p.create, can_edit: p.edit, can_delete: p.delete,
      }))
      const { error } = await supabase.from('user_permissions').insert(inserts)
      if (error) throw error
      toast.success('Permissions updated')
      setPermOpen(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleAll = (module: string) => {
    const current = perms[module]
    const allOn = current.view && current.create && current.edit && current.delete
    setPerms(p => ({ ...p, [module]: { view: !allOn, create: !allOn, edit: !allOn, delete: !allOn } }))
  }

  if (!isSuperUser) return <div className="text-center py-12 text-slate-500">Access denied. Super user required.</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-blue-600" /> User Management</h1>
          <p className="text-sm text-slate-500">Manage users and permissions</p>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY_USER }); setEditing(null); setOpen(true) }}><Plus className="h-4 w-4 mr-2" />New User</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">No users found</TableCell></TableRow>}
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{u.roles?.name || '-'}</Badge>
                    {u.roles?.is_super_user && <Badge className="ml-1 text-xs bg-purple-100 text-purple-700 hover:bg-purple-100">Super</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge className={u.is_active ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setForm({ email: u.email, full_name: u.full_name, role_id: u.role_id, password: '', is_active: u.is_active }); setEditing(u.id); setOpen(true) }}><Pencil className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-purple-600" onClick={() => openPerms(u)} title="Permissions"><ShieldCheck className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit User' : 'New User'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} disabled={!!editing} />
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label>Password *</Label>
                <Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.role_id} onChange={e => setForm(p => ({ ...p, role_id: e.target.value }))}>
                <option value="">-- Select Role --</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.is_active ? 'true' : 'false'} onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Permissions - {selectedUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead className="text-center w-20">View</TableHead>
                  <TableHead className="text-center w-20">Create</TableHead>
                  <TableHead className="text-center w-20">Edit</TableHead>
                  <TableHead className="text-center w-20">Delete</TableHead>
                  <TableHead className="text-center w-20">All</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MODULES.map(mod => (
                  <TableRow key={mod.key}>
                    <TableCell className="font-medium">{mod.label}</TableCell>
                    {(['view', 'create', 'edit', 'delete'] as const).map(action => (
                      <TableCell key={action} className="text-center">
                        <input
                          type="checkbox"
                          checked={perms[mod.key]?.[action] || false}
                          onChange={e => setPerms(p => ({ ...p, [mod.key]: { ...p[mod.key], [action]: e.target.checked } }))}
                          className="h-4 w-4 cursor-pointer"
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={perms[mod.key]?.view && perms[mod.key]?.create && perms[mod.key]?.edit && perms[mod.key]?.delete}
                        onChange={() => toggleAll(mod.key)}
                        className="h-4 w-4 cursor-pointer"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermOpen(false)}>Cancel</Button>
            <Button onClick={savePerms} disabled={saving}>{saving ? 'Saving...' : 'Save Permissions'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export const dynamic = 'force-dynamic'
