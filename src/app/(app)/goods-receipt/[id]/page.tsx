'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
  const [transport, setTransport] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const canEdit = isSuperUser || hasPermission('goods-receipt', 'edit')

  const fetchGR = async () => {
    const [{ data: header }, { data: grLines }] = await Promise.all([
      supabase.from('goods_receipt_header').select('*, suppliers(name, supplier_code)').eq('id', id).single(),
      supabase.from('goods_receipt_lines').select('*, item_master(item_code, description, uom), location_master(location_code)').eq('gr_id', id).order('line_number'),
    ])
    setGr(header)
    setLines(grLines || [])

    // Load linked transport order if any
    if (header) {
      const { data: to } = await supabase
        .from('transport_orders')
        .select('id, to_number, status')
        .eq('source_type', 'GR')
        .eq('source_id', id)
        .maybeSingle()
      setTransport(to || null)
    }

    setLoading(false)
  }

  useEffect(() => { if (id) fetchGR() }, [id])

  // Confirm GR (DRAFT → CONFIRMED) + auto-create PUTAWAY transport
  const confirmGR = async () => {
    if (!window.confirm('Confirm this GR? A putaway transport order will be created automatically.')) return
    try {
      // 1. Mark GR as CONFIRMED
      const { error } = await supabase.from('goods_receipt_header')
        .update({ status: 'CONFIRMED', updated_by: user?.id, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) { toast.error(error.message); return }

      // 2. Get 9-digit transport number
      const { data: toNumber } = await supabase.rpc('get_next_transport_number', {
        p_warehouse: gr.warehouse, p_site: gr.site
      })

      // 3. Create transport_orders header
      const { data: toHeader, error: toErr } = await supabase.from('transport_orders').insert({
        warehouse: gr.warehouse, site: gr.site,
        to_number: toNumber,
        to_type: 'PUTAWAY',
        source_type: 'GR',
        source_id: id,
        source_number: gr.gr_number,
        reference_number: gr.gr_number,
        status: 'OPEN',
        created_by: user?.id,
      }).select().single()
      if (toErr) { toast.error('GR confirmed but transport creation failed: ' + toErr.message); fetchGR(); return }

      // 4. Create transport lines from GR lines
      const toLines = lines.map((l, idx) => ({
        warehouse: gr.warehouse, site: gr.site,
        to_id: toHeader.id,
        line_number: idx + 1,
        item_id: l.item_id,
        from_location_id: null,
        to_location_id: l.location_id || null,
        requested_qty: l.expected_qty,
        confirmed_qty: 0,
        status: 'OPEN',
        lot_number: l.lot_number || null,
        serial_number: l.serial_number || null,
        created_by: user?.id,
      }))
      await supabase.from('transport_order_lines').insert(toLines)

      toast.success(`GR confirmed — Transport ${toNumber} created for putaway`)
      fetchGR()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const cancelGR = async () => {
    if (!window.confirm('Cancel this GR?')) return
    const { error } = await supabase.from('goods_receipt_header')
      .update({ status: 'CANCELLED', updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq('id', id)
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
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{gr.gr_number}</h1>
            <Badge className={`${STATUS_COLORS[gr.status]} hover:${STATUS_COLORS[gr.status]}`}>{gr.status}</Badge>
            {transport && (
              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 font-mono">
                TO: {transport.to_number} ({transport.status})
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500">Goods Receipt · {formatDate(gr.gr_date)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && gr.status === 'DRAFT' && (
            <>
              <Button variant="outline" onClick={confirmGR}><CheckCircle className="h-4 w-4 mr-2" />Confirm + Create Transport</Button>
              <Button variant="outline" className="text-red-600" onClick={cancelGR}>Cancel</Button>
            </>
          )}
          {gr.status === 'CONFIRMED' && transport && (
            <Link href="/transports" className="inline-flex items-center justify-center h-9 px-4 text-sm rounded-lg border border-border hover:bg-muted transition-all gap-2">
              <PackageCheck className="h-4 w-4" />Go to Transport Orders
            </Link>
          )}
        </div>
      </div>

      {gr.status === 'CONFIRMED' && transport && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <strong>Transport {transport.to_number}</strong> is open for putaway. Go to <Link href="/transports" className="underline font-medium">Transport Orders</Link> and enter this number to confirm receipt into stock.
        </div>
      )}

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
                  <TableCell>{line.received_qty ?? '-'} {line.received_qty != null ? line.item_master?.uom : ''}</TableCell>
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
