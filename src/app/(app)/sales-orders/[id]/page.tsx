'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, CheckCircle, Package, PackageCheck } from 'lucide-react'
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
  const [transport, setTransport] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const canEdit = isSuperUser || hasPermission('sales-orders', 'edit')

  const fetchSO = async () => {
    const [{ data: header }, { data: soLines }] = await Promise.all([
      supabase.from('sales_order_header').select('*, customers(name, customer_code)').eq('id', id).single(),
      supabase.from('sales_order_lines').select('*, item_master(item_code, description, uom), location_master(location_code)').eq('so_id', id).order('line_number'),
    ])
    setSo(header)
    setLines(soLines || [])

    if (header) {
      const { data: to } = await supabase
        .from('transport_orders')
        .select('id, to_number, status')
        .eq('source_type', 'SO')
        .eq('source_id', id)
        .maybeSingle()
      setTransport(to || null)
    }

    setLoading(false)
  }

  useEffect(() => { if (id) fetchSO() }, [id])

  const confirmSO = async () => {
    const { error } = await supabase.from('sales_order_header')
      .update({ status: 'CONFIRMED', updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('SO confirmed')
    fetchSO()
  }

  // Start Picking (CONFIRMED → PICKING) + auto-create PICK transport
  const startPicking = async () => {
    if (!window.confirm('Start picking? A pick transport order will be created automatically.')) return
    try {
      // 1. Update SO status
      const { error } = await supabase.from('sales_order_header')
        .update({ status: 'PICKING', updated_by: user?.id, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) { toast.error(error.message); return }

      // 2. Get 9-digit transport number
      const { data: toNumber } = await supabase.rpc('get_next_transport_number', {
        p_warehouse: so.warehouse, p_site: so.site
      })

      // 3. Create transport_orders header
      const { data: toHeader, error: toErr } = await supabase.from('transport_orders').insert({
        warehouse: so.warehouse, site: so.site,
        to_number: toNumber,
        to_type: 'PICK',
        source_type: 'SO',
        source_id: id,
        source_number: so.so_number,
        reference_number: so.so_number,
        status: 'OPEN',
        created_by: user?.id,
      }).select().single()
      if (toErr) { toast.error('SO updated but transport creation failed: ' + toErr.message); fetchSO(); return }

      // 4. Create transport lines from SO lines
      const toLines = lines.map((l, idx) => ({
        warehouse: so.warehouse, site: so.site,
        to_id: toHeader.id,
        line_number: idx + 1,
        item_id: l.item_id,
        from_location_id: l.location_id || null,
        to_location_id: null,
        requested_qty: l.ordered_qty,
        confirmed_qty: 0,
        status: 'OPEN',
        created_by: user?.id,
      }))
      await supabase.from('transport_order_lines').insert(toLines)

      toast.success(`Picking started — Transport ${toNumber} created`)
      fetchSO()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const cancelSO = async () => {
    if (!window.confirm('Cancel this SO?')) return
    const { error } = await supabase.from('sales_order_header')
      .update({ status: 'CANCELLED', updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq('id', id)
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
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{so.so_number}</h1>
            <Badge className={`${STATUS_COLORS[so.status]} hover:${STATUS_COLORS[so.status]}`}>{so.status}</Badge>
            <Badge className={`${PRIORITY_COLORS[so.priority]} hover:${PRIORITY_COLORS[so.priority]}`}>{so.priority}</Badge>
            {transport && (
              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 font-mono">
                TO: {transport.to_number} ({transport.status})
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500">Sales Order · {formatDate(so.so_date)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && so.status === 'DRAFT' && (
            <>
              <Button variant="outline" onClick={confirmSO}><CheckCircle className="h-4 w-4 mr-2" />Confirm</Button>
              <Button variant="outline" className="text-red-600" onClick={cancelSO}>Cancel</Button>
            </>
          )}
          {canEdit && so.status === 'CONFIRMED' && (
            <Button variant="outline" onClick={startPicking}><Package className="h-4 w-4 mr-2" />Start Picking + Create Transport</Button>
          )}
          {(so.status === 'PICKING' || so.status === 'PICKED') && transport && (
            <Link href="/transports" className="inline-flex items-center justify-center h-9 px-4 text-sm rounded-lg border border-border hover:bg-muted transition-all gap-2">
              <PackageCheck className="h-4 w-4" />Go to Transport Orders
            </Link>
          )}
        </div>
      </div>

      {(so.status === 'PICKING' || so.status === 'PICKED') && transport && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          <strong>Transport {transport.to_number}</strong> is open for picking. Go to <Link href="/transports" className="underline font-medium">Transport Orders</Link> and enter this number to confirm and deduct stock.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="overflow-x-auto">
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
                  <TableCell>{line.picked_qty || 0} {line.item_master?.uom}</TableCell>
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
        </div>
        </CardContent>
      </Card>
    </div>
  )
}
export const dynamic = 'force-dynamic'
