'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import {
  LayoutDashboard, Package, MapPin, Users, Truck, ArrowDownToLine,
  ShoppingCart, ClipboardList, BarChart3, Database, Settings, LogOut,
  Package2, ChevronDown, ChevronRight
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', module: 'dashboard' },
  {
    label: 'Masters', icon: Package2, children: [
      { href: '/items', icon: Package, label: 'Item Master', module: 'items' },
      { href: '/locations', icon: MapPin, label: 'Locations', module: 'locations' },
      { href: '/customers', icon: Users, label: 'Customers', module: 'customers' },
      { href: '/suppliers', icon: Truck, label: 'Suppliers', module: 'suppliers' },
    ]
  },
  {
    label: 'Transactions', icon: BarChart3, children: [
      { href: '/goods-receipt', icon: ArrowDownToLine, label: 'Goods Receipt', module: 'goods-receipt' },
      { href: '/sales-orders', icon: ShoppingCart, label: 'Sales Orders', module: 'sales-orders' },
      { href: '/stock-taking', icon: ClipboardList, label: 'Stock Taking', module: 'stock-taking' },
    ]
  },
  { href: '/stock', icon: Package, label: 'Stock', module: 'stock' },
  { href: '/reports', icon: BarChart3, label: 'Reports', module: 'dashboard' },
  { href: '/users', icon: Users, label: 'User Management', module: 'users' },
  { href: '/sql-query', icon: Database, label: 'SQL Query', module: 'sql-query' },
  { href: '/settings', icon: Settings, label: 'Settings', module: 'settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { hasPermission, signOut, isSuperUser } = useAuth()
  const [expanded, setExpanded] = useState<string[]>(['Masters', 'Transactions'])

  const toggleGroup = (label: string) => {
    setExpanded(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label])
  }

  const canSeeItem = (module: string) => isSuperUser || hasPermission(module, 'view')

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white w-64 shrink-0">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-lg">
            <Package2 className="h-6 w-6" />
          </div>
          <div>
            <div className="font-bold text-lg">WMS Portal</div>
            <div className="text-xs text-slate-400">Warehouse Management</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          if ('children' in item && item.children) {
            const visibleChildren = item.children.filter(c => canSeeItem(c.module))
            if (visibleChildren.length === 0) return null
            const isOpen = expanded.includes(item.label)
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
                {isOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    {visibleChildren.map(child => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                          pathname.startsWith(child.href)
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        )}
                      >
                        <child.icon className="h-4 w-4 shrink-0" />
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          if (!canSeeItem(item.module)) return null
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                pathname.startsWith(item.href)
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-slate-700">
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
          onClick={signOut}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
