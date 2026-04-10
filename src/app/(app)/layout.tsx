import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { AuthProvider } from '@/contexts/auth-context'
import { WarehouseProvider } from '@/contexts/warehouse-context'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: wmsUser } = await supabase
    .from('wms_users')
    .select('default_warehouse, default_site')
    .eq('auth_user_id', user.id)
    .single()

  const warehouse = wmsUser?.default_warehouse || 'WH001'
  const site = wmsUser?.default_site || 'SITE01'

  const { data: siteData } = await supabase
    .from('sites')
    .select('name, warehouses!inner(name)')
    .eq('warehouse', warehouse)
    .eq('site', site)
    .single()

  return (
    <AuthProvider>
      <WarehouseProvider
        defaultWarehouse={warehouse}
        defaultSite={site}
        defaultWarehouseName={(siteData?.warehouses as any)?.name || warehouse}
        defaultSiteName={siteData?.name || site}
      >
        <div className="flex h-screen overflow-hidden bg-slate-50">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Header />
            <main className="flex-1 overflow-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </WarehouseProvider>
    </AuthProvider>
  )
}
export const dynamic = 'force-dynamic'
