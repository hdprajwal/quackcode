import { useCallback } from 'react'
import { invoke } from '@renderer/lib/ipc'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { useSettingsStore } from '@renderer/stores/settings.store'
import type { Thread } from '@shared/types'

export function useThread(): {
  createThread: (projectId?: string) => Promise<Thread | null>
  deleteThread: (threadId: string) => Promise<void>
  switchThread: (threadId: string) => Promise<void>
  loadThreads: () => Promise<void>
  loadAllThreads: () => Promise<void>
} {
  const { setThreads, addThread, removeThread, setActiveThread, setMessages } = useThreadStore()
  const project = useProjectStore((s) => s.project)
  const { selectedProvider, selectedModel } = useSettingsStore()

  const loadThreads = useCallback(async () => {
    if (!project) return
    const threads = await invoke<Thread[]>('thread:list', project.id)
    setThreads(threads)
  }, [project])

  const loadAllThreads = useCallback(async () => {
    const threads = await invoke<Thread[]>('thread:listAll')
    setThreads(threads)
  }, [])

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

      addThread(thread)
      setActiveThread(thread.id)
      setMessages([])
      return thread
    },
    [project, selectedProvider, selectedModel]
  )

  const deleteThread = useCallback(async (threadId: string) => {
    await invoke('thread:delete', threadId)
    removeThread(threadId)
  }, [])

  const switchThread = useCallback(async (threadId: string) => {
    setActiveThread(threadId)
    const thread = useThreadStore.getState().threads.find((t) => t.id === threadId)
    if (thread) {
      const project = useProjectStore
        .getState()
        .recentProjects.find((p) => p.id === thread.projectId)
      if (project) {
        useProjectStore.getState().setProject(project)
      }
    }
    const msgs = await invoke<import('@shared/types').Message[]>('message:list', threadId)
    setMessages(msgs)
  }, [])

  return { createThread, deleteThread, switchThread, loadThreads, loadAllThreads }
}
