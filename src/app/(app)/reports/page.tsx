'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWarehouse } from '@/contexts/warehouse-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { BarChart3, ArrowDownToLine, ArrowUpFromLine, TrendingUp } from 'lucide-react'
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils'

export default function ReportsPage() {
  const { warehouse, site } = useWarehouse()
  const supabase = createClient()

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(todayStr)
  const [inboundData, setInboundData] = useState<any[]>([])
  const [outboundData, setOutboundData] = useState<any[]>([])
  const [movementsData, setMovementsData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState({ inboundGRs: 0, outboundSOs: 0, totalMovements: 0 })

  const fetchReports = async () => {
    setLoading(true)
    const [inbound, outbound, movements] = await Promise.all([
      supabase.from('goods_receipt_header')
        .select('*, suppliers(name)')
        .eq('warehouse', warehouse).eq('site', site)
        .gte('gr_date', dateFrom).lte('gr_date', dateTo)
        .order('gr_date', { ascending: false }),
      supabase.from('sales_order_header')
        .select('*, customers(name)')
        .eq('warehouse', warehouse).eq('site', site)
        .gte('so_date', dateFrom).lte('so_date', dateTo)
        .order('so_date', { ascending: false }),
      supabase.from('stock_movements')
        .select('*, item_master(item_code, description)')
        .eq('warehouse', warehouse).eq('site', site)
        .gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    setInboundData(inbound.data || [])
    setOutboundData(outbound.data || [])
    setMovementsData(movements.data || [])
    setSummary({
      inboundGRs: inbound.data?.length || 0,
      outboundSOs: outbound.data?.length || 0,
      totalMovements: movements.data?.length || 0,
    })
    setLoading(false)
  }

  useEffect(() => { if (warehouse && site) fetchReports() }, [warehouse, site])

  const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700', CONFIRMED: 'bg-blue-100 text-blue-700',
    RECEIVED: 'bg-green-100 text-green-700', SHIPPED: 'bg-green-100 text-green-700',
    PICKING: 'bg-yellow-100 text-yellow-700', PICKED: 'bg-orange-100 text-orange-700',
    CANCELLED: 'bg-red-100 text-red-700',
  }

  const MOVEMENT_COLORS: Record<string, string> = {
    RECEIPT: 'bg-green-100 text-green-700', SHIPMENT: 'bg-blue-100 text-blue-700',
    TRANSFER: 'bg-purple-100 text-purple-700', ADJUSTMENT: 'bg-orange-100 text-orange-700',
    STOCKTAKE: 'bg-slate-100 text-slate-700',
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6 text-blue-600" /> Reports</h1>
        <p className="text-sm text-slate-500">Inbound, outbound and stock movement reporting</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label>Date From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label>Date To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
            </div>
            <Button onClick={fetchReports} disabled={loading}>{loading ? 'Loading...' : 'Run Report'}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><ArrowDownToLine className="h-4 w-4 text-blue-600" /><span className="text-sm text-slate-500">Goods Receipts</span></div>
            <div className="text-2xl font-bold text-blue-600">{summary.inboundGRs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><ArrowUpFromLine className="h-4 w-4 text-green-600" /><span className="text-sm text-slate-500">Sales Orders</span></div>
            <div className="text-2xl font-bold text-green-600">{summary.outboundSOs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-purple-600" /><span className="text-sm text-slate-500">Stock Movements</span></div>
            <div className="text-2xl font-bold text-purple-600">{summary.totalMovements}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="inbound">
        <TabsList>
          <TabsTrigger value="inbound">Inbound (GR)</TabsTrigger>
          <TabsTrigger value="outbound">Outbound (SO)</TabsTrigger>
          <TabsTrigger value="movements">Stock Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="inbound">
          <Card>
            <CardHeader><CardTitle className="text-base">Goods Receipts - {dateFrom} to {dateTo}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GR Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Supplier Ref</TableHead>
                    <TableHead>Lines</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inboundData.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No goods receipts in selected period</TableCell></TableRow>}
                  {inboundData.map((gr: any) => (
                    <TableRow key={gr.id}>
                      <TableCell className="font-mono text-sm font-medium"><a href={`/goods-receipt/${gr.id}`} className="text-blue-600 hover:underline">{gr.gr_number}</a></TableCell>
                      <TableCell>{formatDate(gr.gr_date)}</TableCell>
                      <TableCell>{gr.suppliers?.name || '-'}</TableCell>
                      <TableCell>{gr.supplier_reference || '-'}</TableCell>
                      <TableCell>{gr.total_lines}</TableCell>
                      <TableCell><Badge className={`text-xs ${STATUS_COLORS[gr.status] || ''} hover:${STATUS_COLORS[gr.status] || ''}`}>{gr.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outbound">
          <Card>
            <CardHeader><CardTitle className="text-base">Sales Orders - {dateFrom} to {dateTo}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SO Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Customer Ref</TableHead>
                    <TableHead>Lines</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outboundData.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No sales orders in selected period</TableCell></TableRow>}
                  {outboundData.map((so: any) => (
                    <TableRow key={so.id}>
                      <TableCell className="font-mono text-sm font-medium"><a href={`/sales-orders/${so.id}`} className="text-blue-600 hover:underline">{so.so_number}</a></TableCell>
                      <TableCell>{formatDate(so.so_date)}</TableCell>
                      <TableCell>{so.customers?.name || '-'}</TableCell>
                      <TableCell>{so.customer_reference || '-'}</TableCell>
                      <TableCell>{so.total_lines}</TableCell>
                      <TableCell><Badge className={`text-xs ${STATUS_COLORS[so.status] || ''} hover:${STATUS_COLORS[so.status] || ''}`}>{so.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader><CardTitle className="text-base">Stock Movements (last 100) - {dateFrom} to {dateTo}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Lot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movementsData.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No movements in selected period</TableCell></TableRow>}
                  {movementsData.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{formatDateTime(m.created_at)}</TableCell>
                      <TableCell><Badge className={`text-xs ${MOVEMENT_COLORS[m.movement_type] || 'bg-gray-100 text-gray-700'} hover:${MOVEMENT_COLORS[m.movement_type] || ''}`}>{m.movement_type}</Badge></TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{m.item_master?.item_code}</div>
                        <div className="text-xs text-slate-500">{m.item_master?.description}</div>
                      </TableCell>
                      <TableCell className={m.quantity > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {m.quantity > 0 ? '+' : ''}{formatNumber(m.quantity, 3)}
                      </TableCell>
                      <TableCell>{m.reference_number || '-'}</TableCell>
                      <TableCell>{m.lot_number || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
export const dynamic = 'force-dynamic'
