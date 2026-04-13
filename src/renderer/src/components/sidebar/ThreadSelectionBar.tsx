import { useMemo } from 'react'
import { Archive, Trash2, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useThreadSelectionStore } from '@renderer/stores/thread-selection.store'
import { useThreadActions } from '@renderer/hooks/useThreadActions'

export function ThreadSelectionBar(): React.JSX.Element | null {
  const selectedIds = useThreadSelectionStore((s) => s.selectedIds)
  const clear = useThreadSelectionStore((s) => s.clear)
  const selected = useMemo(() => Array.from(selectedIds), [selectedIds])
  const { archiveMany, deleteMany } = useThreadActions()

  if (selected.length === 0) return null

  return (
    <div className="sticky bottom-0 z-10 flex items-center gap-2 border-t border-white/8 bg-[#1f1f1d]/95 px-3 py-2 backdrop-blur">
      <span className="flex-1 text-xs font-medium text-white/70">
        {selected.length} selected
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-white/55 hover:text-white"
        onClick={() => void archiveMany(selected)}
        aria-label="Archive selected"
      >
        <Archive className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-rose-300 hover:text-rose-200"
        onClick={() => void deleteMany(selected)}
        aria-label="Delete selected"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-white/55 hover:text-white"
        onClick={clear}
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
