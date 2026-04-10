'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWarehouse } from '@/contexts/warehouse-context'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, ClipboardList, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function StockTakingPage() {
  const { warehouse, site } = useWarehouse()
  const { hasPermission, isSuperUser, user } = useAuth()
  const [records, setRecords] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ description: '', st_date: new Date().toISOString().split('T')[0], zone_filter: '' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const canCreate = isSuperUser || hasPermission('stock-taking', 'create')

  const fetchRecords = async () => {
    let q = supabase.from('stock_taking_header')
      .select('*')
      .eq('warehouse', warehouse)
      .eq('site', site)
      .order('created_at', { ascending: false })
    if (search) q = q.ilike('st_number', `%${search}%`)
    const { data } = await q
    setRecords(data || [])
  }

  useEffect(() => { if (warehouse && site) fetchRecords() }, [warehouse, site, search])

  const createST = async () => {
    setSaving(true)
    try {
      const { data: seqData } = await supabase.rpc('get_next_doc_number', { p_warehouse: warehouse, p_site: site, p_doc_type: 'ST' })
      const stNumber = seqData || `ST-${Date.now()}`

      // Get current stock for the zone (or all)
      let stockQuery = supabase.from('stock').select('*, item_master(item_code), location_master(location_code, zone)').eq('warehouse', warehouse).eq('site', site).gt('quantity', 0)

      const { data: header, error: hErr } = await supabase.from('stock_taking_header').insert({
        warehouse, site,
        st_number: stNumber,
        st_date: form.st_date,
        description: form.description || null,
        zone_filter: form.zone_filter || null,
        status: 'OPEN',
        created_by: user?.id,
      }).select().single()

      if (hErr) throw hErr

      const { data: stockItems } = await stockQuery
      const filtered = form.zone_filter
        ? stockItems?.filter(s => s.location_master?.zone === form.zone_filter)
        : stockItems

      if (filtered && filtered.length > 0) {
        const linePayloads = filtered.map((s, idx) => ({
          warehouse, site,
          st_id: header.id,
          line_number: idx + 1,
          item_id: s.item_id,
          location_id: s.location_id,
          system_qty: s.quantity,
          counted_qty: null,
          variance: null,
          lot_number: s.lot_number || null,
          serial_number: s.serial_number || null,
          status: 'PENDING',
          created_by: user?.id,
        }))
        await supabase.from('stock_taking_lines').insert(linePayloads)
      }

      toast.success(`Stock Take ${stNumber} created`)
      setOpen(false)
      setForm({ description: '', st_date: new Date().toISOString().split('T')[0], zone_filter: '' })
      fetchRecords()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6 text-blue-600" /> Stock Taking</h1>
          <p className="text-sm text-slate-500">Manage stock counts and variance adjustments</p>
        </div>
        {canCreate && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New Stock Take</Button>}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ST Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No stock takes found</TableCell></TableRow>}
              {records.map(st => (
                <TableRow key={st.id}>
                  <TableCell className="font-mono text-sm font-medium">{st.st_number}</TableCell>
                  <TableCell>{formatDate(st.st_date)}</TableCell>
                  <TableCell>{st.description || '-'}</TableCell>
                  <TableCell>{st.zone_filter || 'All Zones'}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${STATUS_COLORS[st.status] || ''} hover:${STATUS_COLORS[st.status] || ''}`}>{st.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/stock-taking/${st.id}`} className="inline-flex items-center justify-center h-7 w-7 rounded-lg hover:bg-muted transition-colors"><Eye className="h-3 w-3" /></Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Stock Take</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.st_date} onChange={e => setForm(p => ({ ...p, st_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description..." />
            </div>
            <div className="space-y-1.5">
              <Label>Zone Filter (leave blank for all)</Label>
              <Input value={form.zone_filter} onChange={e => setForm(p => ({ ...p, zone_filter: e.target.value }))} placeholder="e.g. A, B, RECEIVING..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createST} disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export const dynamic = 'force-dynamic'
