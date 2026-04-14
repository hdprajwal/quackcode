import { useEffect, useCallback } from 'react'
import { invoke, on } from '@renderer/lib/ipc'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { coalesceStreamChunks } from '@renderer/lib/stream-coalesce'
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
    // Buffer incoming chunks and flush once per animation frame so a burst of
    // tokens collapses into a single store update + render. text_delta chunks
    // for the same (threadId, messageId) get concatenated by coalesceStreamChunks.
    let pending: StreamChunk[] = []
    let scheduled = false

    const flush = (): void => {
      scheduled = false
      if (pending.length === 0) return
      const batch = pending
      pending = []
      const coalesced = coalesceStreamChunks(batch)
      for (const chunk of coalesced) handleStreamChunk(chunk)
    }

    const schedule = (): void => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(flush)
    }

    const cleanup = on('ai:stream', (chunk: unknown) => {
      const c = chunk as StreamChunk
      pending.push(c)
      // Terminal chunks must not wait a frame — the working indicator and
      // commit-pending logic depend on seeing them immediately.
      if (c.type === 'done' || c.type === 'error') flush()
      else schedule()
    })

    return () => {
      flush()
      cleanup()
    }
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
