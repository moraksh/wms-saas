'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { ArrowLeft, CheckCircle, PackageCheck } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  RECEIVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function GRDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { user, isSuperUser, hasPermission } = useAuth()
  const supabase = createClient()
  const [gr, setGr] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({})

  const canEdit = isSuperUser || hasPermission('goods-receipt', 'edit')

  const fetchGR = async () => {
    const [{ data: header }, { data: grLines }] = await Promise.all([
      supabase.from('goods_receipt_header').select('*, suppliers(name, supplier_code)').eq('id', id).single(),
      supabase.from('goods_receipt_lines').select('*, item_master(item_code, description, uom), location_master(location_code)').eq('gr_id', id).order('line_number'),
    ])
    setGr(header)
    setLines(grLines || [])
    const qtys: Record<string, number> = {}
    grLines?.forEach(l => { qtys[l.id] = l.received_qty || l.expected_qty })
    setReceivedQtys(qtys)
    setLoading(false)
  }

  useEffect(() => { if (id) fetchGR() }, [id])

  const confirmGR = async () => {
    if (!window.confirm('Confirm this GR? Status will change to CONFIRMED.')) return
    const { error } = await supabase.from('goods_receipt_header').update({ status: 'CONFIRMED', updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('GR confirmed')
    fetchGR()
  }

  const receive = async () => {
    if (!window.confirm('Mark all lines as received? This will update stock.')) return
    try {
      // Update each line with received qty
      for (const line of lines) {
        if (line.status === 'PENDING') {
          const qty = receivedQtys[line.id] || 0
          await supabase.from('goods_receipt_lines').update({ received_qty: qty, status: 'RECEIVED', updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', line.id)

          if (qty > 0 && line.location_id) {
            // Upsert stock
            const { data: existing } = await supabase.from('stock')
              .select('id, quantity')
              .eq('warehouse', gr.warehouse).eq('site', gr.site)
              .eq('item_id', line.item_id).eq('location_id', line.location_id)
              .eq('lot_number', line.lot_number || '').eq('serial_number', line.serial_number || '')
              .single()

            if (existing) {
              await supabase.from('stock').update({ quantity: existing.quantity + qty, last_movement_at: new Date().toISOString(), updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', existing.id)
            } else {
              await supabase.from('stock').insert({ warehouse: gr.warehouse, site: gr.site, item_id: line.item_id, location_id: line.location_id, lot_number: line.lot_number || '', serial_number: line.serial_number || '', quantity: qty, reserved_qty: 0, last_movement_at: new Date().toISOString(), created_by: user?.id })
            }

            // Stock movement
            await supabase.from('stock_movements').insert({ warehouse: gr.warehouse, site: gr.site, movement_type: 'RECEIPT', reference_type: 'GR', reference_id: gr.id, reference_number: gr.gr_number, item_id: line.item_id, to_location_id: line.location_id, quantity: qty, lot_number: line.lot_number || null, created_by: user?.id })
          }
        }
      }

      await supabase.from('goods_receipt_header').update({ status: 'RECEIVED', received_by: user?.id, received_at: new Date().toISOString(), updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', id)
      toast.success('GR received and stock updated')
      fetchGR()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const cancel = async () => {
    if (!window.confirm('Cancel this GR?')) return
    const { error } = await supabase.from('goods_receipt_header').update({ status: 'CANCELLED', updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('GR cancelled')
    fetchGR()
  }

  if (loading) return <div className="flex items-center justify-center h-48"><div className="text-slate-500">Loading...</div></div>
  if (!gr) return <div className="text-center py-12 text-slate-500">GR not found</div>

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/goods-receipt" className="inline-flex items-center justify-center size-8 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{gr.gr_number}</h1>
            <Badge className={`${STATUS_COLORS[gr.status]} hover:${STATUS_COLORS[gr.status]}`}>{gr.status}</Badge>
          </div>
          <p className="text-sm text-slate-500">Goods Receipt · {formatDate(gr.gr_date)}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && gr.status === 'DRAFT' && (
            <>
              <Button variant="outline" onClick={confirmGR}><CheckCircle className="h-4 w-4 mr-2" />Confirm</Button>
              <Button variant="outline" className="text-red-600" onClick={cancel}>Cancel</Button>
            </>
          )}
          {canEdit && gr.status === 'CONFIRMED' && (
            <Button onClick={receive}><PackageCheck className="h-4 w-4 mr-2" />Receive All</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Header Details</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between"><span className="text-slate-500">Supplier</span><span className="font-medium">{gr.suppliers?.name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Supplier Ref.</span><span>{gr.supplier_reference || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">GR Date</span><span>{formatDate(gr.gr_date)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total Lines</span><span>{gr.total_lines}</span></div>
            {gr.notes && <div className="flex justify-between"><span className="text-slate-500">Notes</span><span>{gr.notes}</span></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Audit</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between"><span className="text-slate-500">Created</span><span>{formatDateTime(gr.created_at)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Updated</span><span>{formatDateTime(gr.updated_at)}</span></div>
            {gr.received_at && <div className="flex justify-between"><span className="text-slate-500">Received</span><span>{formatDateTime(gr.received_at)}</span></div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lines</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Expected Qty</TableHead>
                <TableHead>Received Qty</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">No lines</TableCell></TableRow>}
              {lines.map(line => (
                <TableRow key={line.id}>
                  <TableCell>{line.line_number}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{line.item_master?.item_code}</div>
                    <div className="text-xs text-slate-500">{line.item_master?.description}</div>
                  </TableCell>
                  <TableCell>{line.expected_qty} {line.item_master?.uom}</TableCell>
                  <TableCell>
                    {gr.status === 'CONFIRMED' && line.status === 'PENDING' ? (
                      <Input type="number" className="w-24" value={receivedQtys[line.id] || 0} onChange={e => setReceivedQtys(p => ({ ...p, [line.id]: parseFloat(e.target.value) }))} />
                    ) : (
                      <span>{line.received_qty} {line.item_master?.uom}</span>
                    )}
                  </TableCell>
                  <TableCell>{line.location_master?.location_code || '-'}</TableCell>
                  <TableCell>{line.lot_number || '-'}</TableCell>
                  <TableCell>{line.unit_cost ? `$${line.unit_cost}` : '-'}</TableCell>
                  <TableCell>
                    <Badge className={line.status === 'RECEIVED' ? 'bg-green-100 text-green-700 hover:bg-green-100' : line.status === 'REJECTED' ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'}>{line.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </CardContent>
      </Card>
    </div>
  )
}
export const dynamic = 'force-dynamic'
