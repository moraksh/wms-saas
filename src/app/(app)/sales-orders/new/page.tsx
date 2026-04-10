'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWarehouse } from '@/contexts/warehouse-context'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

export default function NewSOPage() {
  const { warehouse, site } = useWarehouse()
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [customers, setCustomers] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [form, setForm] = useState({ customer_id: '', customer_reference: '', so_date: new Date().toISOString().split('T')[0], requested_date: '', priority: 'NORMAL', ship_to_address: '', notes: '' })
  const [lines, setLines] = useState<any[]>([{ item_id: '', ordered_qty: 1, location_id: '', unit_price: 0 }])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!warehouse || !site) return
    Promise.all([
      supabase.from('customers').select('id, customer_code, name').eq('warehouse', warehouse).eq('site', site).eq('is_active', true).order('name'),
      supabase.from('item_master').select('id, item_code, description, uom').eq('warehouse', warehouse).eq('site', site).eq('is_active', true).order('item_code'),
      supabase.from('location_master').select('id, location_code, zone').eq('warehouse', warehouse).eq('site', site).eq('is_active', true).order('location_code'),
    ]).then(([c, i, l]) => {
      setCustomers(c.data || [])
      setItems(i.data || [])
      setLocations(l.data || [])
    })
  }, [warehouse, site])

  const addLine = () => setLines(prev => [...prev, { item_id: '', ordered_qty: 1, location_id: '', unit_price: 0 }])
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))
  const updateLine = (idx: number, field: string, value: any) => setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))

  const save = async () => {
    if (lines.some(l => !l.item_id)) { toast.error('All lines must have an item selected'); return }
    setSaving(true)
    try {
      const { data: seqData } = await supabase.rpc('get_next_doc_number', { p_warehouse: warehouse, p_site: site, p_doc_type: 'SO' })
      const soNumber = seqData || `SO-${Date.now()}`

      const { data: header, error: hErr } = await supabase.from('sales_order_header').insert({
        warehouse, site,
        so_number: soNumber,
        so_date: form.so_date,
        customer_id: form.customer_id || null,
        customer_reference: form.customer_reference || null,
        priority: form.priority,
        ship_to_address: form.ship_to_address || null,
        requested_date: form.requested_date || null,
        notes: form.notes || null,
        status: 'DRAFT',
        total_lines: lines.length,
        created_by: user?.id,
      }).select().single()

      if (hErr) throw hErr

      const linePayloads = lines.map((l, idx) => ({
        warehouse, site,
        so_id: header.id,
        line_number: idx + 1,
        item_id: l.item_id,
        ordered_qty: parseFloat(l.ordered_qty) || 0,
        picked_qty: 0,
        shipped_qty: 0,
        location_id: l.location_id || null,
        unit_price: parseFloat(l.unit_price) || 0,
        status: 'PENDING',
        created_by: user?.id,
      }))

      const { error: lErr } = await supabase.from('sales_order_lines').insert(linePayloads)
      if (lErr) throw lErr

      toast.success(`SO ${soNumber} created`)
      router.push(`/sales-orders/${header.id}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/sales-orders" className="inline-flex items-center justify-center size-8 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold">New Sales Order</h1>
          <p className="text-sm text-slate-500">Create a new outbound sales order</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Header Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.customer_id} onChange={e => setForm(p => ({ ...p, customer_id: e.target.value }))}>
                <option value="">-- Select Customer --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.customer_code} - {c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>SO Date</Label>
              <Input type="date" value={form.so_date} onChange={e => setForm(p => ({ ...p, so_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Requested Date</Label>
              <Input type="date" value={form.requested_date} onChange={e => setForm(p => ({ ...p, requested_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Customer Reference</Label>
              <Input value={form.customer_reference} onChange={e => setForm(p => ({ ...p, customer_reference: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Ship To Address</Label>
              <Input value={form.ship_to_address} onChange={e => setForm(p => ({ ...p, ship_to_address: e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Lines</CardTitle>
          <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" />Add Line</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Qty Ordered</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <select className="w-full border rounded px-2 py-1 text-sm" value={line.item_id} onChange={e => updateLine(idx, 'item_id', e.target.value)}>
                      <option value="">-- Select Item --</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.item_code} - {i.description}</option>)}
                    </select>
                  </TableCell>
                  <TableCell><Input type="number" className="w-24" value={line.ordered_qty} onChange={e => updateLine(idx, 'ordered_qty', e.target.value)} /></TableCell>
                  <TableCell>
                    <select className="w-full border rounded px-2 py-1 text-sm" value={line.location_id} onChange={e => updateLine(idx, 'location_id', e.target.value)}>
                      <option value="">-- Select --</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.location_code}</option>)}
                    </select>
                  </TableCell>
                  <TableCell><Input type="number" className="w-24" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} /></TableCell>
                  <TableCell>
                    {lines.length > 1 && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => removeLine(idx)}><Trash2 className="h-3 w-3" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>{saving ? 'Creating...' : 'Create SO'}</Button>
        <Link href="/sales-orders" className="inline-flex items-center justify-center rounded-lg border border-border bg-background text-sm font-medium px-2.5 h-8 gap-1.5 hover:bg-muted transition-all">Cancel</Link>
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
