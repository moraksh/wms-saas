'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

interface WarehouseContextType {
  warehouse: string
  site: string
  warehouseName: string
  siteName: string
  setWarehouseContext: (warehouse: string, site: string, warehouseName: string, siteName: string) => void
}

const WarehouseContext = createContext<WarehouseContextType>({
  warehouse: '',
  site: '',
  warehouseName: '',
  siteName: '',
  setWarehouseContext: () => {},
})

export function WarehouseProvider({ children, defaultWarehouse, defaultSite, defaultWarehouseName, defaultSiteName }: {
  children: ReactNode
  defaultWarehouse: string
  defaultSite: string
  defaultWarehouseName: string
  defaultSiteName: string
}) {
  const [warehouse, setWarehouse] = useState(defaultWarehouse)
  const [site, setSite] = useState(defaultSite)
  const [warehouseName, setWarehouseName] = useState(defaultWarehouseName)
  const [siteName, setSiteName] = useState(defaultSiteName)

  const setWarehouseContext = (wh: string, st: string, whName: string, stName: string) => {
    setWarehouse(wh)
    setSite(st)
    setWarehouseName(whName)
    setSiteName(stName)
    if (typeof window !== 'undefined') {
      localStorage.setItem('wms_warehouse', wh)
      localStorage.setItem('wms_site', st)
      localStorage.setItem('wms_warehouse_name', whName)
      localStorage.setItem('wms_site_name', stName)
    }
  }

  return (
    <WarehouseContext.Provider value={{ warehouse, site, warehouseName, siteName, setWarehouseContext }}>
      {children}
    </WarehouseContext.Provider>
  )
}

export const useWarehouse = () => useContext(WarehouseContext)
