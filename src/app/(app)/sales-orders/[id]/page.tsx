'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { ArrowLeft, CheckCircle, Truck, Package } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PICKING: 'bg-yellow-100 text-yellow-700',
  PICKED: 'bg-orange-100 text-orange-700',
  SHIPPED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  NORMAL: 'bg-blue-50 text-blue-600',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

export default function SODetailPage() {
  const params = useParams()
  const id = params.id as string
  const { user, isSuperUser, hasPermission } = useAuth()
  const supabase = createClient()
  const [so, setSo] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pickedQtys, setPickedQtys] = useState<Record<string, number>>({})

  const canEdit = isSuperUser || hasPermission('sales-orders', 'edit')

  const fetchSO = async () => {
    const [{ data: header }, { data: soLines }] = await Promise.all([
      supabase.from('sales_order_header').select('*, customers(name, customer_code)').eq('id', id).single(),
      supabase.from('sales_order_lines').select('*, item_master(item_code, description, uom), location_master(location_code)').eq('so_id', id).order('line_number'),
    ])
    setSo(header)
    setLines(soLines || [])
    const qtys: Record<string, number> = {}
    soLines?.forEach(l => { qtys[l.id] = l.picked_qty || l.ordered_qty })
    setPickedQtys(qtys)
    setLoading(false)
  }

  useEffect(() => { if (id) fetchSO() }, [id])

  const confirm = async () => {
    const { error } = await supabase.from('sales_order_header').update({ status: 'CONFIRMED', updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('SO confirmed')
    fetchSO()
  }

  const startPicking = async () => {
    const { error } = await supabase.from('sales_order_header').update({ status: 'PICKING', updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Picking started')
    fetchSO()
  }

  const completePicking = async () => {
    if (!window.confirm('Complete picking for all lines?')) return
    try {
      for (const line of lines) {
        if (line.status === 'PENDING') {
          const qty = pickedQtys[line.id] || 0
          await supabase.from('sales_order_lines').update({ picked_qty: qty, status: 'PICKED', updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', line.id)
        }
      }
      await supabase.from('sales_order_header').update({ status: 'PICKED', picked_by: user?.id, picked_at: new Date().toISOString(), updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', id)
      toast.success('Picking completed')
      fetchSO()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const ship = async () => {
    if (!window.confirm('Ship this order? This will update stock.')) return
    try {
      for (const line of lines) {
        if (line.status === 'PICKED') {
          const qty = line.picked_qty || 0
          await supabase.from('sales_order_lines').update({ shipped_qty: qty, status: 'SHIPPED', updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', line.id)

          // Deduct stock
          if (qty > 0) {
            const { data: stockLine } = await supabase.from('stock')
              .select('id, quantity')
              .eq('warehouse', so.warehouse).eq('site', so.site)
              .eq('item_id', line.item_id)
              .order('quantity', { ascending: false })
              .limit(1)
              .single()

            if (stockLine) {
              await supabase.from('stock').update({ quantity: Math.max(0, stockLine.quantity - qty), last_movement_at: new Date().toISOString(), updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', stockLine.id)
            }

            await supabase.from('stock_movements').insert({ warehouse: so.warehouse, site: so.site, movement_type: 'SHIPMENT', reference_type: 'SO', reference_id: so.id, reference_number: so.so_number, item_id: line.item_id, from_location_id: line.location_id, quantity: qty, created_by: user?.id })
          }
        }
      }
      await supabase.from('sales_order_header').update({ status: 'SHIPPED', shipped_by: user?.id, shipped_at: new Date().toISOString(), updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', id)
      toast.success('Order shipped')
      fetchSO()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const cancel = async () => {
    if (!window.confirm('Cancel this SO?')) return
    const { error } = await supabase.from('sales_order_header').update({ status: 'CANCELLED', updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('SO cancelled')
    fetchSO()
  }

  if (loading) return <div className="flex items-center justify-center h-48"><div className="text-slate-500">Loading...</div></div>
  if (!so) return <div className="text-center py-12 text-slate-500">SO not found</div>

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/sales-orders" className="inline-flex items-center justify-center size-8 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{so.so_number}</h1>
            <Badge className={`${STATUS_COLORS[so.status]} hover:${STATUS_COLORS[so.status]}`}>{so.status}</Badge>
            <Badge className={`${PRIORITY_COLORS[so.priority]} hover:${PRIORITY_COLORS[so.priority]}`}>{so.priority}</Badge>
          </div>
          <p className="text-sm text-slate-500">Sales Order · {formatDate(so.so_date)}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && so.status === 'DRAFT' && (
            <>
              <Button variant="outline" onClick={confirm}><CheckCircle className="h-4 w-4 mr-2" />Confirm</Button>
              <Button variant="outline" className="text-red-600" onClick={cancel}>Cancel</Button>
            </>
          )}
          {canEdit && so.status === 'CONFIRMED' && (
            <Button variant="outline" onClick={startPicking}><Package className="h-4 w-4 mr-2" />Start Picking</Button>
          )}
          {canEdit && so.status === 'PICKING' && (
            <Button variant="outline" onClick={completePicking}><Package className="h-4 w-4 mr-2" />Complete Picking</Button>
          )}
          {canEdit && so.status === 'PICKED' && (
            <Button onClick={ship}><Truck className="h-4 w-4 mr-2" />Ship</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Header Details</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between"><span className="text-slate-500">Customer</span><span className="font-medium">{so.customers?.name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Customer Ref.</span><span>{so.customer_reference || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Requested Date</span><span>{formatDate(so.requested_date)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total Lines</span><span>{so.total_lines}</span></div>
            {so.ship_to_address && <div className="flex justify-between"><span className="text-slate-500">Ship To</span><span className="text-right max-w-[60%]">{so.ship_to_address}</span></div>}
            {so.notes && <div className="flex justify-between"><span className="text-slate-500">Notes</span><span>{so.notes}</span></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Audit</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between"><span className="text-slate-500">Created</span><span>{formatDateTime(so.created_at)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Updated</span><span>{formatDateTime(so.updated_at)}</span></div>
            {so.picked_at && <div className="flex justify-between"><span className="text-slate-500">Picked</span><span>{formatDateTime(so.picked_at)}</span></div>}
            {so.shipped_at && <div className="flex justify-between"><span className="text-slate-500">Shipped</span><span>{formatDateTime(so.shipped_at)}</span></div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lines</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Picked</TableHead>
                <TableHead>Shipped</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Unit Price</TableHead>
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
                  <TableCell>{line.ordered_qty} {line.item_master?.uom}</TableCell>
                  <TableCell>
                    {so.status === 'PICKING' && line.status === 'PENDING' ? (
                      <Input type="number" className="w-24" value={pickedQtys[line.id] || 0} onChange={e => setPickedQtys(p => ({ ...p, [line.id]: parseFloat(e.target.value) }))} />
                    ) : (
                      <span>{line.picked_qty || 0} {line.item_master?.uom}</span>
                    )}
                  </TableCell>
                  <TableCell>{line.shipped_qty || 0} {line.item_master?.uom}</TableCell>
                  <TableCell>{line.location_master?.location_code || '-'}</TableCell>
                  <TableCell>{line.unit_price ? `$${line.unit_price}` : '-'}</TableCell>
                  <TableCell>
                    <Badge className={line.status === 'SHIPPED' ? 'bg-green-100 text-green-700 hover:bg-green-100' : line.status === 'PICKED' ? 'bg-orange-100 text-orange-700 hover:bg-orange-100' : line.status === 'CANCELLED' ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'}>{line.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
export const dynamic = 'force-dynamic'
