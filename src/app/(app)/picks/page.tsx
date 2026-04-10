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
import { ShoppingCart, Search, Package } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PICKING: 'bg-yellow-100 text-yellow-700',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  NORMAL: 'bg-blue-50 text-blue-600',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

export default function PicksPage() {
  const { warehouse, site } = useWarehouse()
  const { user, isSuperUser, hasPermission } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const canEdit = isSuperUser || hasPermission('sales-orders', 'edit')

  const fetchOrders = async () => {
    if (!warehouse || !site) return
    let q = supabase
      .from('sales_order_header')
      .select('*, customers(name, customer_code)')
      .eq('warehouse', warehouse)
      .eq('site', site)
      .in('status', ['CONFIRMED', 'PICKING'])
      .order('priority', { ascending: false })
      .order('so_date')
    if (search) q = q.ilike('so_number', `%${search}%`)
    const { data } = await q
    setOrders(data || [])
  }

  useEffect(() => { fetchOrders() }, [warehouse, site, search])

  const startPicking = async (soId: string, soNumber: string) => {
    setLoading(true)
    const { error } = await supabase
      .from('sales_order_header')
      .update({ status: 'PICKING', updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq('id', soId)
    if (error) { toast.error(error.message) } else { toast.success(`${soNumber} - Picking started`) }
    setLoading(false)
    fetchOrders()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-yellow-600" /> Open Picks
        </h1>
        <p className="text-sm text-slate-500">Sales orders awaiting picking — sorted by priority</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Urgent', count: orders.filter(o => o.priority === 'URGENT').length, color: 'bg-red-100 text-red-700 border-red-200' },
          { label: 'High', count: orders.filter(o => o.priority === 'HIGH').length, color: 'bg-orange-100 text-orange-700 border-orange-200' },
          { label: 'Normal', count: orders.filter(o => o.priority === 'NORMAL').length, color: 'bg-blue-100 text-blue-700 border-blue-200' },
          { label: 'In Picking', count: orders.filter(o => o.status === 'PICKING').length, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
        ].map(stat => (
          <div key={stat.label} className={`border rounded-lg p-3 text-center ${stat.color}`}>
            <div className="text-2xl font-bold">{stat.count}</div>
            <div className="text-xs font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search SO number..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SO Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-36">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                      <Package className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      No open picks — all caught up!
                    </TableCell>
                  </TableRow>
                )}
                {orders.map(so => (
                  <TableRow key={so.id} className={so.priority === 'URGENT' ? 'bg-red-50' : so.priority === 'HIGH' ? 'bg-orange-50' : ''}>
                    <TableCell className="font-mono font-medium">{so.so_number}</TableCell>
                    <TableCell>
                      <div className="text-sm">{so.customers?.name || '-'}</div>
                      <div className="text-xs text-slate-500">{so.customers?.customer_code}</div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(so.so_date)}</TableCell>
                    <TableCell>{so.total_lines}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${PRIORITY_COLORS[so.priority] || ''}`}>{so.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[so.status] || ''}`}>{so.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canEdit && so.status === 'CONFIRMED' && (
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => startPicking(so.id, so.so_number)} disabled={loading}>
                            Start Pick
                          </Button>
                        )}
                        <Link href={`/sales-orders/${so.id}`} className="inline-flex items-center justify-center h-7 px-2 text-xs rounded-lg border border-border hover:bg-muted transition-all">
                          Open
                        </Link>
                      </div>
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
