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
import { Plus, Pencil, Trash2, Search, Package } from 'lucide-react'
import { toast } from 'sonner'

interface Item {
  id: string; warehouse: string; site: string; item_code: string; description: string;
  category: string; uom: string; weight: number; is_serialized: boolean; is_lot_tracked: boolean;
  min_stock: number; is_active: boolean;
}

const EMPTY: Partial<Item> = { item_code: '', description: '', category: '', uom: 'EA', weight: 0, is_serialized: false, is_lot_tracked: false, min_stock: 0, is_active: true }

export default function ItemsPage() {
  const { warehouse, site } = useWarehouse()
  const { hasPermission, isSuperUser, user } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<Item>>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const canCreate = isSuperUser || hasPermission('items', 'create')
  const canEdit = isSuperUser || hasPermission('items', 'edit')
  const canDelete = isSuperUser || hasPermission('items', 'delete')

  const fetchItems = async () => {
    let q = supabase.from('item_master').select('*').eq('warehouse', warehouse).eq('site', site).order('item_code')
    if (search) q = q.ilike('item_code', `%${search}%`)
    const { data } = await q
    setItems(data || [])
  }

  useEffect(() => { if (warehouse && site) fetchItems() }, [warehouse, site, search])

  const save = async () => {
    if (!form.item_code || !form.description) { toast.error('Item code and description are required'); return }
    setLoading(true)
    const payload = { ...form, warehouse, site, updated_by: user?.id, updated_at: new Date().toISOString() }
    let error
    if (editing) {
      ({ error } = await supabase.from('item_master').update(payload).eq('id', editing))
    } else {
      ({ error } = await supabase.from('item_master').insert({ ...payload, created_by: user?.id }))
    }
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success(editing ? 'Item updated' : 'Item created')
    setOpen(false); setEditing(null); setForm(EMPTY); fetchItems()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this item?')) return
    const { error } = await supabase.from('item_master').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Item deleted')
    fetchItems()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6 text-blue-600" /> Item Master</h1>
          <p className="text-sm text-slate-500">Manage your product catalogue</p>
        </div>
        {canCreate && <Button onClick={() => { setForm(EMPTY); setEditing(null); setOpen(true) }}><Plus className="h-4 w-4 mr-2" />New Item</Button>}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Search items..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead>Tracked</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No items found</TableCell></TableRow>}
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm font-medium">{item.item_code}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.category || '-'}</TableCell>
                  <TableCell>{item.uom}</TableCell>
                  <TableCell>
                    {item.is_serialized && <Badge variant="outline" className="text-xs mr-1">Serial</Badge>}
                    {item.is_lot_tracked && <Badge variant="outline" className="text-xs">Lot</Badge>}
                    {!item.is_serialized && !item.is_lot_tracked && <span className="text-slate-400 text-xs">-</span>}
                  </TableCell>
                  <TableCell>
                    <Badge className={item.is_active ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canEdit && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setForm(item); setEditing(item.id); setOpen(true) }}><Pencil className="h-3 w-3" /></Button>}
                      {canDelete && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => remove(item.id)}><Trash2 className="h-3 w-3" /></Button>}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Item' : 'New Item'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Item Code *</Label>
              <Input value={form.item_code || ''} onChange={e => setForm(p => ({ ...p, item_code: e.target.value }))} disabled={!!editing} />
            </div>
            <div className="space-y-1.5">
              <Label>UOM</Label>
              <Input value={form.uom || 'EA'} onChange={e => setForm(p => ({ ...p, uom: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description *</Label>
              <Input value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={form.category || ''} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Weight (kg)</Label>
              <Input type="number" value={form.weight || 0} onChange={e => setForm(p => ({ ...p, weight: parseFloat(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Min Stock</Label>
              <Input type="number" value={form.min_stock || 0} onChange={e => setForm(p => ({ ...p, min_stock: parseFloat(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.is_active ? 'true' : 'false'} onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="col-span-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_serialized || false} onChange={e => setForm(p => ({ ...p, is_serialized: e.target.checked }))} className="rounded" />
                Serialized
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_lot_tracked || false} onChange={e => setForm(p => ({ ...p, is_lot_tracked: e.target.checked }))} className="rounded" />
                Lot Tracked
              </label>
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
