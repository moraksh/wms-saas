'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWarehouse } from '@/contexts/warehouse-context'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Truck, Search, CheckCircle2, Plus } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function TransportsPage() {
  const { warehouse, site } = useWarehouse()
  const { user, isSuperUser, hasPermission } = useAuth()
  const [transports, setTransports] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('OPEN,IN_PROGRESS')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [newOpen, setNewOpen] = useState(false)
  const [newForm, setNewForm] = useState({ to_type: 'PICK', reference_number: '', notes: '' })
  const [newLines, setNewLines] = useState<any[]>([{ item_id: '', from_location_id: '', to_location_id: '', requested_qty: 1 }])
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const canEdit = isSuperUser || hasPermission('goods-receipt', 'edit')

  const fetchTransports = async () => {
    if (!warehouse || !site) return
    const statuses = statusFilter.split(',')
    let q = supabase
      .from('transport_orders')
      .select('*, wms_users!transport_orders_assigned_to_fkey(full_name, username)')
      .eq('warehouse', warehouse).eq('site', site)
      .in('status', statuses)
      .order('created_at', { ascending: false })
    if (search) q = q.ilike('to_number', `%${search}%`)
    const { data } = await q
    setTransports(data || [])
  }

  const fetchMasters = async () => {
    if (!warehouse || !site) return
    const [{ data: i }, { data: l }] = await Promise.all([
      supabase.from('item_master').select('id, item_code, description, uom').eq('warehouse', warehouse).eq('site', site).eq('is_active', true).order('item_code'),
      supabase.from('location_master').select('id, location_code, zone').eq('warehouse', warehouse).eq('site', site).eq('is_active', true).order('location_code'),
    ])
    setItems(i || [])
    setLocations(l || [])
  }

  useEffect(() => { fetchTransports() }, [warehouse, site, search, statusFilter])
  useEffect(() => { fetchMasters() }, [warehouse, site])

  const openConfirm = async (transport: any) => {
    setSelected(transport)
    const { data } = await supabase
      .from('transport_order_lines')
      .select('*, item_master(item_code, description, uom), from_loc:location_master!transport_order_lines_from_location_id_fkey(location_code), to_loc:location_master!transport_order_lines_to_location_id_fkey(location_code)')
      .eq('to_id', transport.id)
      .order('line_number')
    setLines(data || [])
    setConfirmOpen(true)
  }

  const confirmTransport = async () => {
    if (!selected) return
    setSaving(true)
    try {
      // Update each line
      for (const line of lines) {
        if (line.status === 'OPEN' && line.confirmed_qty > 0) {
          await supabase.from('transport_order_lines').update({
            confirmed_qty: line.confirmed_qty,
            status: 'CONFIRMED',
            updated_by: user?.id,
            updated_at: new Date().toISOString()
          }).eq('id', line.id)

          // Update stock - deduct from source, add to destination
          if (line.from_location_id) {
            const { data: srcStock } = await supabase.from('stock')
              .select('id, quantity')
              .eq('warehouse', warehouse).eq('site', site)
              .eq('item_id', line.item_id).eq('location_id', line.from_location_id)
              .single()
            if (srcStock) {
              await supabase.from('stock').update({
                quantity: Math.max(0, srcStock.quantity - line.confirmed_qty),
                last_movement_at: new Date().toISOString(),
                updated_by: user?.id,
                updated_at: new Date().toISOString()
              }).eq('id', srcStock.id)
            }
          }

          if (line.to_location_id) {
            const { data: dstStock } = await supabase.from('stock')
              .select('id, quantity')
              .eq('warehouse', warehouse).eq('site', site)
              .eq('item_id', line.item_id).eq('location_id', line.to_location_id)
              .maybeSingle()
            if (dstStock) {
              await supabase.from('stock').update({
                quantity: dstStock.quantity + line.confirmed_qty,
                last_movement_at: new Date().toISOString(),
                updated_by: user?.id,
                updated_at: new Date().toISOString()
              }).eq('id', dstStock.id)
            } else {
              await supabase.from('stock').insert({
                warehouse, site, item_id: line.item_id, location_id: line.to_location_id,
                lot_number: line.lot_number || '', serial_number: line.serial_number || '',
                quantity: line.confirmed_qty, reserved_qty: 0,
                last_movement_at: new Date().toISOString(), created_by: user?.id
              })
            }

            // Stock movement record
            await supabase.from('stock_movements').insert({
              warehouse, site, movement_type: 'TRANSFER',
              reference_type: 'TO', reference_id: selected.id, reference_number: selected.to_number,
              item_id: line.item_id, from_location_id: line.from_location_id,
              to_location_id: line.to_location_id, quantity: line.confirmed_qty,
              created_by: user?.id
            })
          }
        }
      }

      // Mark transport as completed
      await supabase.from('transport_orders').update({
        status: 'COMPLETED', completed_at: new Date().toISOString(),
        updated_by: user?.id, updated_at: new Date().toISOString()
      }).eq('id', selected.id)

      toast.success(`Transport ${selected.to_number} confirmed and stock updated`)
      setConfirmOpen(false)
      fetchTransports()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const createTransport = async () => {
    if (newLines.some(l => !l.item_id)) { toast.error('All lines need an item'); return }
    setSaving(true)
    try {
      const { data: seqData } = await supabase.rpc('get_next_doc_number', { p_warehouse: warehouse, p_site: site, p_doc_type: 'TO' })
      const toNumber = seqData || `TO-${Date.now()}`

      const { data: header, error: hErr } = await supabase.from('transport_orders').insert({
        warehouse, site, to_number: toNumber, to_type: newForm.to_type,
        reference_number: newForm.reference_number || null,
        status: 'OPEN', created_by: user?.id
      }).select().single()
      if (hErr) throw hErr

      await supabase.from('transport_order_lines').insert(
        newLines.map((l, idx) => ({
          warehouse, site, to_id: header.id, line_number: idx + 1,
          item_id: l.item_id,
          from_location_id: l.from_location_id || null,
          to_location_id: l.to_location_id || null,
          requested_qty: parseFloat(l.requested_qty) || 1,
          confirmed_qty: 0, status: 'OPEN', created_by: user?.id
        }))
      )

      toast.success(`Transport ${toNumber} created`)
      setNewOpen(false)
      setNewLines([{ item_id: '', from_location_id: '', to_location_id: '', requested_qty: 1 }])
      fetchTransports()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6 text-blue-600" /> Transport Orders
          </h1>
          <p className="text-sm text-slate-500">Confirm stock movements and transfers</p>
        </div>
        {canEdit && (
          <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-2" />New Transport</Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Search transport number..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="OPEN,IN_PROGRESS">Open & In Progress</option>
              <option value="OPEN">Open Only</option>
              <option value="IN_PROGRESS">In Progress Only</option>
              <option value="COMPLETED">Completed</option>
              <option value="OPEN,IN_PROGRESS,COMPLETED,CANCELLED">All</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>TO Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transports.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">No transport orders found</TableCell></TableRow>
                )}
                {transports.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono font-medium">{t.to_number}</TableCell>
                    <TableCell>{t.to_type}</TableCell>
                    <TableCell className="text-sm">{t.reference_number || '-'}</TableCell>
                    <TableCell className="text-sm">{t.wms_users?.full_name || t.wms_users?.username || '-'}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[t.status] || ''}`}>{t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDateTime(t.created_at)}</TableCell>
                    <TableCell>
                      {canEdit && (t.status === 'OPEN' || t.status === 'IN_PROGRESS') && (
                        <Button size="sm" className="text-xs h-7" onClick={() => openConfirm(t)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />Confirm
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Transport Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Confirm Transport — {selected?.to_number}</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Confirm Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-4 text-slate-500">No lines found</TableCell></TableRow>
                )}
                {lines.map((line, idx) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{line.item_master?.item_code}</div>
                      <div className="text-xs text-slate-500">{line.item_master?.description}</div>
                    </TableCell>
                    <TableCell className="text-sm">{line.from_loc?.location_code || '-'}</TableCell>
                    <TableCell className="text-sm">{line.to_loc?.location_code || '-'}</TableCell>
                    <TableCell className="text-sm">{line.requested_qty} {line.item_master?.uom}</TableCell>
                    <TableCell>
                      {line.status === 'OPEN' ? (
                        <Input
                          type="number"
                          className="w-24"
                          value={line.confirmed_qty ?? line.requested_qty}
                          onChange={e => setLines(prev => prev.map((l, i) => i === idx ? { ...l, confirmed_qty: parseFloat(e.target.value) || 0 } : l))}
                        />
                      ) : (
                        <Badge className="bg-green-100 text-green-700">{line.confirmed_qty}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmTransport} disabled={saving}>
              <CheckCircle2 className="h-4 w-4 mr-2" />{saving ? 'Confirming...' : 'Confirm & Update Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Transport Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader><DialogTitle>New Transport Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={newForm.to_type} onChange={e => setNewForm(p => ({ ...p, to_type: e.target.value }))}>
                  <option value="PICK">Pick</option>
                  <option value="PUTAWAY">Putaway</option>
                  <option value="TRANSFER">Transfer</option>
                  <option value="REPLENISHMENT">Replenishment</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Reference</Label>
                <Input value={newForm.reference_number} onChange={e => setNewForm(p => ({ ...p, reference_number: e.target.value }))} placeholder="SO/GR number..." />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lines</Label>
                <Button size="sm" variant="outline" onClick={() => setNewLines(p => [...p, { item_id: '', from_location_id: '', to_location_id: '', requested_qty: 1 }])}>
                  <Plus className="h-3 w-3 mr-1" />Add Line
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newLines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <select className="w-full border rounded px-2 py-1 text-sm" value={line.item_id} onChange={e => setNewLines(p => p.map((l, i) => i === idx ? { ...l, item_id: e.target.value } : l))}>
                            <option value="">-- Item --</option>
                            {items.map(i => <option key={i.id} value={i.id}>{i.item_code} - {i.description}</option>)}
                          </select>
                        </TableCell>
                        <TableCell>
                          <select className="w-full border rounded px-2 py-1 text-sm" value={line.from_location_id} onChange={e => setNewLines(p => p.map((l, i) => i === idx ? { ...l, from_location_id: e.target.value } : l))}>
                            <option value="">-- From --</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.location_code}</option>)}
                          </select>
                        </TableCell>
                        <TableCell>
                          <select className="w-full border rounded px-2 py-1 text-sm" value={line.to_location_id} onChange={e => setNewLines(p => p.map((l, i) => i === idx ? { ...l, to_location_id: e.target.value } : l))}>
                            <option value="">-- To --</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.location_code}</option>)}
                          </select>
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="w-20" value={line.requested_qty} onChange={e => setNewLines(p => p.map((l, i) => i === idx ? { ...l, requested_qty: e.target.value } : l))} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={createTransport} disabled={saving}>{saving ? 'Creating...' : 'Create Transport'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
