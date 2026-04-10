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
import { Plus, Pencil, Trash2, Search, Users } from 'lucide-react'
import { toast } from 'sonner'

interface Customer {
  id: string; warehouse: string; site: string; customer_code: string; name: string;
  address: string; city: string; country: string; phone: string; email: string;
  contact_person: string; credit_limit: number; payment_terms: string; is_active: boolean;
}

const EMPTY: Partial<Customer> = { customer_code: '', name: '', address: '', city: '', country: '', phone: '', email: '', contact_person: '', credit_limit: 0, payment_terms: 'NET30', is_active: true }

export default function CustomersPage() {
  const { warehouse, site } = useWarehouse()
  const { hasPermission, isSuperUser, user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<Customer>>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const canCreate = isSuperUser || hasPermission('customers', 'create')
  const canEdit = isSuperUser || hasPermission('customers', 'edit')
  const canDelete = isSuperUser || hasPermission('customers', 'delete')

  const fetchCustomers = async () => {
    let q = supabase.from('customers').select('*').eq('warehouse', warehouse).eq('site', site).order('customer_code')
    if (search) q = q.or(`customer_code.ilike.%${search}%,name.ilike.%${search}%`)
    const { data } = await q
    setCustomers(data || [])
  }

  useEffect(() => { if (warehouse && site) fetchCustomers() }, [warehouse, site, search])

  const save = async () => {
    if (!form.customer_code || !form.name) { toast.error('Customer code and name are required'); return }
    setLoading(true)
    const payload = { ...form, warehouse, site, updated_by: user?.id, updated_at: new Date().toISOString() }
    let error
    if (editing) {
      ({ error } = await supabase.from('customers').update(payload).eq('id', editing))
    } else {
      ({ error } = await supabase.from('customers').insert({ ...payload, created_by: user?.id }))
    }
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success(editing ? 'Customer updated' : 'Customer created')
    setOpen(false); setEditing(null); setForm(EMPTY); fetchCustomers()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this customer?')) return
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Customer deleted')
    fetchCustomers()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-blue-600" /> Customers</h1>
          <p className="text-sm text-slate-500">Manage customer accounts</p>
        </div>
        {canCreate && <Button onClick={() => { setForm(EMPTY); setEditing(null); setOpen(true) }}><Plus className="h-4 w-4 mr-2" />New Customer</Button>}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search customers..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Credit Limit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">No customers found</TableCell></TableRow>}
              {customers.map(cust => (
                <TableRow key={cust.id}>
                  <TableCell className="font-mono text-sm font-medium">{cust.customer_code}</TableCell>
                  <TableCell className="font-medium">{cust.name}</TableCell>
                  <TableCell>{cust.city || '-'}</TableCell>
                  <TableCell>{cust.contact_person || '-'}</TableCell>
                  <TableCell>{cust.payment_terms || '-'}</TableCell>
                  <TableCell>{cust.credit_limit ? `$${cust.credit_limit.toLocaleString()}` : '-'}</TableCell>
                  <TableCell>
                    <Badge className={cust.is_active ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                      {cust.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canEdit && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setForm(cust); setEditing(cust.id); setOpen(true) }}><Pencil className="h-3 w-3" /></Button>}
                      {canDelete && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => remove(cust.id)}><Trash2 className="h-3 w-3" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Edit Customer' : 'New Customer'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-1.5">
              <Label>Customer Code *</Label>
              <Input value={form.customer_code || ''} onChange={e => setForm(p => ({ ...p, customer_code: e.target.value }))} disabled={!!editing} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Terms</Label>
              <Input value={form.payment_terms || ''} onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))} placeholder="NET30" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city || ''} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input value={form.country || ''} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input value={form.contact_person || ''} onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Credit Limit</Label>
              <Input type="number" value={form.credit_limit || 0} onChange={e => setForm(p => ({ ...p, credit_limit: parseFloat(e.target.value) }))} />
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
            <Button onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export const dynamic = 'force-dynamic'
