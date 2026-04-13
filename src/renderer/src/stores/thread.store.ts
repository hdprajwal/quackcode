import { create } from 'zustand'
import type { Thread, Message, StreamChunk, ToolCall, ToolResult, ThreadEvent } from '@shared/types'

interface PendingMessage {
  id: string
  role: 'assistant'
  content: string
  toolCalls: ToolCall[]
  toolResults: ToolResult[]
  toolCallBuffers: Record<string, string>
}

interface ThreadStore {
  threads: Thread[]
  activeThreadId: string | null
  messages: Message[]
  pendingMessage: PendingMessage | null
  isStreaming: boolean
  eventsByThreadId: Record<string, ThreadEvent[]>
  showArchived: boolean

  setThreads: (threads: Thread[]) => void
  setActiveThread: (threadId: string | null) => void
  addThread: (thread: Thread) => void
  updateThread: (thread: Thread) => void
  removeThread: (threadId: string) => void
  removeThreads: (threadIds: string[]) => void
  removeProjectThreads: (projectId: string) => void
  setMessages: (messages: Message[]) => void
  setIsStreaming: (streaming: boolean) => void
  setShowArchived: (show: boolean) => void

  // Events
  setEventsForThread: (threadId: string, events: ThreadEvent[]) => void
  appendEvent: (event: ThreadEvent) => void
  clearEventsForThread: (threadId: string) => void

  // Streaming
  handleStreamChunk: (chunk: StreamChunk) => void
  clearPendingMessage: () => void
}

export const useThreadStore = create<ThreadStore>((set, get) => ({
  threads: [],
  activeThreadId: null,
  messages: [],
  pendingMessage: null,
  isStreaming: false,
  eventsByThreadId: {},
  showArchived: false,

  setThreads: (threads) => set({ threads }),
  setActiveThread: (threadId) => set({ activeThreadId: threadId }),
  addThread: (thread) =>
    set((s) => {
      const existing = s.threads.find((t) => t.id === thread.id)
      if (existing) {
        return { threads: s.threads.map((t) => (t.id === thread.id ? thread : t)) }
      }
      return { threads: [thread, ...s.threads] }
    }),
  updateThread: (thread) =>
    set((s) => ({
      threads: s.threads.some((t) => t.id === thread.id)
        ? s.threads.map((t) => (t.id === thread.id ? thread : t))
        : [thread, ...s.threads]
    })),
  removeThread: (threadId) =>
    set((s) => ({
      threads: s.threads.filter((t) => t.id !== threadId),
      activeThreadId: s.activeThreadId === threadId ? null : s.activeThreadId
    })),
  removeThreads: (threadIds) =>
    set((s) => {
      const idSet = new Set(threadIds)
      const removedActive = s.activeThreadId ? idSet.has(s.activeThreadId) : false
      return {
        threads: s.threads.filter((t) => !idSet.has(t.id)),
        activeThreadId: removedActive ? null : s.activeThreadId,
        messages: removedActive ? [] : s.messages,
        pendingMessage: removedActive ? null : s.pendingMessage,
        isStreaming: removedActive ? false : s.isStreaming
      }
    }),
  removeProjectThreads: (projectId) =>
    set((state) => {
      const activeThread = state.threads.find((thread) => thread.id === state.activeThreadId)
      const removedActiveThread = activeThread?.projectId === projectId

      return {
        threads: state.threads.filter((thread) => thread.projectId !== projectId),
        activeThreadId: removedActiveThread ? null : state.activeThreadId,
        messages: removedActiveThread ? [] : state.messages,
        pendingMessage: removedActiveThread ? null : state.pendingMessage,
        isStreaming: removedActiveThread ? false : state.isStreaming
      }
    }),
  setMessages: (messages) => set({ messages }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setShowArchived: (show) => set({ showArchived: show }),

  setEventsForThread: (threadId, events) =>
    set((s) => ({ eventsByThreadId: { ...s.eventsByThreadId, [threadId]: events } })),
  appendEvent: (event) =>
    set((s) => {
      const current = s.eventsByThreadId[event.threadId] ?? []
      if (current.some((e) => e.id === event.id)) return s
      const next = [...current, event].sort((a, b) => a.sequence - b.sequence)
      return { eventsByThreadId: { ...s.eventsByThreadId, [event.threadId]: next } }
    }),
  clearEventsForThread: (threadId) =>
    set((s) => {
      const next = { ...s.eventsByThreadId }
      delete next[threadId]
      return { eventsByThreadId: next }
    }),

  handleStreamChunk: (chunk) => {
    const state = get()
    if (chunk.threadId !== state.activeThreadId) return

    const commitPending = (currentState: ThreadStore): void => {
      if (currentState.pendingMessage) {
        const newMessage: Message = {
          id: currentState.pendingMessage.id,
          threadId: currentState.activeThreadId!,
          role: 'assistant',
          content: currentState.pendingMessage.content,
          toolCalls: currentState.pendingMessage.toolCalls,
          toolResults: currentState.pendingMessage.toolResults,
          createdAt: new Date().toISOString()
        }
        set({
          messages: [...currentState.messages, newMessage],
          pendingMessage: null
        })
      }
    }

    if (
      chunk.type !== 'tool_result' &&
      chunk.type !== 'done' &&
      state.pendingMessage &&
      chunk.messageId &&
      state.pendingMessage.id !== chunk.messageId
    ) {
      commitPending(state)
    }

    const currentState = get()

    switch (chunk.type) {
      case 'text_delta': {
        const pending = currentState.pendingMessage || {
          id: chunk.messageId,
          role: 'assistant' as const,
          content: '',
          toolCalls: [],
          toolResults: [],
          toolCallBuffers: {}
        }
        set({
          pendingMessage: { ...pending, content: pending.content + (chunk.content || '') },
          isStreaming: true
        })
        break
      }
      case 'tool_call_start': {
        const pending = currentState.pendingMessage || {
          id: chunk.messageId,
          role: 'assistant' as const,
          content: '',
          toolCalls: [],
          toolResults: [],
          toolCallBuffers: {}
        }
        if (chunk.toolCall) {
          const initialArgs = chunk.toolCall.arguments || {}
          set({
            pendingMessage: {
              ...pending,
              toolCallBuffers: {
                ...pending.toolCallBuffers,
                [chunk.toolCall.id!]: JSON.stringify(initialArgs)
              },
              toolCalls: [
                ...pending.toolCalls.filter((toolCall) => toolCall.id !== chunk.toolCall!.id),
                {
                  id: chunk.toolCall.id!,
                  name: chunk.toolCall.name!,
                  arguments: initialArgs
                }
              ]
            },
            isStreaming: true
          })
        }
        break
      }
      case 'tool_call_delta': {
        const pending = currentState.pendingMessage || {
          id: chunk.messageId,
          role: 'assistant' as const,
          content: '',
          toolCalls: [],
          toolResults: [],
          toolCallBuffers: {}
        }
        const toolCallId = chunk.toolCall?.id
        if (!toolCallId) break

        const chunkContent = chunk.content || ''
        let nextBuffer = `${pending.toolCallBuffers[toolCallId] || ''}${chunkContent}`
        try {
          const standalone = JSON.parse(chunkContent) as Record<string, unknown>
          if (standalone && typeof standalone === 'object' && !Array.isArray(standalone)) {
            nextBuffer = chunkContent
          }
        } catch {
          // Keep accumulating partial JSON deltas.
        }

        let parsedArguments: Record<string, unknown> | null = null
        try {
          parsedArguments = JSON.parse(nextBuffer) as Record<string, unknown>
        } catch {
          parsedArguments = null
        }

        set({
          pendingMessage: {
            ...pending,
            toolCallBuffers: {
              ...pending.toolCallBuffers,
              [toolCallId]: nextBuffer
            },
            toolCalls: pending.toolCalls.map((toolCall) =>
              toolCall.id === toolCallId && parsedArguments
                ? { ...toolCall, arguments: parsedArguments }
                : toolCall
            )
          },
          isStreaming: true
        })
        break
      }
      case 'tool_result': {
        const pending = currentState.pendingMessage
        if (pending && chunk.toolResult) {
          set({
            pendingMessage: {
              ...pending,
              toolResults: [...pending.toolResults, chunk.toolResult]
            }
          })
        }
        break
      }
      case 'done': {
        commitPending(currentState)
        set({ isStreaming: false })
        break
      }
      case 'error': {
        const pending = currentState.pendingMessage || {
          id: chunk.messageId,
          role: 'assistant' as const,
          content: '',
          toolCalls: [],
          toolResults: [],
          toolCallBuffers: {}
        }
        set({
          pendingMessage: {
            ...pending,
            content: pending.content + `\n\nError: ${chunk.error}`
          },
          isStreaming: false
        })
        break
      }
    }
  },

  clearPendingMessage: () => set({ pendingMessage: null })
}))
