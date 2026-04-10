'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWarehouse } from '@/contexts/warehouse-context'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Building2 } from 'lucide-react'

export function WarehouseSwitcher({ onClose }: { onClose: () => void }) {
  const [sites, setSites] = useState<any[]>([])
  const { warehouse, site, setWarehouseContext } = useWarehouse()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('sites').select('*, warehouses!inner(name)').eq('is_active', true)
      .then(({ data }) => setSites(data || []))
  }, [])

  const handleSelect = (s: any) => {
    setWarehouseContext(s.warehouse, s.site, s.warehouses.name, s.name)
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Switch Warehouse / Site</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {sites.map(s => (
            <button
              key={`${s.warehouse}-${s.site}`}
              onClick={() => handleSelect(s)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors hover:bg-slate-50 ${s.warehouse === warehouse && s.site === site ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}
            >
              <Building2 className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium text-sm">{s.warehouse} - {s.site}</div>
                <div className="text-xs text-slate-500">{s.warehouses.name} · {s.name}</div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
