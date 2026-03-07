import { useThreadStore } from '@renderer/stores/thread.store'
import { ThreadItem } from './ThreadItem'

export function ThreadList(): React.JSX.Element {
  const threads = useThreadStore((s) => s.threads)

  if (threads.length === 0) {
    return (
      <div className="px-2 py-4 text-center text-xs text-muted-foreground">
        No threads yet
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {threads.map((thread) => (
        <ThreadItem key={thread.id} thread={thread} />
      ))}
    </div>
  )
}
