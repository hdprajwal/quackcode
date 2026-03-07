import { MessageSquare, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useThread } from '@renderer/hooks/useThread'
import { cn } from '@renderer/lib/utils'
import type { Thread } from '@shared/types'

interface ThreadItemProps {
  thread: Thread
}

export function ThreadItem({ thread }: ThreadItemProps): React.JSX.Element {
  const activeThreadId = useThreadStore((s) => s.activeThreadId)
  const { switchThread, deleteThread } = useThread()
  const isActive = thread.id === activeThreadId

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-sm',
        isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'
      )}
      onClick={() => switchThread(thread.id)}
    >
      <MessageSquare className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{thread.title}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          deleteThread(thread.id)
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}
