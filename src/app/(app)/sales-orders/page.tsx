'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWarehouse } from '@/contexts/warehouse-context'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, ShoppingCart, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

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

export default function SalesOrdersPage() {
  const { warehouse, site } = useWarehouse()
  const { hasPermission, isSuperUser } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const supabase = createClient()

  const canCreate = isSuperUser || hasPermission('sales-orders', 'create')

  const fetchOrders = async () => {
    let q = supabase.from('sales_order_header')
      .select('*, customers(name)')
      .eq('warehouse', warehouse)
      .eq('site', site)
      .order('created_at', { ascending: false })
    if (search) q = q.ilike('so_number', `%${search}%`)
    const { data } = await q
    setOrders(data || [])
  }

  useEffect(() => { if (warehouse && site) fetchOrders() }, [warehouse, site, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart className="h-6 w-6 text-blue-600" /> Sales Orders</h1>
          <p className="text-sm text-slate-500">Manage outbound sales orders</p>
        </div>
        {canCreate && (
          <Link href="/sales-orders/new" className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium px-2.5 h-8 gap-1.5 transition-all hover:opacity-90"><Plus className="h-4 w-4 mr-2" />New SO</Link>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search by SO number..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SO Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No sales orders found</TableCell></TableRow>}
              {orders.map(so => (
                <TableRow key={so.id}>
                  <TableCell className="font-mono text-sm font-medium">{so.so_number}</TableCell>
                  <TableCell>{formatDate(so.so_date)}</TableCell>
                  <TableCell>{so.customers?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${PRIORITY_COLORS[so.priority] || ''} hover:${PRIORITY_COLORS[so.priority] || ''}`}>{so.priority}</Badge>
                  </TableCell>
                  <TableCell>{so.total_lines}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${STATUS_COLORS[so.status] || ''} hover:${STATUS_COLORS[so.status] || ''}`}>{so.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/sales-orders/${so.id}`} className="inline-flex items-center justify-center h-7 w-7 rounded-lg hover:bg-muted transition-colors"><Eye className="h-3 w-3" /></Link>
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
