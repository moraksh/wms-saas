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
import { BulkActionBar } from '@/components/ui/list-actions'
import { Plus, Pencil, Trash2, Search, Truck, Copy } from 'lucide-react'
import { toast } from 'sonner'

interface Supplier {
  id: string; warehouse: string; site: string; supplier_code: string; name: string;
  address: string; city: string; country: string; phone: string; email: string;
  contact_person: string; payment_terms: string; lead_time_days: number; is_active: boolean;
}

const EMPTY: Partial<Supplier> = { supplier_code: '', name: '', address: '', city: '', country: '', phone: '', email: '', contact_person: '', payment_terms: 'NET30', lead_time_days: 0, is_active: true }

export default function SuppliersPage() {
  const { warehouse, site } = useWarehouse()
  const { hasPermission, isSuperUser, user } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<Supplier>>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const supabase = createClient()

  const canCreate = isSuperUser || hasPermission('suppliers', 'create')
  const canEdit = isSuperUser || hasPermission('suppliers', 'edit')
  const canDelete = isSuperUser || hasPermission('suppliers', 'delete')

  const fetchSuppliers = async () => {
    let q = supabase.from('suppliers').select('*').eq('warehouse', warehouse).eq('site', site).order('supplier_code')
    if (search) q = q.or(`supplier_code.ilike.%${search}%,name.ilike.%${search}%`)
    const { data } = await q
    setSuppliers(data || [])
  }

  useEffect(() => { if (warehouse && site) fetchSuppliers() }, [warehouse, site, search])

  const toggleSelect = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  const toggleAll = () => {
    setSelected(prev => prev.size === suppliers.length ? new Set() : new Set(suppliers.map(s => s.id)))
  }

  const save = async () => {
    if (!form.supplier_code || !form.name) { toast.error('Supplier code and name are required'); return }
    setLoading(true)
    const payload = { ...form, warehouse, site, updated_by: user?.id, updated_at: new Date().toISOString() }
    let error
    if (editing) {
      ({ error } = await supabase.from('suppliers').update(payload).eq('id', editing))
    } else {
      ({ error } = await supabase.from('suppliers').insert({ ...payload, created_by: user?.id }))
    }
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success(editing ? 'Supplier updated' : 'Supplier created')
    setOpen(false); setEditing(null); setForm(EMPTY); fetchSuppliers()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this supplier?')) return
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Supplier deleted')
    fetchSuppliers()
  }

  const copySupplier = async (sup: Supplier) => {
    const newCode = `${sup.supplier_code}-COPY`
    const { error } = await supabase.from('suppliers').insert({
      ...sup, id: undefined, supplier_code: newCode, warehouse, site,
      created_by: user?.id, updated_by: user?.id,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    if (error) { toast.error(error.message); return }
    toast.success(`Copied as ${newCode}`)
    fetchSuppliers()
  }

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} supplier(s)?`)) return
    const ids = Array.from(selected)
    const { error } = await supabase.from('suppliers').delete().in('id', ids)
    if (error) { toast.error(error.message); return }
    toast.success(`${ids.length} supplier(s) deleted`)
    setSelected(new Set())
    fetchSuppliers()
  }

  const bulkCopy = async () => {
    const selectedItems = suppliers.filter(s => selected.has(s.id))
    let copied = 0
    for (const sup of selectedItems) {
      const newCode = `${sup.supplier_code}-COPY`
      const { error } = await supabase.from('suppliers').insert({
        ...sup, id: undefined, supplier_code: newCode, warehouse, site,
        created_by: user?.id, updated_by: user?.id,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
      if (!error) copied++
    }
    toast.success(`${copied} supplier(s) copied`)
    setSelected(new Set())
    fetchSuppliers()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6 text-blue-600" /> Suppliers</h1>
          <p className="text-sm text-slate-500">Manage supplier accounts</p>
        </div>
        {canCreate && <Button onClick={() => { setForm(EMPTY); setEditing(null); setOpen(true) }}><Plus className="h-4 w-4 mr-2" />New Supplier</Button>}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search suppliers..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <BulkActionBar selectedCount={selected.size} onCopy={bulkCopy} onDelete={bulkDelete} canCreate={canCreate} canDelete={canDelete} />
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox" checked={suppliers.length > 0 && selected.size === suppliers.length} onChange={toggleAll} className="h-4 w-4 cursor-pointer" />
                </TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Lead Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">No suppliers found</TableCell></TableRow>}
              {suppliers.map(sup => (
                <TableRow key={sup.id} className={selected.has(sup.id) ? 'bg-blue-50' : ''}>
                  <TableCell>
                    <input type="checkbox" checked={selected.has(sup.id)} onChange={() => toggleSelect(sup.id)} className="h-4 w-4 cursor-pointer" />
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">{sup.supplier_code}</TableCell>
                  <TableCell className="font-medium">{sup.name}</TableCell>
                  <TableCell>{sup.city || '-'}</TableCell>
                  <TableCell>{sup.contact_person || '-'}</TableCell>
                  <TableCell>{sup.payment_terms || '-'}</TableCell>
                  <TableCell>{sup.lead_time_days ? `${sup.lead_time_days} days` : '-'}</TableCell>
                  <TableCell>
                    <Badge className={sup.is_active ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                      {sup.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canCreate && <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500" onClick={() => copySupplier(sup)} title="Copy"><Copy className="h-3 w-3" /></Button>}
                      {canEdit && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setForm(sup); setEditing(sup.id); setOpen(true) }}><Pencil className="h-3 w-3" /></Button>}
                      {canDelete && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => remove(sup.id)}><Trash2 className="h-3 w-3" /></Button>}
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Supplier' : 'New Supplier'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-1.5">
              <Label>Supplier Code *</Label>
              <Input value={form.supplier_code || ''} onChange={e => setForm(p => ({ ...p, supplier_code: e.target.value }))} disabled={!!editing} />
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
              <Label>Lead Time (days)</Label>
              <Input type="number" value={form.lead_time_days || 0} onChange={e => setForm(p => ({ ...p, lead_time_days: parseInt(e.target.value) }))} />
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
