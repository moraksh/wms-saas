'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useWarehouse } from '@/contexts/warehouse-context'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MoveRight, Search, CheckCircle2, ArrowDownToLine, ShoppingCart, Scan } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function TransportsPage() {
  const { warehouse, site } = useWarehouse()
  const { user, isSuperUser, hasPermission } = useAuth()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Transport number entry
  const [tnInput, setTnInput] = useState(searchParams.get('tn') || '')
  const [transport, setTransport] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  // Recent confirmed list
  const [recent, setRecent] = useState<any[]>([])

  const canEdit = isSuperUser || hasPermission('goods-receipt', 'edit') || hasPermission('sales-orders', 'edit')

  const fetchRecent = async () => {
    if (!warehouse || !site) return
    const { data } = await supabase
      .from('transport_orders')
      .select('*')
      .eq('warehouse', warehouse).eq('site', site)
      .order('updated_at', { ascending: false })
      .limit(20)
    setRecent(data || [])
  }

  useEffect(() => { fetchRecent() }, [warehouse, site])

  // Auto-load if ?tn= param is present
  useEffect(() => {
    if (searchParams.get('tn')) {
      lookupTransport(searchParams.get('tn')!)
    }
  }, [])

  const lookupTransport = async (number?: string) => {
    const tn = (number || tnInput).trim()
    if (!tn) return
    setSearching(true)
    setTransport(null)
    setLines([])
    const { data: toData } = await supabase
      .from('transport_orders')
      .select('*')
      .eq('warehouse', warehouse)
      .eq('site', site)
      .eq('to_number', tn)
      .maybeSingle()

    if (!toData) {
      toast.error(`Transport ${tn} not found`)
      setSearching(false)
      return
    }

    const { data: toLines } = await supabase
      .from('transport_order_lines')
      .select('*, item_master(item_code, description, uom), from_loc:location_master!transport_order_lines_from_location_id_fkey(location_code), to_loc:location_master!transport_order_lines_to_location_id_fkey(location_code)')
      .eq('to_id', toData.id)
      .order('line_number')

    // Pre-fill confirmed_qty = requested_qty
    const linesWithQty = (toLines || []).map(l => ({ ...l, confirmed_qty: l.confirmed_qty || l.requested_qty }))

    setTransport(toData)
    setLines(linesWithQty)
    setSearching(false)
  }

  const confirmTransport = async () => {
    if (!transport) return
    setSaving(true)
    try {
      const isGR = transport.source_type === 'GR'
      const isSO = transport.source_type === 'SO'

      for (const line of lines) {
        if (line.status !== 'OPEN') continue
        const qty = parseFloat(line.confirmed_qty) || 0

        // Update transport line
        await supabase.from('transport_order_lines').update({
          confirmed_qty: qty,
          status: 'CONFIRMED',
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        }).eq('id', line.id)

        if (qty <= 0) continue

        if (isGR) {
          // PUTAWAY: add stock at destination (to_location)
          const locId = line.to_location_id
          if (locId) {
            const { data: existing } = await supabase.from('stock')
              .select('id, quantity')
              .eq('warehouse', warehouse).eq('site', site)
              .eq('item_id', line.item_id).eq('location_id', locId)
              .maybeSingle()

            if (existing) {
              await supabase.from('stock').update({
                quantity: existing.quantity + qty,
                last_movement_at: new Date().toISOString(),
                updated_by: user?.id, updated_at: new Date().toISOString()
              }).eq('id', existing.id)
            } else {
              await supabase.from('stock').insert({
                warehouse, site, item_id: line.item_id, location_id: locId,
                lot_number: line.lot_number || '', serial_number: line.serial_number || '',
                quantity: qty, reserved_qty: 0,
                last_movement_at: new Date().toISOString(), created_by: user?.id
              })
            }

            await supabase.from('stock_movements').insert({
              warehouse, site, movement_type: 'RECEIPT',
              reference_type: 'TO', reference_id: transport.id, reference_number: transport.to_number,
              item_id: line.item_id, to_location_id: locId, quantity: qty,
              lot_number: line.lot_number || null, created_by: user?.id
            })
          }

          // Update GR lines as received
          if (transport.source_id) {
            const { data: grLines } = await supabase
              .from('goods_receipt_lines')
              .select('id, status, item_id, expected_qty')
              .eq('gr_id', transport.source_id)
              .eq('item_id', line.item_id)
              .eq('status', 'PENDING')
              .limit(1)
            if (grLines && grLines.length > 0) {
              await supabase.from('goods_receipt_lines').update({
                received_qty: qty, status: 'RECEIVED',
                updated_by: user?.id, updated_at: new Date().toISOString()
              }).eq('id', grLines[0].id)
            }
          }

        } else if (isSO) {
          // PICK: deduct stock from source (from_location)
          const locId = line.from_location_id
          if (locId) {
            const { data: srcStock } = await supabase.from('stock')
              .select('id, quantity')
              .eq('warehouse', warehouse).eq('site', site)
              .eq('item_id', line.item_id).eq('location_id', locId)
              .single()

            if (srcStock) {
              await supabase.from('stock').update({
                quantity: Math.max(0, srcStock.quantity - qty),
                last_movement_at: new Date().toISOString(),
                updated_by: user?.id, updated_at: new Date().toISOString()
              }).eq('id', srcStock.id)
            }
          } else {
            // No specific location — deduct from any stock for this item
            const { data: anyStock } = await supabase.from('stock')
              .select('id, quantity')
              .eq('warehouse', warehouse).eq('site', site)
              .eq('item_id', line.item_id)
              .order('quantity', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (anyStock) {
              await supabase.from('stock').update({
                quantity: Math.max(0, anyStock.quantity - qty),
                last_movement_at: new Date().toISOString(),
                updated_by: user?.id, updated_at: new Date().toISOString()
              }).eq('id', anyStock.id)
            }
          }

          await supabase.from('stock_movements').insert({
            warehouse, site, movement_type: 'SHIPMENT',
            reference_type: 'TO', reference_id: transport.id, reference_number: transport.to_number,
            item_id: line.item_id, from_location_id: locId || null, quantity: qty,
            created_by: user?.id
          })

          // Update SO lines as picked
          if (transport.source_id) {
            const { data: soLines } = await supabase
              .from('sales_order_lines')
              .select('id, status, item_id')
              .eq('so_id', transport.source_id)
              .eq('item_id', line.item_id)
              .eq('status', 'PENDING')
              .limit(1)
            if (soLines && soLines.length > 0) {
              await supabase.from('sales_order_lines').update({
                picked_qty: qty, shipped_qty: qty, status: 'SHIPPED',
                updated_by: user?.id, updated_at: new Date().toISOString()
              }).eq('id', soLines[0].id)
            }
          }

        } else {
          // Manual transport: deduct from source, add to destination
          if (line.from_location_id) {
            const { data: srcStock } = await supabase.from('stock')
              .select('id, quantity')
              .eq('warehouse', warehouse).eq('site', site)
              .eq('item_id', line.item_id).eq('location_id', line.from_location_id)
              .single()
            if (srcStock) {
              await supabase.from('stock').update({
                quantity: Math.max(0, srcStock.quantity - qty),
                last_movement_at: new Date().toISOString(),
                updated_by: user?.id, updated_at: new Date().toISOString()
              }).eq('id', srcStock.id)
            }
          }
          if (line.to_location_id) {
            const { data: dstStock } = await supabase.from('stock')
              .select('id, quantity')
              .eq('warehouse', warehouse).eq('site', site)
              .eq('item_id', line.item_id).eq('location_id', line.to_location_id)
              .maybeSingle()
            if (dstStock) {
              await supabase.from('stock').update({
                quantity: dstStock.quantity + qty,
                last_movement_at: new Date().toISOString(),
                updated_by: user?.id, updated_at: new Date().toISOString()
              }).eq('id', dstStock.id)
            } else {
              await supabase.from('stock').insert({
                warehouse, site, item_id: line.item_id, location_id: line.to_location_id,
                lot_number: '', serial_number: '', quantity: qty, reserved_qty: 0,
                last_movement_at: new Date().toISOString(), created_by: user?.id
              })
            }
            await supabase.from('stock_movements').insert({
              warehouse, site, movement_type: 'TRANSFER',
              reference_type: 'TO', reference_id: transport.id, reference_number: transport.to_number,
              item_id: line.item_id, from_location_id: line.from_location_id,
              to_location_id: line.to_location_id, quantity: qty, created_by: user?.id
            })
          }
        }
      }

      // Mark transport COMPLETED
      await supabase.from('transport_orders').update({
        status: 'COMPLETED', completed_at: new Date().toISOString(),
        updated_by: user?.id, updated_at: new Date().toISOString()
      }).eq('id', transport.id)

      // Mark source document done
      if (isGR && transport.source_id) {
        await supabase.from('goods_receipt_header').update({
          status: 'RECEIVED', received_by: user?.id, received_at: new Date().toISOString(),
          updated_by: user?.id, updated_at: new Date().toISOString()
        }).eq('id', transport.source_id)
      }
      if (isSO && transport.source_id) {
        await supabase.from('sales_order_header').update({
          status: 'SHIPPED', shipped_by: user?.id, shipped_at: new Date().toISOString(),
          updated_by: user?.id, updated_at: new Date().toISOString()
        }).eq('id', transport.source_id)
      }

      toast.success(`Transport ${transport.to_number} confirmed — stock updated!`)
      setTransport(null)
      setLines([])
      setTnInput('')
      fetchRecent()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MoveRight className="h-6 w-6 text-blue-600" /> Transport Orders
        </h1>
        <p className="text-sm text-slate-500">Enter a transport number to confirm and update stock</p>
      </div>

      {/* Transport Number Entry */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Scan className="h-4 w-4" />Enter Transport Number</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-3 max-w-md">
            <Input
              placeholder="000000001"
              className="font-mono text-lg tracking-widest"
              value={tnInput}
              onChange={e => setTnInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') lookupTransport() }}
            />
            <Button onClick={() => lookupTransport()} disabled={searching}>
              <Search className="h-4 w-4 mr-2" />{searching ? 'Looking up...' : 'Load'}
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Type or scan the 9-digit transport number and press Enter or Load</p>
        </CardContent>
      </Card>

      {/* Transport Detail + Confirm */}
      {transport && (
        <Card className={transport.status === 'COMPLETED' ? 'border-green-300' : 'border-blue-300'}>
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="font-mono text-xl">{transport.to_number}</CardTitle>
              <Badge className={`${STATUS_COLORS[transport.status]}`}>{transport.status}</Badge>
              <Badge className={transport.to_type === 'PUTAWAY' ? 'bg-blue-100 text-blue-700' : transport.to_type === 'PICK' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'}>
                {transport.to_type}
              </Badge>
              {transport.source_type === 'GR' && (
                <Badge className="bg-green-100 text-green-700"><ArrowDownToLine className="h-3 w-3 inline mr-1" />GR: {transport.source_number}</Badge>
              )}
              {transport.source_type === 'SO' && (
                <Badge className="bg-orange-100 text-orange-700"><ShoppingCart className="h-3 w-3 inline mr-1" />SO: {transport.source_number}</Badge>
              )}
            </div>
            {transport.source_type === 'GR' && transport.status === 'OPEN' && (
              <p className="text-sm text-green-700 mt-1">Confirming will <strong>add</strong> items to stock (putaway)</p>
            )}
            {transport.source_type === 'SO' && transport.status === 'OPEN' && (
              <p className="text-sm text-orange-700 mt-1">Confirming will <strong>deduct</strong> items from stock (pick)</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>From Location</TableHead>
                    <TableHead>To Location</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Confirm Qty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-slate-500">No lines</TableCell></TableRow>
                  )}
                  {lines.map((line, idx) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{line.item_master?.item_code}</div>
                        <div className="text-xs text-slate-500">{line.item_master?.description}</div>
                      </TableCell>
                      <TableCell className="text-sm font-mono">{line.from_loc?.location_code || '-'}</TableCell>
                      <TableCell className="text-sm font-mono">{line.to_loc?.location_code || '-'}</TableCell>
                      <TableCell className="text-sm">{line.requested_qty} {line.item_master?.uom}</TableCell>
                      <TableCell>
                        {line.status === 'OPEN' ? (
                          <Input
                            type="number"
                            className="w-24"
                            value={line.confirmed_qty ?? line.requested_qty}
                            onChange={e => setLines(prev => prev.map((l, i) => i === idx ? { ...l, confirmed_qty: parseFloat(e.target.value) || 0 } : l))}
                          />
                        ) : (
                          <Badge className="bg-green-100 text-green-700">{line.confirmed_qty}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={line.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>{line.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {transport.status === 'OPEN' && canEdit && (
              <div className="flex justify-end">
                <Button onClick={confirmTransport} disabled={saving} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? 'Confirming...' : `Confirm & Update Stock`}
                </Button>
              </div>
            )}
            {transport.status === 'COMPLETED' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 text-center">
                Transport already completed — stock was updated when confirmed.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent transports */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MoveRight className="h-4 w-4" />Recent Transports</CardTitle></CardHeader>
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
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No transport orders yet</TableCell></TableRow>
                )}
                {recent.map(t => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => { setTnInput(t.to_number); lookupTransport(t.to_number) }}
                  >
                    <TableCell className="font-mono font-bold">{t.to_number}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${t.to_type === 'PUTAWAY' ? 'bg-blue-100 text-blue-700' : t.to_type === 'PICK' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'}`}>{t.to_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {t.source_type === 'GR' && <Badge className="text-xs bg-green-100 text-green-700">GR</Badge>}
                      {t.source_type === 'SO' && <Badge className="text-xs bg-orange-100 text-orange-700">SO</Badge>}
                      {!t.source_type && <span className="text-slate-400 text-xs">Manual</span>}
                    </TableCell>
                    <TableCell className="text-sm font-mono">{t.source_number || t.reference_number || '-'}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[t.status] || ''}`}>{t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDateTime(t.updated_at)}</TableCell>
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
