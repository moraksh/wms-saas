'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useWarehouse } from '@/contexts/warehouse-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Building2, Settings } from 'lucide-react'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  const { isSuperUser } = useAuth()
  const { warehouse, site } = useWarehouse()
  const supabase = createClient()

  const [warehouses, setWarehouses] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])
  const [whOpen, setWhOpen] = useState(false)
  const [siteOpen, setSiteOpen] = useState(false)
  const [whForm, setWhForm] = useState({ code: '', name: '', address: '' })
  const [siteForm, setSiteForm] = useState({ warehouse: '', site: '', name: '', address: '', currency: 'USD' })
  const [editingWh, setEditingWh] = useState<string | null>(null)
  const [editingSite, setEditingSite] = useState<string | null>(null)

  const fetchAll = async () => {
    const [{ data: wh }, { data: st }] = await Promise.all([
      supabase.from('warehouses').select('*').order('code'),
      supabase.from('sites').select('*').order('warehouse').order('site'),
    ])
    setWarehouses(wh || [])
    setSites(st || [])
  }

  useEffect(() => { fetchAll() }, [])

  const saveWarehouse = async () => {
    if (!whForm.code || !whForm.name) { toast.error('Code and name are required'); return }
    let error
    if (editingWh) {
      ({ error } = await supabase.from('warehouses').update({ name: whForm.name, address: whForm.address }).eq('id', editingWh))
    } else {
      ({ error } = await supabase.from('warehouses').insert({ code: whForm.code.toUpperCase(), name: whForm.name, address: whForm.address }))
    }
    if (error) { toast.error(error.message); return }
    toast.success(editingWh ? 'Warehouse updated' : 'Warehouse created')
    setWhOpen(false); setEditingWh(null); setWhForm({ code: '', name: '', address: '' }); fetchAll()
  }

  const saveSite = async () => {
    if (!siteForm.warehouse || !siteForm.site || !siteForm.name) { toast.error('All fields are required'); return }
    let error
    if (editingSite) {
      ({ error } = await supabase.from('sites').update({ name: siteForm.name, address: siteForm.address, currency: siteForm.currency }).eq('id', editingSite))
    } else {
      ({ error } = await supabase.from('sites').insert({ warehouse: siteForm.warehouse.toUpperCase(), site: siteForm.site.toUpperCase(), name: siteForm.name, address: siteForm.address, currency: siteForm.currency }))
    }
    if (error) { toast.error(error.message); return }
    toast.success(editingSite ? 'Site updated' : 'Site created')
    setSiteOpen(false); setEditingSite(null); setSiteForm({ warehouse: '', site: '', name: '', address: '', currency: 'USD' }); fetchAll()
  }

  if (!isSuperUser) return <div className="text-center py-12 text-slate-500">Access denied — Super User only</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="h-6 w-6 text-blue-600" /> Settings</h1>
        <p className="text-sm text-slate-500">Manage warehouses, sites and system configuration</p>
      </div>

      {/* Warehouses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Warehouses</CardTitle>
          <Button size="sm" onClick={() => { setWhForm({ code: '', name: '', address: '' }); setEditingWh(null); setWhOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" />Add Warehouse
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-6">No warehouses</TableCell></TableRow>}
              {warehouses.map(wh => (
                <TableRow key={wh.id}>
                  <TableCell className="font-mono font-medium">{wh.code}</TableCell>
                  <TableCell>{wh.name}</TableCell>
                  <TableCell className="text-sm text-slate-500">{wh.address || '-'}</TableCell>
                  <TableCell><Badge className={wh.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{wh.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      setWhForm({ code: wh.code, name: wh.name, address: wh.address || '' })
                      setEditingWh(wh.id)
                      setWhOpen(true)
                    }}><Pencil className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sites */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Sites / Companies</CardTitle>
          <Button size="sm" onClick={() => { setSiteForm({ warehouse: '', site: '', name: '', address: '', currency: 'USD' }); setEditingSite(null); setSiteOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" />Add Site
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Warehouse</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">No sites</TableCell></TableRow>}
              {sites.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono font-medium">{s.warehouse}</TableCell>
                  <TableCell className="font-mono font-medium">{s.site}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.currency}</TableCell>
                  <TableCell><Badge className={s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      setSiteForm({ warehouse: s.warehouse, site: s.site, name: s.name, address: s.address || '', currency: s.currency || 'USD' })
                      setEditingSite(s.id)
                      setSiteOpen(true)
                    }}><Pencil className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Warehouse Dialog */}
      <Dialog open={whOpen} onOpenChange={setWhOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingWh ? 'Edit Warehouse' : 'New Warehouse'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Code *</Label>
              <Input value={whForm.code} onChange={e => setWhForm(p => ({ ...p, code: e.target.value }))} disabled={!!editingWh} placeholder="WH001" />
            </div>
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={whForm.name} onChange={e => setWhForm(p => ({ ...p, name: e.target.value }))} placeholder="Main Warehouse" />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={whForm.address} onChange={e => setWhForm(p => ({ ...p, address: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhOpen(false)}>Cancel</Button>
            <Button onClick={saveWarehouse}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Site Dialog */}
      <Dialog open={siteOpen} onOpenChange={setSiteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingSite ? 'Edit Site' : 'New Site'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Warehouse Code *</Label>
                <Input value={siteForm.warehouse} onChange={e => setSiteForm(p => ({ ...p, warehouse: e.target.value }))} disabled={!!editingSite} placeholder="WH001" />
              </div>
              <div className="space-y-1.5">
                <Label>Site Code *</Label>
                <Input value={siteForm.site} onChange={e => setSiteForm(p => ({ ...p, site: e.target.value }))} disabled={!!editingSite} placeholder="SITE01" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={siteForm.name} onChange={e => setSiteForm(p => ({ ...p, name: e.target.value }))} placeholder="Main Company" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input value={siteForm.address} onChange={e => setSiteForm(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input value={siteForm.currency} onChange={e => setSiteForm(p => ({ ...p, currency: e.target.value }))} placeholder="USD" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSiteOpen(false)}>Cancel</Button>
            <Button onClick={saveSite}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
