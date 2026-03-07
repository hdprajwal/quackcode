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
  const { activeThreadId, handleStreamChunk, setMessages, setIsStreaming } = useThreadStore()
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
      const activeThreadId = useThreadStore.getState().activeThreadId
      const project = useProjectStore.getState().project
      if (!activeThreadId || !project) return

      // Optimistically add user message
      const userMessage: Message = {
        id: crypto.randomUUID(),
        threadId: activeThreadId,
        role: 'user',
        content,
        createdAt: new Date().toISOString()
      }

      const currentMessages = useThreadStore.getState().messages
      setMessages([...currentMessages, userMessage])
      setIsStreaming(true)

      await invoke('ai:send', {
        threadId: activeThreadId,
        content,
        provider: selectedProvider,
        model: selectedModel,
        projectPath: project.path,
        environmentMode,
        worktreePath
      })
    },
    [selectedProvider, selectedModel, environmentMode, worktreePath, setMessages, setIsStreaming]
  )

  const cancelStream = useCallback(() => {
    if (activeThreadId) {
      invoke('ai:cancel', activeThreadId)
      setIsStreaming(false)
    }
  }, [activeThreadId])

  const loadMessages = useCallback(async (threadId: string) => {
    const msgs = await invoke<Message[]>('message:list', threadId)
    setMessages(msgs)
  }, [])

  return { sendMessage, cancelStream, loadMessages }
}
