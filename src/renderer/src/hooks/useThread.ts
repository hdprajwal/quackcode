import { useCallback, useEffect } from 'react'
import { invoke, on } from '@renderer/lib/ipc'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useUIStore } from '@renderer/stores/ui.store'
import type { Thread, ThreadEvent, ThreadEventNotification, Message } from '@shared/types'

// Track in-flight loads so concurrent callers share a single IPC round trip.
const messageLoadPromises = new Map<string, Promise<Message[]>>()
const eventLoadPromises = new Map<string, Promise<ThreadEvent[]>>()

// Module-level guard: useThread() is called from every sidebar row, but the
// push channels should only be subscribed once per process, not per hook caller.
let pushListenersInstalled = false
function installPushListenersOnce(): void {
  if (pushListenersInstalled) return
  pushListenersInstalled = true
  const store = useThreadStore.getState()
  on('thread:update', (payload: unknown) => {
    store.updateThread(payload as Thread)
  })
  on('thread-event:new', (payload: unknown) => {
    const note = payload as ThreadEventNotification
    store.appendEvent(note.event)
    store.updateThread(note.thread)
  })
}

function hydrateThread(threadId: string): Promise<void> {
  const state = useThreadStore.getState()
  const messagesLoaded = Boolean(state.loadedMessageThreadIds[threadId])
  const eventsLoaded = state.eventsByThreadId[threadId] !== undefined

  const tasks: Promise<unknown>[] = []

  if (!messagesLoaded) {
    let promise = messageLoadPromises.get(threadId)
    if (!promise) {
      promise = invoke<Message[]>('message:list', threadId)
      messageLoadPromises.set(threadId, promise)
      promise
        .then((msgs) => {
          // Race guard: preserve anything streaming appended during the IPC wait.
          const latest = useThreadStore.getState()
          const current = latest.messagesByThreadId[threadId] ?? []
          const merged = current.length > msgs.length ? current : msgs
          useThreadStore.getState().setMessagesForThread(threadId, merged)
        })
        .finally(() => {
          messageLoadPromises.delete(threadId)
        })
    }
    tasks.push(promise)
  }

  if (!eventsLoaded) {
    let promise = eventLoadPromises.get(threadId)
    if (!promise) {
      promise = invoke<ThreadEvent[]>('thread-event:list', threadId)
      eventLoadPromises.set(threadId, promise)
      promise
        .then((events) => {
          useThreadStore.getState().setEventsForThread(threadId, events)
        })
        .finally(() => {
          eventLoadPromises.delete(threadId)
        })
    }
    tasks.push(promise)
  }

  return tasks.length > 0 ? Promise.all(tasks).then(() => undefined) : Promise.resolve()
}

export function useThread(): {
  createThread: (projectId?: string) => Promise<Thread | null>
  deleteThread: (threadId: string) => Promise<void>
  switchThread: (threadId: string) => void
  prefetchThread: (threadId: string) => void
  loadThreads: () => Promise<void>
  loadAllThreads: () => Promise<void>
} {
  // Zustand actions are stable references — read once from getState() so this
  // hook doesn't subscribe to the full store and re-run on every stream chunk.
  const {
    setThreads,
    addThread,
    removeThread,
    setActiveThread,
    setMessagesForThread
  } = useThreadStore.getState()
  const project = useProjectStore((s) => s.project)
  const selectedProvider = useSettingsStore((s) => s.selectedProvider)
  const selectedModel = useSettingsStore((s) => s.selectedModel)

  // Register push listeners exactly once per process (not once per hook caller).
  useEffect(() => {
    installPushListenersOnce()
  }, [])

  const loadThreads = useCallback(async () => {
    if (!project) return
    const threads = await invoke<Thread[]>('thread:list', project.id)
    setThreads(threads)
  }, [project, setThreads])

  const loadAllThreads = useCallback(async () => {
    const threads = await invoke<Thread[]>('thread:listAll')
    setThreads(threads)
  }, [setThreads])

  const createThread = useCallback(
    async (projectId?: string) => {
      const targetProjectId = projectId ?? project?.id
      if (!targetProjectId) return null

      const thread = await invoke<Thread>('thread:create', {
        projectId: targetProjectId,
        provider: selectedProvider,
        model: selectedModel
      })

      const targetProject = useProjectStore
        .getState()
        .recentProjects.find((recentProject) => recentProject.id === targetProjectId)

      if (targetProject) {
        useProjectStore.getState().setProject(targetProject)
      }

      const currentThreads = useThreadStore.getState().threads

      if (currentThreads.some((currentThread) => currentThread.id === thread.id)) {
        setThreads([
          thread,
          ...currentThreads.filter((currentThread) => currentThread.id !== thread.id)
        ])
      } else {
        addThread(thread)
      }

      setActiveThread(thread.id)
      setMessagesForThread(thread.id, [])
      return thread
    },
    [addThread, project, selectedProvider, selectedModel, setActiveThread, setMessagesForThread, setThreads]
  )

  const deleteThread = useCallback(
    async (threadId: string) => {
      await invoke('thread:delete', threadId)
      removeThread(threadId)
    },
    [removeThread]
  )

  // Fire-and-forget switch. All synchronous store updates happen up front so the
  // UI flips in the same frame as the click; IPC hydration happens in the
  // background and only fires when nothing is cached yet.
  const switchThread = useCallback(
    (threadId: string) => {
      setActiveThread(threadId)
      useUIStore.getState().setActiveView('chat')

      const thread = useThreadStore.getState().threads.find((t) => t.id === threadId)
      if (thread) {
        const projectState = useProjectStore.getState()
        if (projectState.project?.id !== thread.projectId) {
          const targetProject = projectState.recentProjects.find((p) => p.id === thread.projectId)
          if (targetProject) {
            projectState.setProject(targetProject)
          }
        }
      }

      void hydrateThread(threadId)
    },
    [setActiveThread]
  )

  const prefetchThread = useCallback((threadId: string) => {
    void hydrateThread(threadId)
  }, [])

  return { createThread, deleteThread, switchThread, prefetchThread, loadThreads, loadAllThreads }
}
