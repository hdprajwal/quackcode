import { useCallback, useEffect } from 'react'
import { invoke, on } from '@renderer/lib/ipc'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { useSettingsStore } from '@renderer/stores/settings.store'
import type { Thread, ThreadEvent, ThreadEventNotification } from '@shared/types'

export function useThread(): {
  createThread: (projectId?: string) => Promise<Thread | null>
  deleteThread: (threadId: string) => Promise<void>
  switchThread: (threadId: string) => Promise<void>
  loadThreads: () => Promise<void>
  loadAllThreads: () => Promise<void>
} {
  const { setThreads, addThread, updateThread, removeThread, setActiveThread, setMessages, appendEvent } =
    useThreadStore()
  const project = useProjectStore((s) => s.project)
  const { selectedProvider, selectedModel } = useSettingsStore()

  // Subscribe to thread + thread-event push channels once per hook instance.
  useEffect(() => {
    const offUpdate = on('thread:update', (payload: unknown) => {
      updateThread(payload as Thread)
    })
    const offEvent = on('thread-event:new', (payload: unknown) => {
      const note = payload as ThreadEventNotification
      appendEvent(note.event)
      updateThread(note.thread)
    })
    return () => {
      offUpdate()
      offEvent()
    }
  }, [updateThread, appendEvent])

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
      setMessages([])
      return thread
    },
    [addThread, project, selectedProvider, selectedModel, setActiveThread, setMessages, setThreads]
  )

  const deleteThread = useCallback(
    async (threadId: string) => {
      await invoke('thread:delete', threadId)
      removeThread(threadId)
    },
    [removeThread]
  )

  const switchThread = useCallback(
    async (threadId: string) => {
      setActiveThread(threadId)
      const { useUIStore } = await import('@renderer/stores/ui.store')
      useUIStore.getState().setActiveView('chat')
      const thread = useThreadStore.getState().threads.find((t) => t.id === threadId)
      if (thread) {
        const targetProject = useProjectStore
          .getState()
          .recentProjects.find((p) => p.id === thread.projectId)
        if (targetProject) {
          useProjectStore.getState().setProject(targetProject)
        }
      }
      const [msgs, events] = await Promise.all([
        invoke<import('@shared/types').Message[]>('message:list', threadId),
        invoke<ThreadEvent[]>('thread-event:list', threadId)
      ])
      setMessages(msgs)
      useThreadStore.getState().setEventsForThread(threadId, events)
    },
    [setActiveThread, setMessages]
  )

  return { createThread, deleteThread, switchThread, loadThreads, loadAllThreads }
}
