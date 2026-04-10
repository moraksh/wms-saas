'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWarehouse } from '@/contexts/warehouse-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Search, Package, RefreshCw } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

export default function StockPage() {
  const { warehouse, site } = useWarehouse()
  const [stock, setStock] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState({ totalLines: 0, totalItems: 0, lowStock: 0 })
  const supabase = createClient()

  const fetchStock = async () => {
    setLoading(true)
    let q = supabase
      .from('stock')
      .select('*, item_master(item_code, description, uom, min_stock), location_master(location_code, zone)')
      .eq('warehouse', warehouse)
      .eq('site', site)
      .gt('quantity', 0)
      .order('item_master(item_code)')

    if (search) {
      q = q.or(`item_master.item_code.ilike.%${search}%,item_master.description.ilike.%${search}%,location_master.location_code.ilike.%${search}%`)
    }

    const { data } = await q
    const stockData = data || []
    setStock(stockData)

    const uniqueItems = new Set(stockData.map((s: any) => s.item_id))
    const lowStockCount = stockData.filter((s: any) => s.item_master?.min_stock && s.quantity < s.item_master.min_stock).length
    setSummary({ totalLines: stockData.length, totalItems: uniqueItems.size, lowStock: lowStockCount })
    setLoading(false)
  }

  useEffect(() => { if (warehouse && site) fetchStock() }, [warehouse, site])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6 text-blue-600" /> Stock Overview</h1>
          <p className="text-sm text-slate-500">Current stock levels by item and location</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStock} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{summary.totalItems}</div>
            <div className="text-sm text-slate-500">Distinct Items</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{summary.totalLines}</div>
            <div className="text-sm text-slate-500">Stock Lines</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{summary.lowStock}</div>
            <div className="text-sm text-slate-500">Below Min Stock</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Search item or location..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button size="sm" onClick={fetchStock}>Search</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>UOM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">Loading...</TableCell></TableRow>}
              {!loading && stock.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">No stock found</TableCell></TableRow>}
              {stock.map((s: any) => {
                const available = s.quantity - (s.reserved_qty || 0)
                const isLow = s.item_master?.min_stock && s.quantity < s.item_master.min_stock
                return (
                  <TableRow key={s.id} className={isLow ? 'bg-orange-50' : ''}>
                    <TableCell className="font-mono text-sm font-medium">{s.item_master?.item_code}</TableCell>
                    <TableCell>{s.item_master?.description}</TableCell>
                    <TableCell className="font-mono text-sm">{s.location_master?.location_code}</TableCell>
                    <TableCell>{s.location_master?.zone || '-'}</TableCell>
                    <TableCell>{s.lot_number || '-'}</TableCell>
                    <TableCell className="font-medium">{formatNumber(s.quantity, 3)}</TableCell>
                    <TableCell>{formatNumber(s.reserved_qty, 3)}</TableCell>
                    <TableCell>
                      <span className={available <= 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                        {formatNumber(available, 3)}
                      </span>
                    </TableCell>
                    <TableCell>{s.item_master?.uom}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
export const dynamic = 'force-dynamic'
