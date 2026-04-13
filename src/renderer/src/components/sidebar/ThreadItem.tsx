import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  CircleAlert,
  CircleCheck,
  MoreHorizontal,
  Pencil,
  Trash2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem
} from '@renderer/components/ui/sidebar'
import { Spinner } from '@renderer/components/ui/spinner'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useThreadSelectionStore } from '@renderer/stores/thread-selection.store'
import { useThread } from '@renderer/hooks/useThread'
import { useThreadActions } from '@renderer/hooks/useThreadActions'
import { cn } from '@renderer/lib/utils'
import type { Thread, ThreadStatus } from '@shared/types'

interface ThreadItemProps {
  thread: Thread
  siblingIds: string[]
}

function formatRelativeTime(value: string): string {
  const diffMs = Math.abs(Date.now() - new Date(value).getTime())
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return 'now'
  if (diffMinutes < 60) return `${diffMinutes}m`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

function StatusIndicator({
  status,
  isActive,
  pendingApproval
}: {
  status: ThreadStatus
  isActive: boolean
  pendingApproval: boolean
}): React.JSX.Element {
  if (pendingApproval) {
    return (
      <span className="relative flex size-2 shrink-0 items-center justify-center">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400/70" />
        <span className="relative inline-flex size-2 rounded-full bg-amber-400" />
      </span>
    )
  }
  if (status === 'running') {
    return <Spinner className="size-3 shrink-0 text-sky-400" />
  }
  if (status === 'error') {
    return <CircleAlert className="size-3 shrink-0 text-rose-400" />
  }
  if (status === 'completed') {
    return <CircleCheck className="size-3 shrink-0 text-emerald-400/90" />
  }
  return (
    <span
      className={cn(
        'size-2 shrink-0 rounded-full',
        isActive ? 'bg-sky-400' : 'bg-sky-500/60'
      )}
    />
  )
}

export function ThreadItem({ thread, siblingIds }: ThreadItemProps): React.JSX.Element {
  const activeThreadId = useThreadStore((s) => s.activeThreadId)
  const isSelected = useThreadSelectionStore((s) => s.selectedIds.has(thread.id))
  const anchorId = useThreadSelectionStore((s) => s.anchorId)
  const selectionSize = useThreadSelectionStore((s) => s.selectedIds.size)
  const selectOnly = useThreadSelectionStore((s) => s.selectOnly)
  const toggle = useThreadSelectionStore((s) => s.toggle)
  const selectRange = useThreadSelectionStore((s) => s.selectRange)
  const clearSelection = useThreadSelectionStore((s) => s.clear)

  const { switchThread, deleteThread } = useThread()
  const { archive, unarchive, rename, moveUp, moveDown } = useThreadActions()

  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(thread.title)

  const isActive = thread.id === activeThreadId
  const archived = thread.archivedAt !== null

  const handleActivate = async (event: MouseEvent): Promise<void> => {
    const meta = event.metaKey || event.ctrlKey
    const shift = event.shiftKey

    if (shift && anchorId) {
      selectRange(anchorId, thread.id, siblingIds)
      return
    }
    if (meta) {
      toggle(thread.id, anchorId ?? thread.id)
      return
    }

    if (selectionSize > 0) clearSelection()
    selectOnly(thread.id)
    await switchThread(thread.id)
  }

  const startRename = (): void => {
    setDraftTitle(thread.title)
    setEditing(true)
  }

  const commitRename = async (): Promise<void> => {
    setEditing(false)
    if (draftTitle.trim() && draftTitle !== thread.title) {
      await rename(thread.id, draftTitle)
    }
  }

  const handleRenameKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void commitRename()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setEditing(false)
    }
  }

  const menuItems = useMemo(
    () => [
      {
        label: 'Rename',
        icon: Pencil,
        onSelect: () => startRename()
      },
      {
        label: 'Move up',
        icon: ArrowUp,
        disabled: archived,
        onSelect: () => void moveUp(thread.id)
      },
      {
        label: 'Move down',
        icon: ArrowDown,
        disabled: archived,
        onSelect: () => void moveDown(thread.id)
      },
      archived
        ? {
            label: 'Unarchive',
            icon: ArchiveRestore,
            onSelect: () => void unarchive(thread.id)
          }
        : {
            label: 'Archive',
            icon: Archive,
            onSelect: () => void archive(thread.id)
          }
    ],
    [archived, thread.id, archive, unarchive, moveUp, moveDown]
  )

  const row = (
    <SidebarMenuItem className={cn('group/thread', isSelected && 'rounded-md bg-white/[0.06]')}>
      <div className="flex items-center gap-1">
        {editing ? (
          <div className="flex flex-1 items-center gap-2 rounded-md bg-white/[0.04] px-2 py-1.5">
            <StatusIndicator
              status={thread.status}
              isActive={isActive}
              pendingApproval={thread.hasPendingApproval}
            />
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKey}
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
            />
          </div>
        ) : (
          <SidebarMenuButton
            variant="ghost"
            isActive={isActive}
            className={cn(
              'min-w-0 flex-1 gap-3 rounded-md px-2',
              archived && 'opacity-70'
            )}
            onClick={handleActivate}
            onDoubleClick={startRename}
            tooltip={thread.title}
          >
            <StatusIndicator
              status={thread.status}
              isActive={isActive}
              pendingApproval={thread.hasPendingApproval}
            />
            <span
              className={cn(
                'min-w-0 flex-1 truncate leading-5',
                isActive ? 'text-white' : 'text-white/84'
              )}
            >
              {thread.title}
            </span>
            <span className="shrink-0 text-xs text-white/35">
              {formatRelativeTime(thread.lastActivityAt || thread.updatedAt)}
            </span>
          </SidebarMenuButton>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            children={
              <SidebarMenuAction
                className="text-white/0 group-hover/thread:text-white/35"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                aria-label={`Open ${thread.title} menu`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </SidebarMenuAction>
            }
          />
          <DropdownMenuContent
            align="end"
            alignOffset={6}
            sideOffset={8}
            className="w-auto min-w-[11rem] border-white/10 bg-[#1f1f1d] text-white shadow-lg ring-white/10"
          >
            {menuItems.map((item) => (
              <DropdownMenuItem
                key={item.label}
                disabled={item.disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  item.onSelect()
                }}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={(event) => {
                event.stopPropagation()
                void deleteThread(thread.id)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete thread
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SidebarMenuItem>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div className="contents" />}>{row}</ContextMenuTrigger>
      <ContextMenuContent className="w-44 border-white/10 bg-[#1f1f1d] text-white shadow-lg ring-white/10">
        {menuItems.map((item) => (
          <ContextMenuItem
            key={item.label}
            disabled={item.disabled}
            onClick={item.onSelect}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => void deleteThread(thread.id)}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete thread
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
