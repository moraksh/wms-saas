'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWarehouse } from '@/contexts/warehouse-context'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Scan, Search, ArrowDownToLine, ShoppingCart } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const TYPE_COLORS: Record<string, string> = {
  PUTAWAY: 'bg-blue-100 text-blue-700',
  PICK: 'bg-yellow-100 text-yellow-700',
  TRANSFER: 'bg-purple-100 text-purple-700',
  REPLENISHMENT: 'bg-orange-100 text-orange-700',
}

const SOURCE_COLORS: Record<string, string> = {
  GR: 'bg-green-100 text-green-700',
  SO: 'bg-orange-100 text-orange-700',
}

export default function PicksPage() {
  const { warehouse, site } = useWarehouse()
  const [transports, setTransports] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const supabase = createClient()

  const fetchTransports = async () => {
    if (!warehouse || !site) return
    let q = supabase
      .from('transport_orders')
      .select('*, wms_users!transport_orders_created_by_fkey(full_name, username)')
      .eq('warehouse', warehouse)
      .eq('site', site)
      .in('status', ['OPEN', 'IN_PROGRESS'])
      .order('created_at', { ascending: false })
    if (search) q = q.ilike('to_number', `%${search}%`)
    if (typeFilter !== 'ALL') q = q.eq('to_type', typeFilter)
    const { data } = await q
    setTransports(data || [])
  }

  useEffect(() => { fetchTransports() }, [warehouse, site, search, typeFilter])

  const putawayCount = transports.filter(t => t.to_type === 'PUTAWAY').length
  const pickCount = transports.filter(t => t.to_type === 'PICK').length
  const grCount = transports.filter(t => t.source_type === 'GR').length
  const soCount = transports.filter(t => t.source_type === 'SO').length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scan className="h-6 w-6 text-yellow-600" /> Open Picks
        </h1>
        <p className="text-sm text-slate-500">All open transport orders awaiting confirmation</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'GR Putaway', count: putawayCount, color: 'bg-blue-100 text-blue-700 border-blue-200', icon: ArrowDownToLine },
          { label: 'SO Picks', count: pickCount, color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: ShoppingCart },
          { label: 'From GR', count: grCount, color: 'bg-green-100 text-green-700 border-green-200', icon: ArrowDownToLine },
          { label: 'From SO', count: soCount, color: 'bg-orange-100 text-orange-700 border-orange-200', icon: ShoppingCart },
        ].map(stat => (
          <div key={stat.label} className={`border rounded-lg p-3 text-center ${stat.color}`}>
            <div className="text-2xl font-bold">{stat.count}</div>
            <div className="text-xs font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Search transport number..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Types</option>
              <option value="PUTAWAY">Putaway (GR)</option>
              <option value="PICK">Pick (SO)</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transport No.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-28">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                      <Scan className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      No open transport orders — all clear!
                    </TableCell>
                  </TableRow>
                )}
                {transports.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono font-bold text-base tracking-wider">{t.to_number}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${TYPE_COLORS[t.to_type] || 'bg-gray-100 text-gray-700'}`}>{t.to_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {t.source_type ? (
                        <Badge className={`text-xs ${SOURCE_COLORS[t.source_type] || 'bg-gray-100 text-gray-700'}`}>
                          {t.source_type === 'GR' ? <><ArrowDownToLine className="h-2.5 w-2.5 inline mr-1" />GR</> : <><ShoppingCart className="h-2.5 w-2.5 inline mr-1" />SO</>}
                        </Badge>
                      ) : <span className="text-slate-400 text-xs">Manual</span>}
                    </TableCell>
                    <TableCell className="text-sm font-mono">{t.source_number || t.reference_number || '-'}</TableCell>
                    <TableCell>
                      <Badge className="text-xs bg-blue-100 text-blue-700">{t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDateTime(t.created_at)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/transports?tn=${t.to_number}`}
                        className="inline-flex items-center justify-center h-7 px-3 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all gap-1"
                      >
                        Confirm
                      </Link>
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
