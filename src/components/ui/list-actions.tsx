'use client'
import { Button } from '@/components/ui/button'
import { Copy, Trash2, Pencil } from 'lucide-react'

interface ListActionsProps {
  selectedCount: number
  onCopy?: () => void
  onDelete?: () => void
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
}

export function BulkActionBar({ selectedCount, onCopy, onDelete, canCreate, canEdit, canDelete }: ListActionsProps) {
  if (selectedCount === 0) return null
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
      <span className="text-sm font-medium text-blue-700">{selectedCount} selected</span>
      <div className="flex gap-2 ml-auto">
        {canCreate && onCopy && (
          <Button size="sm" variant="outline" onClick={onCopy} className="text-xs h-7 gap-1.5">
            <Copy className="h-3 w-3" />Copy
          </Button>
        )}
        {canDelete && onDelete && (
          <Button size="sm" variant="outline" onClick={onDelete} className="text-xs h-7 gap-1.5 text-red-600 border-red-300 hover:bg-red-50">
            <Trash2 className="h-3 w-3" />Delete ({selectedCount})
          </Button>
        )}
      </div>
    </div>
  )
}
