'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function STDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { user, isSuperUser, hasPermission } = useAuth()
  const supabase = createClient()
  const [st, setSt] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [countedQtys, setCountedQtys] = useState<Record<string, string>>({})

  const canEdit = isSuperUser || hasPermission('stock-taking', 'edit')

  const fetchST = async () => {
    const [{ data: header }, { data: stLines }] = await Promise.all([
      supabase.from('stock_taking_header').select('*').eq('id', id).single(),
      supabase.from('stock_taking_lines').select('*, item_master(item_code, description, uom), location_master(location_code, zone)').eq('st_id', id).order('line_number'),
    ])
    setSt(header)
    setLines(stLines || [])
    const qtys: Record<string, string> = {}
    stLines?.forEach(l => { qtys[l.id] = l.counted_qty !== null ? String(l.counted_qty) : '' })
    setCountedQtys(qtys)
    setLoading(false)
  }

  useEffect(() => { if (id) fetchST() }, [id])

  const startCounting = async () => {
    const { error } = await supabase.from('stock_taking_header').update({ status: 'IN_PROGRESS', updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Stock take started')
    fetchST()
  }

  const saveCount = async () => {
    try {
      for (const line of lines) {
        const countedStr = countedQtys[line.id]
        if (countedStr === '' || countedStr === undefined) continue
        const counted = parseFloat(countedStr)
        if (isNaN(counted)) continue
        const variance = counted - line.system_qty
        await supabase.from('stock_taking_lines').update({
          counted_qty: counted,
          variance,
          status: 'COUNTED',
          counted_by: user?.id,
          counted_at: new Date().toISOString(),
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        }).eq('id', line.id)
      }
      toast.success('Counts saved')
      fetchST()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const confirm = async () => {
    if (!window.confirm('Confirm this stock take? This will adjust stock quantities for counted items.')) return
    try {
      for (const line of lines) {
        if (line.status === 'COUNTED' && line.counted_qty !== null) {
          // Adjust stock to counted qty
          const { data: existing } = await supabase.from('stock')
            .select('id, quantity')
            .eq('warehouse', st.warehouse).eq('site', st.site)
            .eq('item_id', line.item_id).eq('location_id', line.location_id)
            .single()

          const variance = line.counted_qty - line.system_qty
          if (existing) {
            await supabase.from('stock').update({ quantity: line.counted_qty, last_movement_at: new Date().toISOString(), updated_by: user?.id }).eq('id', existing.id)
          }

          if (variance !== 0) {
            await supabase.from('stock_movements').insert({
              warehouse: st.warehouse, site: st.site,
              movement_type: 'STOCKTAKE',
              reference_type: 'ST', reference_id: st.id, reference_number: st.st_number,
              item_id: line.item_id, to_location_id: line.location_id,
              quantity: variance, lot_number: line.lot_number || null,
              notes: `Stock take variance: ${variance > 0 ? '+' : ''}${variance}`,
              created_by: user?.id,
            })
          }

          await supabase.from('stock_taking_lines').update({ status: 'CONFIRMED', updated_by: user?.id }).eq('id', line.id)
        }
      }
      await supabase.from('stock_taking_header').update({ status: 'CONFIRMED', confirmed_by: user?.id, confirmed_at: new Date().toISOString(), updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', id)
      toast.success('Stock take confirmed and stock adjusted')
      fetchST()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-48 text-slate-500">Loading...</div>
  if (!st) return <div className="text-center py-12 text-slate-500">Stock take not found</div>

  const countedLines = lines.filter(l => l.status !== 'PENDING').length
  const varianceLines = lines.filter(l => l.variance && l.variance !== 0).length

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/stock-taking" className="inline-flex items-center justify-center size-8 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{st.st_number}</h1>
            <Badge className={`${STATUS_COLORS[st.status]} hover:${STATUS_COLORS[st.status]}`}>{st.status}</Badge>
          </div>
          <p className="text-sm text-slate-500">Stock Take · {formatDate(st.st_date)}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && st.status === 'OPEN' && (
            <Button variant="outline" onClick={startCounting}>Start Counting</Button>
          )}
          {canEdit && st.status === 'IN_PROGRESS' && (
            <>
              <Button variant="outline" onClick={saveCount}>Save Counts</Button>
              <Button onClick={confirm}><CheckCircle className="h-4 w-4 mr-2" />Confirm & Adjust</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{lines.length}</div>
            <div className="text-sm text-slate-500">Total Lines</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{countedLines}</div>
            <div className="text-sm text-slate-500">Counted</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{varianceLines}</div>
            <div className="text-sm text-slate-500">With Variance</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Count Sheet</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>System Qty</TableHead>
                <TableHead>Counted Qty</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">No lines. Create stock take with existing stock.</TableCell></TableRow>}
              {lines.map(line => (
                <TableRow key={line.id} className={line.variance && line.variance !== 0 ? 'bg-orange-50' : ''}>
                  <TableCell>{line.line_number}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{line.item_master?.item_code}</div>
                    <div className="text-xs text-slate-500">{line.item_master?.description}</div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{line.location_master?.location_code}</TableCell>
                  <TableCell>{line.location_master?.zone || '-'}</TableCell>
                  <TableCell>{formatNumber(line.system_qty, 3)}</TableCell>
                  <TableCell>
                    {st.status === 'IN_PROGRESS' ? (
                      <Input
                        type="number"
                        className="w-24"
                        value={countedQtys[line.id] || ''}
                        onChange={e => setCountedQtys(p => ({ ...p, [line.id]: e.target.value }))}
                        placeholder="Enter qty"
                      />
                    ) : (
                      <span>{line.counted_qty !== null ? formatNumber(line.counted_qty, 3) : '-'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {line.variance !== null && line.variance !== 0 ? (
                      <span className={line.variance > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {line.variance > 0 ? '+' : ''}{formatNumber(line.variance, 3)}
                      </span>
                    ) : line.variance === 0 ? (
                      <span className="text-slate-400">0</span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge className={line.status === 'CONFIRMED' ? 'bg-green-100 text-green-700 hover:bg-green-100' : line.status === 'COUNTED' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'}>{line.status}</Badge>
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
