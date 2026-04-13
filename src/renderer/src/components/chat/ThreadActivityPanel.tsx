import { useMemo, useState } from 'react'
import {
  Activity,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Hammer,
  Info,
  ShieldQuestion
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useThreadEvents } from '@renderer/hooks/useThreadEvents'
import type { ThreadEvent, ThreadEventTone } from '@shared/types'

const TONE_ICON: Record<ThreadEventTone, typeof Info> = {
  info: Info,
  tool: Hammer,
  approval: ShieldQuestion,
  error: CircleAlert
}

const TONE_COLOR: Record<ThreadEventTone, string> = {
  info: 'text-sky-300/80',
  tool: 'text-violet-300/80',
  approval: 'text-amber-300/90',
  error: 'text-rose-300/90'
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function groupByTurn(events: ThreadEvent[]): Array<{ turnId: string | null; events: ThreadEvent[] }> {
  const groups: Array<{ turnId: string | null; events: ThreadEvent[] }> = []
  for (const event of events) {
    const last = groups[groups.length - 1]
    if (last && last.turnId === event.turnId) {
      last.events.push(event)
    } else {
      groups.push({ turnId: event.turnId, events: [event] })
    }
  }
  return groups
}

export function ThreadActivityPanel(): React.JSX.Element | null {
  const activeThreadId = useThreadStore((s) => s.activeThreadId)
  const events = useThreadEvents(activeThreadId)
  const [open, setOpen] = useState(false)

  const { groups, turnSummary } = useMemo(() => {
    const recent = events.slice(-40)
    const grouped = groupByTurn(recent)
    const last = recent[recent.length - 1]
    const summary = last ? `${last.summary} · ${formatTime(last.createdAt)}` : null
    return { groups: grouped, turnSummary: summary }
  }, [events])

  if (!activeThreadId || events.length === 0) return null

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-3">
      <div className="overflow-hidden rounded-lg border border-white/8 bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white/60 transition-colors hover:bg-white/[0.03] hover:text-white'
          )}
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="size-3.5 text-white/40" />
          ) : (
            <ChevronRight className="size-3.5 text-white/40" />
          )}
          <Activity className="size-3.5 text-white/60" />
          <span className="font-medium tracking-[0.02em]">Activity</span>
          {turnSummary ? (
            <span className="ml-2 flex-1 truncate text-white/45">{turnSummary}</span>
          ) : (
            <span className="ml-2 flex-1 text-white/35">{events.length} events</span>
          )}
          {events.some((e) => e.tone === 'error') ? (
            <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
              error
            </span>
          ) : null}
          {events.some((e) => e.tone === 'approval') ? (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
              approval
            </span>
          ) : null}
        </button>
        {open ? (
          <ol className="max-h-[40vh] divide-y divide-white/6 overflow-y-auto border-t border-white/6">
            {groups.map((group, gi) => (
              <li key={group.turnId ?? `turn-${gi}`}>
                <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-white/35">
                  <span className="font-medium">
                    {group.turnId ? `Turn ${group.turnId.slice(0, 6)}` : 'Standalone'}
                  </span>
                  <span className="text-white/25">
                    {formatTime(group.events[0].createdAt)}
                  </span>
                </div>
                <ul className="flex flex-col gap-1 px-3 pb-2">
                  {group.events.map((event) => {
                    const Icon = TONE_ICON[event.tone]
                    const last = event
                    const completed = last.kind.endsWith('.completed') ? CircleCheck : null
                    const IconToRender = completed ?? Icon
                    return (
                      <li
                        key={event.id}
                        className="flex items-start gap-2 text-xs text-white/75"
                      >
                        <IconToRender className={cn('mt-0.5 size-3.5', TONE_COLOR[event.tone])} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{event.summary}</div>
                          {event.payload && typeof event.payload === 'object' && 'detail' in event.payload ? (
                            <div className="truncate text-white/45">
                              {String(event.payload.detail).slice(0, 240)}
                            </div>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[10px] text-white/30">
                          {formatTime(event.createdAt)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  )
}
