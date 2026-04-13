import { useMemo } from 'react'
import { ThreadItem } from './ThreadItem'
import type { Thread } from '@shared/types'

interface ThreadGroupProps {
  threads: Thread[]
}

export function ThreadGroup({ threads }: ThreadGroupProps): React.JSX.Element {
  const sorted = useMemo(
    () =>
      [...threads].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
        return new Date(b.lastActivityAt || b.updatedAt).getTime() -
          new Date(a.lastActivityAt || a.updatedAt).getTime()
      }),
    [threads]
  )
  const siblingIds = useMemo(() => sorted.map((t) => t.id), [sorted])

  if (sorted.length === 0) {
    return <li className="px-2 py-2 text-sm text-white/30">No threads yet</li>
  }

  return (
    <>
      {sorted.map((thread) => (
        <ThreadItem key={thread.id} thread={thread} siblingIds={siblingIds} />
      ))}
    </>
  )
}
