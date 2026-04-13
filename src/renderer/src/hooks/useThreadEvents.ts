import { useEffect, useMemo } from 'react'
import { invoke } from '@renderer/lib/ipc'
import { useThreadStore } from '@renderer/stores/thread.store'
import type { ThreadEvent } from '@shared/types'

export function useThreadEvents(threadId: string | null): ThreadEvent[] {
  const eventsByThreadId = useThreadStore((s) => s.eventsByThreadId)
  const setEventsForThread = useThreadStore((s) => s.setEventsForThread)

  useEffect(() => {
    if (!threadId) return
    if (eventsByThreadId[threadId] !== undefined) return
    let cancelled = false
    void invoke<ThreadEvent[]>('thread-event:list', threadId).then((events) => {
      if (cancelled) return
      setEventsForThread(threadId, events)
    })
    return () => {
      cancelled = true
    }
  }, [threadId, eventsByThreadId, setEventsForThread])

  return useMemo(() => {
    if (!threadId) return []
    return eventsByThreadId[threadId] ?? []
  }, [eventsByThreadId, threadId])
}
