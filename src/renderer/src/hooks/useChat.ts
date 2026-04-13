import { useEffect, useCallback } from 'react'
import { invoke, on } from '@renderer/lib/ipc'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { useSettingsStore } from '@renderer/stores/settings.store'
import type { StreamChunk, Message } from '@shared/types'

export function useChat(): {
  sendMessage: (content: string) => Promise<void>
  cancelStream: () => void
  loadMessages: (threadId: string) => Promise<void>
} {
  const { activeThreadId, handleStreamChunk, appendMessageToThread, setMessagesForThread, setIsStreaming } =
    useThreadStore()
  const { environmentMode, worktreePath } = useProjectStore()
  const { selectedModel, selectedProvider } = useSettingsStore()

  useEffect(() => {
    const cleanup = on('ai:stream', (chunk: unknown) => {
      handleStreamChunk(chunk as StreamChunk)
    })
    return cleanup
  }, [handleStreamChunk])

  const sendMessage = useCallback(
    async (content: string) => {
      const threadId = useThreadStore.getState().activeThreadId
      const project = useProjectStore.getState().project
      if (!threadId || !project) return

      // Optimistically add user message
      const userMessage: Message = {
        id: crypto.randomUUID(),
        threadId,
        role: 'user',
        content,
        createdAt: new Date().toISOString()
      }

      appendMessageToThread(threadId, userMessage)
      setIsStreaming(threadId, true)

      await invoke('ai:send', {
        threadId,
        content,
        provider: selectedProvider,
        model: selectedModel,
        projectPath: project.path,
        environmentMode,
        worktreePath
      })
    },
    [
      selectedProvider,
      selectedModel,
      environmentMode,
      worktreePath,
      appendMessageToThread,
      setIsStreaming
    ]
  )

  const cancelStream = useCallback(() => {
    if (activeThreadId) {
      invoke('ai:cancel', activeThreadId)
      setIsStreaming(activeThreadId, false)
    }
  }, [activeThreadId, setIsStreaming])

  const loadMessages = useCallback(
    async (threadId: string) => {
      const msgs = await invoke<Message[]>('message:list', threadId)
      setMessagesForThread(threadId, msgs)
    },
    [setMessagesForThread]
  )

  return { sendMessage, cancelStream, loadMessages }
}
