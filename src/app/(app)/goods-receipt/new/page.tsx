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

export default function NewGRPage() {
  const { warehouse, site } = useWarehouse()
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [form, setForm] = useState({ supplier_id: '', supplier_reference: '', gr_date: new Date().toISOString().split('T')[0], notes: '' })
  const [lines, setLines] = useState<any[]>([{ item_id: '', expected_qty: 1, location_id: '', lot_number: '', unit_cost: 0 }])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!warehouse || !site) return
    Promise.all([
      supabase.from('suppliers').select('id, supplier_code, name').eq('warehouse', warehouse).eq('site', site).eq('is_active', true).order('name'),
      supabase.from('item_master').select('id, item_code, description, uom').eq('warehouse', warehouse).eq('site', site).eq('is_active', true).order('item_code'),
      supabase.from('location_master').select('id, location_code, zone').eq('warehouse', warehouse).eq('site', site).eq('is_active', true).order('location_code'),
    ]).then(([s, i, l]) => {
      setSuppliers(s.data || [])
      setItems(i.data || [])
      setLocations(l.data || [])
    })
  }, [warehouse, site])

  const addLine = () => setLines(prev => [...prev, { item_id: '', expected_qty: 1, location_id: '', lot_number: '', unit_cost: 0 }])
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))
  const updateLine = (idx: number, field: string, value: any) => setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))

  const save = async () => {
    if (lines.some(l => !l.item_id)) { toast.error('All lines must have an item selected'); return }
    setSaving(true)
    try {
      // Get next GR number
      const { data: seqData } = await supabase.rpc('get_next_doc_number', { p_warehouse: warehouse, p_site: site, p_doc_type: 'GR' })
      const grNumber = seqData || `GR-${Date.now()}`

      const { data: header, error: hErr } = await supabase.from('goods_receipt_header').insert({
        warehouse, site,
        gr_number: grNumber,
        gr_date: form.gr_date,
        supplier_id: form.supplier_id || null,
        supplier_reference: form.supplier_reference || null,
        notes: form.notes || null,
        status: 'DRAFT',
        total_lines: lines.length,
        created_by: user?.id,
      }).select().single()

      if (hErr) throw hErr

      const linePayloads = lines.map((l, idx) => ({
        warehouse, site,
        gr_id: header.id,
        line_number: idx + 1,
        item_id: l.item_id,
        expected_qty: parseFloat(l.expected_qty) || 0,
        received_qty: 0,
        location_id: l.location_id || null,
        lot_number: l.lot_number || null,
        unit_cost: parseFloat(l.unit_cost) || 0,
        status: 'PENDING',
        created_by: user?.id,
      }))

      const { error: lErr } = await supabase.from('goods_receipt_lines').insert(linePayloads)
      if (lErr) throw lErr

      toast.success(`GR ${grNumber} created`)
      router.push(`/goods-receipt/${header.id}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/goods-receipt" className="inline-flex items-center justify-center size-8 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold">New Goods Receipt</h1>
          <p className="text-sm text-slate-500">Create a new inbound goods receipt</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Header Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}>
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_code} - {s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>GR Date</Label>
              <Input type="date" value={form.gr_date} onChange={e => setForm(p => ({ ...p, gr_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Supplier Reference</Label>
              <Input value={form.supplier_reference} onChange={e => setForm(p => ({ ...p, supplier_reference: e.target.value }))} placeholder="PO number, invoice..." />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Qty Expected</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Lot Number</TableHead>
                <TableHead>Unit Cost</TableHead>
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
                  <TableCell><Input type="number" className="w-24" value={line.expected_qty} onChange={e => updateLine(idx, 'expected_qty', e.target.value)} /></TableCell>
                  <TableCell>
                    <select className="w-full border rounded px-2 py-1 text-sm" value={line.location_id} onChange={e => updateLine(idx, 'location_id', e.target.value)}>
                      <option value="">-- Select --</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.location_code}</option>)}
                    </select>
                  </TableCell>
                  <TableCell><Input className="w-28" value={line.lot_number} onChange={e => updateLine(idx, 'lot_number', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" className="w-24" value={line.unit_cost} onChange={e => updateLine(idx, 'unit_cost', e.target.value)} /></TableCell>
                  <TableCell>
                    {lines.length > 1 && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => removeLine(idx)}><Trash2 className="h-3 w-3" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>{saving ? 'Creating...' : 'Create GR'}</Button>
        <Link href="/goods-receipt" className="inline-flex items-center justify-center rounded-lg border border-border bg-background text-sm font-medium px-2.5 h-8 gap-1.5 hover:bg-muted transition-all">Cancel</Link>
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
