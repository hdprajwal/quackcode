import { useMemo, useState } from 'react'
import { Archive, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useThreadStore } from '@renderer/stores/thread.store'
import { ThreadItem } from './ThreadItem'

export function ArchivedThreadsSection(): React.JSX.Element | null {
  const threads = useThreadStore((s) => s.threads)
  const [open, setOpen] = useState(false)

  const archived = useMemo(
    () =>
      threads
        .filter((t) => t.archivedAt !== null)
        .sort(
          (a, b) =>
            new Date(b.archivedAt ?? b.updatedAt).getTime() -
            new Date(a.archivedAt ?? a.updatedAt).getTime()
        ),
    [threads]
  )
  const siblingIds = useMemo(() => archived.map((t) => t.id), [archived])

  if (archived.length === 0) return null

  return (
    <section className="mt-3 border-t border-white/6 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium tracking-[0.04em] text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white'
        )}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <Archive className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Archived</span>
        <span className="text-white/35">{archived.length}</span>
      </button>
      {open ? (
        <ul className="mt-1 flex flex-col gap-0.5 pl-2">
          {archived.map((thread) => (
            <ThreadItem key={thread.id} thread={thread} siblingIds={siblingIds} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}
