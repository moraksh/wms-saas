export type UserRole = 'SUPER' | 'MANAGER' | 'OPERATOR' | 'IT'

export interface WmsUser {
  id: string
  warehouse: string
  site: string
  auth_user_id: string
  email: string
  full_name: string
  role_id: string
  is_active: boolean
  default_warehouse: string
  default_site: string
  roles?: { code: string; name: string; is_super_user: boolean }
}

export interface UserPermission {
  module: string
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
}

export interface WarehouseContext {
  warehouse: string
  site: string
  warehouseName: string
  siteName: string
}

export const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'items', label: 'Item Master' },
  { key: 'locations', label: 'Location Master' },
  { key: 'customers', label: 'Customers' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'goods-receipt', label: 'Goods Receipt' },
  { key: 'sales-orders', label: 'Sales Orders' },
  { key: 'stock-taking', label: 'Stock Taking' },
  { key: 'stock', label: 'Stock' },
  { key: 'users', label: 'User Management' },
  { key: 'sql-query', label: 'SQL Query' },
  { key: 'settings', label: 'Settings' },
] as const
