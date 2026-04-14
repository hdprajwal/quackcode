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

// Stable empty reference so selectors returning "no messages" keep the same identity.
export const EMPTY_MESSAGES: readonly Message[] = Object.freeze([])

interface ThreadStore {
  threads: Thread[]
  activeThreadId: string | null
  messagesByThreadId: Record<string, Message[]>
  loadedMessageThreadIds: Record<string, true>
  pendingByThreadId: Record<string, PendingMessage>
  streamingByThreadId: Record<string, boolean>
  streamingStartedAtByThreadId: Record<string, number>
  eventsByThreadId: Record<string, ThreadEvent[]>
  showArchived: boolean

  setThreads: (threads: Thread[]) => void
  setActiveThread: (threadId: string | null) => void
  addThread: (thread: Thread) => void
  updateThread: (thread: Thread) => void
  removeThread: (threadId: string) => void
  removeThreads: (threadIds: string[]) => void
  removeProjectThreads: (projectId: string) => void
  setMessagesForThread: (threadId: string, messages: Message[]) => void
  appendMessageToThread: (threadId: string, message: Message) => void
  clearMessagesForThread: (threadId: string) => void
  setIsStreaming: (threadId: string, streaming: boolean) => void
  setShowArchived: (show: boolean) => void

  // Events
  setEventsForThread: (threadId: string, events: ThreadEvent[]) => void
  appendEvent: (event: ThreadEvent) => void
  clearEventsForThread: (threadId: string) => void

  // Streaming
  handleStreamChunk: (chunk: StreamChunk) => void
  clearPendingMessage: (threadId: string) => void
}

function omitKey<V>(record: Record<string, V>, key: string): Record<string, V> {
  if (!(key in record)) return record
  const next = { ...record }
  delete next[key]
  return next
}

function omitKeys<V>(record: Record<string, V>, keys: Iterable<string>): Record<string, V> {
  const next = { ...record }
  let changed = false
  for (const key of keys) {
    if (key in next) {
      delete next[key]
      changed = true
    }
  }
  return changed ? next : record
}

// Selector factory — stable identity across renders for the same threadId.
export const selectMessagesForThread =
  (threadId: string | null | undefined) =>
  (state: ThreadStore): readonly Message[] =>
    threadId ? state.messagesByThreadId[threadId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES

export const selectPendingForThread =
  (threadId: string | null | undefined) =>
  (state: ThreadStore): PendingMessage | null =>
    threadId ? state.pendingByThreadId[threadId] ?? null : null

export const selectIsStreamingForThread =
  (threadId: string | null | undefined) =>
  (state: ThreadStore): boolean =>
    threadId ? Boolean(state.streamingByThreadId[threadId]) : false

export const selectStreamingStartedAtForThread =
  (threadId: string | null | undefined) =>
  (state: ThreadStore): number | null =>
    threadId ? state.streamingStartedAtByThreadId[threadId] ?? null : null

export const selectIsThreadLoaded =
  (threadId: string | null | undefined) =>
  (state: ThreadStore): boolean =>
    threadId ? Boolean(state.loadedMessageThreadIds[threadId]) : false

export const useThreadStore = create<ThreadStore>((set, get) => ({
  threads: [],
  activeThreadId: null,
  messagesByThreadId: {},
  loadedMessageThreadIds: {},
  pendingByThreadId: {},
  streamingByThreadId: {},
  streamingStartedAtByThreadId: {},
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
      activeThreadId: s.activeThreadId === threadId ? null : s.activeThreadId,
      messagesByThreadId: omitKey(s.messagesByThreadId, threadId),
      loadedMessageThreadIds: omitKey(s.loadedMessageThreadIds, threadId),
      pendingByThreadId: omitKey(s.pendingByThreadId, threadId),
      streamingByThreadId: omitKey(s.streamingByThreadId, threadId),
      streamingStartedAtByThreadId: omitKey(s.streamingStartedAtByThreadId, threadId)
    })),
  removeThreads: (threadIds) =>
    set((s) => {
      const idSet = new Set(threadIds)
      const removedActive = s.activeThreadId ? idSet.has(s.activeThreadId) : false
      return {
        threads: s.threads.filter((t) => !idSet.has(t.id)),
        activeThreadId: removedActive ? null : s.activeThreadId,
        messagesByThreadId: omitKeys(s.messagesByThreadId, idSet),
        loadedMessageThreadIds: omitKeys(s.loadedMessageThreadIds, idSet),
        pendingByThreadId: omitKeys(s.pendingByThreadId, idSet),
        streamingByThreadId: omitKeys(s.streamingByThreadId, idSet),
        streamingStartedAtByThreadId: omitKeys(s.streamingStartedAtByThreadId, idSet)
      }
    }),
  removeProjectThreads: (projectId) =>
    set((state) => {
      const removedIds = state.threads
        .filter((thread) => thread.projectId === projectId)
        .map((thread) => thread.id)
      const idSet = new Set(removedIds)
      const activeThread = state.threads.find((thread) => thread.id === state.activeThreadId)
      const removedActiveThread = activeThread?.projectId === projectId

      return {
        threads: state.threads.filter((thread) => thread.projectId !== projectId),
        activeThreadId: removedActiveThread ? null : state.activeThreadId,
        messagesByThreadId: omitKeys(state.messagesByThreadId, idSet),
        loadedMessageThreadIds: omitKeys(state.loadedMessageThreadIds, idSet),
        pendingByThreadId: omitKeys(state.pendingByThreadId, idSet),
        streamingByThreadId: omitKeys(state.streamingByThreadId, idSet),
        streamingStartedAtByThreadId: omitKeys(state.streamingStartedAtByThreadId, idSet)
      }
    }),
  setMessagesForThread: (threadId, messages) =>
    set((s) => ({
      messagesByThreadId: { ...s.messagesByThreadId, [threadId]: messages },
      loadedMessageThreadIds: { ...s.loadedMessageThreadIds, [threadId]: true }
    })),
  appendMessageToThread: (threadId, message) =>
    set((s) => {
      const current = s.messagesByThreadId[threadId] ?? []
      return {
        messagesByThreadId: { ...s.messagesByThreadId, [threadId]: [...current, message] },
        loadedMessageThreadIds: s.loadedMessageThreadIds[threadId]
          ? s.loadedMessageThreadIds
          : { ...s.loadedMessageThreadIds, [threadId]: true }
      }
    }),
  clearMessagesForThread: (threadId) =>
    set((s) => ({
      messagesByThreadId: omitKey(s.messagesByThreadId, threadId),
      loadedMessageThreadIds: omitKey(s.loadedMessageThreadIds, threadId)
    })),
  setIsStreaming: (threadId, streaming) =>
    set((s) => ({
      streamingByThreadId: streaming
        ? { ...s.streamingByThreadId, [threadId]: true }
        : omitKey(s.streamingByThreadId, threadId),
      streamingStartedAtByThreadId: streaming
        ? s.streamingStartedAtByThreadId[threadId]
          ? s.streamingStartedAtByThreadId
          : { ...s.streamingStartedAtByThreadId, [threadId]: Date.now() }
        : omitKey(s.streamingStartedAtByThreadId, threadId)
    })),
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
    const threadId = chunk.threadId
    if (!threadId) return

    const setPending = (
      state: ThreadStore,
      next: PendingMessage | null,
      patch: Partial<ThreadStore> = {}
    ): void => {
      const pendingByThreadId = next
        ? { ...state.pendingByThreadId, [threadId]: next }
        : omitKey(state.pendingByThreadId, threadId)
      set({ ...patch, pendingByThreadId })
    }

    const commitPending = (currentState: ThreadStore): void => {
      const pending = currentState.pendingByThreadId[threadId]
      if (!pending) return
      const newMessage: Message = {
        id: pending.id,
        threadId,
        role: 'assistant',
        content: pending.content,
        toolCalls: pending.toolCalls,
        toolResults: pending.toolResults,
        createdAt: new Date().toISOString()
      }
      const nextPending = omitKey(currentState.pendingByThreadId, threadId)
      const existing = currentState.messagesByThreadId[threadId] ?? []
      set({
        pendingByThreadId: nextPending,
        messagesByThreadId: {
          ...currentState.messagesByThreadId,
          [threadId]: [...existing, newMessage]
        }
      })
    }

    const state = get()
    const existingPending = state.pendingByThreadId[threadId]

    if (
      chunk.type !== 'tool_result' &&
      chunk.type !== 'done' &&
      existingPending &&
      chunk.messageId &&
      existingPending.id !== chunk.messageId
    ) {
      commitPending(state)
    }

    const currentState = get()
    const pendingOrSeed = (): PendingMessage =>
      currentState.pendingByThreadId[threadId] || {
        id: chunk.messageId,
        role: 'assistant' as const,
        content: '',
        toolCalls: [],
        toolResults: [],
        toolCallBuffers: {}
      }

    switch (chunk.type) {
      case 'text_delta': {
        const pending = pendingOrSeed()
        setPending(
          currentState,
          { ...pending, content: pending.content + (chunk.content || '') },
          { streamingByThreadId: { ...currentState.streamingByThreadId, [threadId]: true } }
        )
        break
      }
      case 'tool_call_start': {
        const pending = pendingOrSeed()
        if (chunk.toolCall) {
          const initialArgs = chunk.toolCall.arguments || {}
          const existingToolCall = pending.toolCalls.find(
            (toolCall) => toolCall.id === chunk.toolCall!.id
          )
          const mergedArguments = existingToolCall
            ? { ...existingToolCall.arguments, ...initialArgs }
            : initialArgs
          const nextBuffer =
            pending.toolCallBuffers[chunk.toolCall.id!] ||
            (Object.keys(mergedArguments).length > 0 ? JSON.stringify(mergedArguments) : '')

          setPending(
            currentState,
            {
              ...pending,
              toolCallBuffers: {
                ...pending.toolCallBuffers,
                [chunk.toolCall.id!]: nextBuffer
              },
              toolCalls: [
                ...pending.toolCalls.filter((toolCall) => toolCall.id !== chunk.toolCall!.id),
                {
                  id: chunk.toolCall.id!,
                  name: chunk.toolCall.name!,
                  arguments: mergedArguments
                }
              ]
            },
            { streamingByThreadId: { ...currentState.streamingByThreadId, [threadId]: true } }
          )
        }
        break
      }
      case 'tool_call_delta': {
        const pending = pendingOrSeed()
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

        setPending(
          currentState,
          {
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
          { streamingByThreadId: { ...currentState.streamingByThreadId, [threadId]: true } }
        )
        break
      }
      case 'tool_result': {
        const pending = currentState.pendingByThreadId[threadId]
        if (pending && chunk.toolResult) {
          const nextToolResults = pending.toolResults.some(
            (toolResult) => toolResult.toolCallId === chunk.toolResult!.toolCallId
          )
            ? pending.toolResults.map((toolResult) =>
                toolResult.toolCallId === chunk.toolResult!.toolCallId
                  ? chunk.toolResult!
                  : toolResult
              )
            : [...pending.toolResults, chunk.toolResult]

          setPending(currentState, {
            ...pending,
            toolResults: nextToolResults
          })
        }
        break
      }
      case 'done': {
        commitPending(currentState)
        set((s) => ({
          streamingByThreadId: omitKey(s.streamingByThreadId, threadId),
          streamingStartedAtByThreadId: omitKey(s.streamingStartedAtByThreadId, threadId)
        }))
        break
      }
      case 'error': {
        const pending = pendingOrSeed()
        setPending(
          currentState,
          {
            ...pending,
            content: pending.content + `\n\nError: ${chunk.error}`
          },
          {
            streamingByThreadId: omitKey(currentState.streamingByThreadId, threadId),
            streamingStartedAtByThreadId: omitKey(
              currentState.streamingStartedAtByThreadId,
              threadId
            )
          }
        )
        break
      }
    }
  },

  clearPendingMessage: (threadId) =>
    set((s) => ({ pendingByThreadId: omitKey(s.pendingByThreadId, threadId) }))
}))
