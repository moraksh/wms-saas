'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWarehouse } from '@/contexts/warehouse-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowDownToLine, ShoppingCart, Package, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function DashboardPage() {
  const { warehouse, site } = useWarehouse()
  const [stats, setStats] = useState({ grTotal: 0, grPending: 0, soTotal: 0, soPending: 0, stockItems: 0 })
  const [recentGR, setRecentGR] = useState<any[]>([])
  const [recentSO, setRecentSO] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!warehouse || !site) return
    const fetchData = async () => {
      const [grAll, grPending, soAll, soPending, stockCount, gr5, so5] = await Promise.all([
        supabase.from('goods_receipt_header').select('id', { count: 'exact', head: true }).eq('warehouse', warehouse).eq('site', site),
        supabase.from('goods_receipt_header').select('id', { count: 'exact', head: true }).eq('warehouse', warehouse).eq('site', site).in('status', ['DRAFT', 'CONFIRMED']),
        supabase.from('sales_order_header').select('id', { count: 'exact', head: true }).eq('warehouse', warehouse).eq('site', site),
        supabase.from('sales_order_header').select('id', { count: 'exact', head: true }).eq('warehouse', warehouse).eq('site', site).in('status', ['DRAFT', 'CONFIRMED', 'PICKING']),
        supabase.from('stock').select('id', { count: 'exact', head: true }).eq('warehouse', warehouse).eq('site', site).gt('quantity', 0),
        supabase.from('goods_receipt_header').select('gr_number, gr_date, status, suppliers(name)').eq('warehouse', warehouse).eq('site', site).order('created_at', { ascending: false }).limit(5),
        supabase.from('sales_order_header').select('so_number, so_date, status, customers(name)').eq('warehouse', warehouse).eq('site', site).order('created_at', { ascending: false }).limit(5),
      ])
      setStats({ grTotal: grAll.count || 0, grPending: grPending.count || 0, soTotal: soAll.count || 0, soPending: soPending.count || 0, stockItems: stockCount.count || 0 })
      setRecentGR(gr5.data || [])
      setRecentSO(so5.data || [])
    }
    fetchData()
  }, [warehouse, site])

  const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    CONFIRMED: 'bg-blue-100 text-blue-700',
    RECEIVED: 'bg-green-100 text-green-700',
    PICKING: 'bg-yellow-100 text-yellow-700',
    PICKED: 'bg-orange-100 text-orange-700',
    SHIPPED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm">Overview for {warehouse} · {site}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Goods Receipts', icon: ArrowDownToLine, total: stats.grTotal, pending: stats.grPending, color: 'text-blue-600', bg: 'bg-blue-50' },
          { title: 'Sales Orders', icon: ShoppingCart, total: stats.soTotal, pending: stats.soPending, color: 'text-green-600', bg: 'bg-green-50' },
          { title: 'Stock Lines', icon: Package, total: stats.stockItems, pending: 0, color: 'text-purple-600', bg: 'bg-purple-50' },
          { title: 'Pending Actions', icon: Clock, total: stats.grPending + stats.soPending, pending: 0, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(card => (
          <Card key={card.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                {card.pending > 0 && <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">{card.pending} pending</Badge>}
              </div>
              <div className="text-2xl font-bold text-slate-800">{card.total}</div>
              <div className="text-sm text-slate-500">{card.title}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4 text-blue-600" />
              Recent Goods Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentGR.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No receipts yet</p>}
              {recentGR.map((gr: any) => (
                <div key={gr.gr_number} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="text-sm font-medium">{gr.gr_number}</div>
                    <div className="text-xs text-slate-500">{gr.suppliers?.name || 'Unknown Supplier'} · {formatDate(gr.gr_date)}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[gr.status] || 'bg-gray-100 text-gray-700'}`}>{gr.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-green-600" />
              Recent Sales Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentSO.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No orders yet</p>}
              {recentSO.map((so: any) => (
                <div key={so.so_number} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="text-sm font-medium">{so.so_number}</div>
                    <div className="text-xs text-slate-500">{so.customers?.name || 'Unknown Customer'} · {formatDate(so.so_date)}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[so.status] || 'bg-gray-100 text-gray-700'}`}>{so.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
