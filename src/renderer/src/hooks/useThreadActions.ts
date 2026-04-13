import { useCallback } from 'react'
import { invoke } from '@renderer/lib/ipc'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useThreadSelectionStore } from '@renderer/stores/thread-selection.store'
import type { Thread, ThreadReorderEntry } from '@shared/types'

export function useThreadActions(): {
  archive: (threadId: string) => Promise<void>
  unarchive: (threadId: string) => Promise<void>
  rename: (threadId: string, title: string) => Promise<void>
  deleteMany: (threadIds: string[]) => Promise<void>
  archiveMany: (threadIds: string[]) => Promise<void>
  moveUp: (threadId: string) => Promise<void>
  moveDown: (threadId: string) => Promise<void>
  reorder: (entries: ThreadReorderEntry[]) => Promise<void>
} {
  const { updateThread, removeThreads } = useThreadStore()
  const clearSelection = useThreadSelectionStore((s) => s.clear)

  const archive = useCallback(
    async (threadId: string) => {
      await invoke('thread:archive', threadId)
      const thread = useThreadStore.getState().threads.find((t) => t.id === threadId)
      if (thread) updateThread({ ...thread, archivedAt: new Date().toISOString() })
    },
    [updateThread]
  )

  const unarchive = useCallback(
    async (threadId: string) => {
      await invoke('thread:unarchive', threadId)
      const thread = useThreadStore.getState().threads.find((t) => t.id === threadId)
      if (thread) updateThread({ ...thread, archivedAt: null })
    },
    [updateThread]
  )

  const rename = useCallback(
    async (threadId: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      await invoke('thread:updateTitle', { threadId, title: trimmed })
      const thread = useThreadStore.getState().threads.find((t) => t.id === threadId)
      if (thread) updateThread({ ...thread, title: trimmed })
    },
    [updateThread]
  )

  const deleteMany = useCallback(
    async (threadIds: string[]) => {
      if (threadIds.length === 0) return
      await invoke('thread:deleteMany', threadIds)
      removeThreads(threadIds)
      clearSelection()
    },
    [removeThreads, clearSelection]
  )

  const archiveMany = useCallback(
    async (threadIds: string[]) => {
      if (threadIds.length === 0) return
      await invoke('thread:archiveMany', threadIds)
      const now = new Date().toISOString()
      for (const id of threadIds) {
        const thread = useThreadStore.getState().threads.find((t) => t.id === id)
        if (thread) updateThread({ ...thread, archivedAt: now })
      }
      clearSelection()
    },
    [updateThread, clearSelection]
  )

  const reorder = useCallback(async (entries: ThreadReorderEntry[]) => {
    if (entries.length === 0) return
    await invoke('thread:reorder', entries)
    const all = useThreadStore.getState().threads
    const byId: Record<string, Thread> = {}
    for (const t of all) byId[t.id] = t
    for (const entry of entries) {
      const t = byId[entry.threadId]
      if (t) byId[entry.threadId] = { ...t, sortOrder: entry.sortOrder }
    }
    useThreadStore.getState().setThreads(Object.values(byId))
  }, [])

  const moveRelative = useCallback(
    async (threadId: string, direction: -1 | 1) => {
      const threads = useThreadStore.getState().threads
      const target = threads.find((t) => t.id === threadId)
      if (!target) return
      const siblings = threads
        .filter((t) => t.projectId === target.projectId && !t.archivedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      const idx = siblings.findIndex((t) => t.id === threadId)
      if (idx === -1) return
      const swapIdx = idx + direction
      if (swapIdx < 0 || swapIdx >= siblings.length) return
      const a = siblings[idx]
      const b = siblings[swapIdx]
      await reorder([
        { threadId: a.id, sortOrder: b.sortOrder },
        { threadId: b.id, sortOrder: a.sortOrder }
      ])
    },
    [reorder]
  )

  const moveUp = useCallback((threadId: string) => moveRelative(threadId, -1), [moveRelative])
  const moveDown = useCallback((threadId: string) => moveRelative(threadId, 1), [moveRelative])

  return { archive, unarchive, rename, deleteMany, archiveMany, moveUp, moveDown, reorder }
}
