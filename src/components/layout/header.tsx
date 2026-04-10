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
import { Building2, ChevronDown } from 'lucide-react'
import { WarehouseSwitcher } from './warehouse-switcher'
import { useState } from 'react'

export function Header() {
  const { user, isSuperUser, signOut } = useAuth()
  const { warehouse, site, siteName } = useWarehouse()
  const [showSwitcher, setShowSwitcher] = useState(false)

  const canSwitch = isSuperUser || user?.roles?.code === 'IT'

  return (
    <header className="h-14 border-b bg-white flex items-center px-4 gap-4 shrink-0">
      <div className="flex-1">
        <button
          onClick={() => canSwitch ? setShowSwitcher(true) : null}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-slate-50 hover:bg-slate-100 transition-colors ${canSwitch ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <Building2 className="h-4 w-4 text-blue-600" />
          <div className="text-sm">
            <span className="font-semibold text-slate-700">{warehouse}</span>
            <span className="text-slate-400 mx-1">·</span>
            <span className="text-slate-600">{site}</span>
          </div>
          <Badge variant="outline" className="text-xs ml-1">{siteName}</Badge>
          {canSwitch && <ChevronDown className="h-3 w-3 text-slate-400" />}
        </button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="ghost" className="gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                {user?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm text-left hidden sm:block">
              <div className="font-medium leading-none">{user?.full_name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{user?.roles?.name}</div>
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isSuperUser && <DropdownMenuItem onClick={() => { window.location.href = "/settings" }}>Settings</DropdownMenuItem>}
          <DropdownMenuItem onClick={signOut} className="text-red-600">Sign Out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showSwitcher && <WarehouseSwitcher onClose={() => setShowSwitcher(false)} />}
    </header>
  )
}
