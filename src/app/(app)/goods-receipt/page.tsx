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
import { Plus, Search, ArrowDownToLine, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  RECEIVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function GoodsReceiptPage() {
  const { warehouse, site } = useWarehouse()
  const { hasPermission, isSuperUser } = useAuth()
  const [records, setRecords] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const supabase = createClient()

  const canCreate = isSuperUser || hasPermission('goods-receipt', 'create')

  const fetchRecords = async () => {
    let q = supabase.from('goods_receipt_header')
      .select('*, suppliers(name)')
      .eq('warehouse', warehouse)
      .eq('site', site)
      .order('created_at', { ascending: false })
    if (search) q = q.ilike('gr_number', `%${search}%`)
    const { data } = await q
    setRecords(data || [])
  }

  useEffect(() => { if (warehouse && site) fetchRecords() }, [warehouse, site, search])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ArrowDownToLine className="h-6 w-6 text-blue-600" /> Goods Receipt</h1>
          <p className="text-sm text-slate-500">Manage inbound goods receipts</p>
        </div>
        {canCreate && (
          <Link href="/goods-receipt/new" className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium px-2.5 h-8 gap-1.5 transition-all hover:opacity-90"><Plus className="h-4 w-4 mr-2" />New GR</Link>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search by GR number..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GR Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Ref.</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No goods receipts found</TableCell></TableRow>}
              {records.map(gr => (
                <TableRow key={gr.id}>
                  <TableCell className="font-mono text-sm font-medium">{gr.gr_number}</TableCell>
                  <TableCell>{formatDate(gr.gr_date)}</TableCell>
                  <TableCell>{gr.suppliers?.name || '-'}</TableCell>
                  <TableCell>{gr.supplier_reference || '-'}</TableCell>
                  <TableCell>{gr.total_lines}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${STATUS_COLORS[gr.status] || 'bg-gray-100 text-gray-700'} hover:${STATUS_COLORS[gr.status] || ''}`}>{gr.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/goods-receipt/${gr.id}`} className="inline-flex items-center justify-center h-7 w-7 rounded-lg hover:bg-muted transition-colors"><Eye className="h-3 w-3" /></Link>
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
