'use client'
import { useAuth } from '@/contexts/auth-context'
import { useWarehouse } from '@/contexts/warehouse-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Building2, ChevronDown, Menu } from 'lucide-react'
import { WarehouseSwitcher } from './warehouse-switcher'
import { useState } from 'react'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, isSuperUser, signOut } = useAuth()
  const { warehouse, site, siteName } = useWarehouse()
  const [showSwitcher, setShowSwitcher] = useState(false)

  const canSwitch = isSuperUser || user?.roles?.code === 'IT'

  return (
    <header className="h-14 border-b bg-white flex items-center px-3 md:px-4 gap-2 md:gap-4 shrink-0">
      {/* Hamburger - mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Warehouse/Site indicator */}
      <div className="flex-1 min-w-0">
        <button
          onClick={() => canSwitch ? setShowSwitcher(true) : undefined}
          className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 rounded-lg border bg-slate-50 hover:bg-slate-100 transition-colors max-w-full ${canSwitch ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
          <div className="text-sm truncate">
            <span className="font-semibold text-slate-700">{warehouse}</span>
            <span className="text-slate-400 mx-1">·</span>
            <span className="text-slate-600">{site}</span>
          </div>
          <Badge variant="outline" className="text-xs ml-1 hidden sm:inline-flex shrink-0">{siteName}</Badge>
          {canSwitch && <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />}
        </button>
      </div>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="ghost" className="gap-1.5 md:gap-2 px-2 md:px-3">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                {user?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm text-left hidden sm:block">
              <div className="font-medium leading-none truncate max-w-[120px]">{user?.full_name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{user?.roles?.name}</div>
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isSuperUser && <DropdownMenuItem onClick={() => { window.location.href = "/settings" }}>Settings</DropdownMenuItem>}
          <DropdownMenuItem onClick={signOut} className="text-red-600">Sign Out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showSwitcher && <WarehouseSwitcher onClose={() => setShowSwitcher(false)} />}
    </header>
  )
}
