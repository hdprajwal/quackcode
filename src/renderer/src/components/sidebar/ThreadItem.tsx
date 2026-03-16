import { MoreHorizontal, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem
} from '@renderer/components/ui/sidebar'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useThread } from '@renderer/hooks/useThread'
import { cn } from '@renderer/lib/utils'
import type { Thread } from '@shared/types'

interface ThreadItemProps {
  thread: Thread
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

export function ThreadItem({ thread }: ThreadItemProps): React.JSX.Element {
  const activeThreadId = useThreadStore((s) => s.activeThreadId)
  const { switchThread, deleteThread } = useThread()
  const isActive = thread.id === activeThreadId

  return (
    <SidebarMenuItem className="group/thread">
      <div className="flex items-center gap-1">
        <SidebarMenuButton
          variant="ghost"
          isActive={isActive}
          className="min-w-0 flex-1 gap-3 rounded-md px-2"
          onClick={() => switchThread(thread.id)}
          tooltip={thread.title}
        >
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              isActive ? 'bg-sky-400' : 'bg-sky-500/75'
            )}
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
            {formatRelativeTime(thread.updatedAt)}
          </span>
        </SidebarMenuButton>

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
}
