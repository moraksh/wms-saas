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
import { Plus, Pencil, Trash2, Search, MapPin } from 'lucide-react'
import { toast } from 'sonner'

interface Location {
  id: string; warehouse: string; site: string; location_code: string; zone: string;
  aisle: string; bay: string; level: string; position: string; location_type: string;
  max_weight: number; is_active: boolean;
}

const EMPTY: Partial<Location> = { location_code: '', zone: '', aisle: '', bay: '', level: '', position: '', location_type: 'STORAGE', max_weight: 0, is_active: true }
const LOCATION_TYPES = ['RECEIVING', 'STORAGE', 'SHIPPING', 'STAGING', 'QUARANTINE']

export default function LocationsPage() {
  const { warehouse, site } = useWarehouse()
  const { hasPermission, isSuperUser, user } = useAuth()
  const [locations, setLocations] = useState<Location[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<Location>>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const canCreate = isSuperUser || hasPermission('locations', 'create')
  const canEdit = isSuperUser || hasPermission('locations', 'edit')
  const canDelete = isSuperUser || hasPermission('locations', 'delete')

  const fetchLocations = async () => {
    let q = supabase.from('location_master').select('*').eq('warehouse', warehouse).eq('site', site).order('location_code')
    if (search) q = q.ilike('location_code', `%${search}%`)
    const { data } = await q
    setLocations(data || [])
  }

  useEffect(() => { if (warehouse && site) fetchLocations() }, [warehouse, site, search])

  const save = async () => {
    if (!form.location_code) { toast.error('Location code is required'); return }
    setLoading(true)
    const payload = { ...form, warehouse, site, updated_by: user?.id, updated_at: new Date().toISOString() }
    let error
    if (editing) {
      ({ error } = await supabase.from('location_master').update(payload).eq('id', editing))
    } else {
      ({ error } = await supabase.from('location_master').insert({ ...payload, created_by: user?.id }))
    }
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success(editing ? 'Location updated' : 'Location created')
    setOpen(false); setEditing(null); setForm(EMPTY); fetchLocations()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this location?')) return
    const { error } = await supabase.from('location_master').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Location deleted')
    fetchLocations()
  }

  const TYPE_COLORS: Record<string, string> = {
    RECEIVING: 'bg-blue-100 text-blue-700',
    STORAGE: 'bg-green-100 text-green-700',
    SHIPPING: 'bg-orange-100 text-orange-700',
    STAGING: 'bg-yellow-100 text-yellow-700',
    QUARANTINE: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MapPin className="h-6 w-6 text-blue-600" /> Location Master</h1>
          <p className="text-sm text-slate-500">Manage warehouse locations</p>
        </div>
        {canCreate && <Button onClick={() => { setForm(EMPTY); setEditing(null); setOpen(true) }}><Plus className="h-4 w-4 mr-2" />New Location</Button>}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search locations..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location Code</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Aisle / Bay / Level</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No locations found</TableCell></TableRow>}
              {locations.map(loc => (
                <TableRow key={loc.id}>
                  <TableCell className="font-mono text-sm font-medium">{loc.location_code}</TableCell>
                  <TableCell>{loc.zone || '-'}</TableCell>
                  <TableCell className="text-sm text-slate-600">{[loc.aisle, loc.bay, loc.level, loc.position].filter(Boolean).join(' / ') || '-'}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${TYPE_COLORS[loc.location_type] || 'bg-gray-100 text-gray-700'} hover:${TYPE_COLORS[loc.location_type] || ''}`}>{loc.location_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={loc.is_active ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                      {loc.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canEdit && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setForm(loc); setEditing(loc.id); setOpen(true) }}><Pencil className="h-3 w-3" /></Button>}
                      {canDelete && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => remove(loc.id)}><Trash2 className="h-3 w-3" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Location' : 'New Location'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Location Code *</Label>
              <Input value={form.location_code || ''} onChange={e => setForm(p => ({ ...p, location_code: e.target.value }))} disabled={!!editing} placeholder="e.g. A-01-01-01" />
            </div>
            <div className="space-y-1.5">
              <Label>Zone</Label>
              <Input value={form.zone || ''} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Location Type</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.location_type || 'STORAGE'} onChange={e => setForm(p => ({ ...p, location_type: e.target.value }))}>
                {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Aisle</Label>
              <Input value={form.aisle || ''} onChange={e => setForm(p => ({ ...p, aisle: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Bay</Label>
              <Input value={form.bay || ''} onChange={e => setForm(p => ({ ...p, bay: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Level</Label>
              <Input value={form.level || ''} onChange={e => setForm(p => ({ ...p, level: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Position</Label>
              <Input value={form.position || ''} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Max Weight (kg)</Label>
              <Input type="number" value={form.max_weight || 0} onChange={e => setForm(p => ({ ...p, max_weight: parseFloat(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.is_active ? 'true' : 'false'} onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export const dynamic = 'force-dynamic'
