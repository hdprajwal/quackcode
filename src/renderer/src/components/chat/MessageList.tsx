import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useThreadStore,
  selectMessagesForThread,
  selectPendingForThread,
  selectIsStreamingForThread,
  selectStreamingStartedAtForThread
} from '@renderer/stores/thread.store'
import { useConversation } from '@renderer/components/ai-elements/conversation'
import { ToolCallMessage } from './ToolCallMessage'
import { WorkingIndicator } from './WorkingIndicator'
import { Message, MessageContent, MessageResponse } from '@renderer/components/ai-elements/message'
import { isNearBottom } from '@renderer/lib/chat-scroll'
import type { Message as ChatMessage, ToolCall, ToolResult } from '@shared/types'

const ALWAYS_UNVIRTUALIZED_TAIL = 8
const ESTIMATED_ROW_HEIGHT = 120
const OVERSCAN = 8

type Row =
  | { kind: 'message'; key: string; msg: ChatMessage }
  | {
      kind: 'pending'
      key: string
      content: string
      toolCalls: ToolCall[]
      toolResults: ToolResult[]
      toolCallBuffers: Record<string, string>
    }
  | { kind: 'working'; key: string; startedAt: number }

function MessageRow({ msg }: { msg: ChatMessage }): React.JSX.Element | null {
  if (msg.role === 'user') {
    return (
      <Message from="user">
        <MessageContent>{msg.content}</MessageContent>
      </Message>
    )
  }
  if (msg.role === 'assistant') {
    const hasToolCalls = msg.toolCalls && msg.toolCalls.length > 0
    return (
      <Message from="assistant" className={hasToolCalls ? 'max-w-full' : undefined}>
        {hasToolCalls && (
          <ToolCallMessage toolCalls={msg.toolCalls!} toolResults={msg.toolResults || []} />
        )}
        {msg.content && (
          <MessageContent>
            <MessageResponse>{msg.content}</MessageResponse>
          </MessageContent>
        )}
      </Message>
    )
  }
  if (msg.role === 'tool' && msg.toolResults) {
    return (
      <div className="w-full">
        <ToolCallMessage toolCalls={[]} toolResults={msg.toolResults} />
      </div>
    )
  }
  return null
}

const MemoMessageRow = memo(MessageRow, (a, b) => a.msg === b.msg)

function PendingRow({
  content,
  toolCalls,
  toolResults,
  toolCallBuffers
}: {
  content: string
  toolCalls: ToolCall[]
  toolResults: ToolResult[]
  toolCallBuffers: Record<string, string>
}): React.JSX.Element {
  return (
    <Message from="assistant" className={toolCalls.length > 0 ? 'max-w-full' : undefined}>
      {toolCalls.length > 0 && (
        <ToolCallMessage
          toolCalls={toolCalls}
          toolResults={toolResults}
          toolCallBuffers={toolCallBuffers}
        />
      )}
      {content && (
        <MessageContent>
          <MessageResponse>{content}</MessageResponse>
        </MessageContent>
      )}
    </Message>
  )
}

export function MessageList(): React.JSX.Element {
  const activeThreadId = useThreadStore((s) => s.activeThreadId)
  const messagesSelector = useMemo(() => selectMessagesForThread(activeThreadId), [activeThreadId])
  const pendingSelector = useMemo(() => selectPendingForThread(activeThreadId), [activeThreadId])
  const streamingSelector = useMemo(
    () => selectIsStreamingForThread(activeThreadId),
    [activeThreadId]
  )
  const startedAtSelector = useMemo(
    () => selectStreamingStartedAtForThread(activeThreadId),
    [activeThreadId]
  )
  const messages = useThreadStore(messagesSelector) as ChatMessage[]
  const pendingMessage = useThreadStore(pendingSelector)
  const isStreaming = useThreadStore(streamingSelector)
  const streamingStartedAt = useThreadStore(startedAtSelector)

  const { scrollRef } = useConversation()

  // Stable identity of the row stream — recompute only when source data changes.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    // Persistence stores tool results on a separate role='tool' message. Merge them
    // back onto the preceding assistant message so the UI can pair each call with
    // its result (and stop the spinner).
    const mergedMessages: ChatMessage[] = []
    for (const msg of messages) {
      if (msg.role === 'tool' && msg.toolResults?.length) {
        const ids = new Set(msg.toolResults.map((r) => r.toolCallId))
        let absorbed = false
        for (let i = mergedMessages.length - 1; i >= 0; i--) {
          const prev = mergedMessages[i]
          if (prev.role === 'user') break
          if (prev.role === 'assistant' && prev.toolCalls?.some((tc) => ids.has(tc.id))) {
            mergedMessages[i] = {
              ...prev,
              toolResults: [...(prev.toolResults ?? []), ...msg.toolResults]
            }
            absorbed = true
            break
          }
        }
        if (absorbed) continue
      }
      mergedMessages.push(msg)
    }
    for (const msg of mergedMessages) out.push({ kind: 'message', key: msg.id, msg })
    if (pendingMessage) {
      out.push({
        kind: 'pending',
        key: `pending:${pendingMessage.id}`,
        content: pendingMessage.content,
        toolCalls: pendingMessage.toolCalls,
        toolResults: pendingMessage.toolResults,
        toolCallBuffers: pendingMessage.toolCallBuffers
      })
    }
    if (isStreaming) {
      out.push({
        kind: 'working',
        key: 'working',
        startedAt: streamingStartedAt ?? Date.now()
      })
    }
    return out
  }, [messages, pendingMessage, isStreaming, streamingStartedAt])

  // Always keep the last N rows out of the virtualizer so the streaming tail never unmounts.
  const tailStart = Math.max(rows.length - ALWAYS_UNVIRTUALIZED_TAIL, 0)
  const virtualizedCount = tailStart
  const tailRows = rows.slice(tailStart)

  // "Was the user near the bottom right before the latest update?" — sampled before commit.
  const wasNearBottomRef = useRef(true)
  const lastMessageCountRef = useRef(messages.length)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const sample = (): void => {
      wasNearBottomRef.current = isNearBottom(el)
    }
    sample()
    el.addEventListener('scroll', sample, { passive: true })
    return () => el.removeEventListener('scroll', sample)
  }, [scrollRef])

  const rowVirtualizer = useVirtualizer({
    count: virtualizedCount,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => rows[index]?.key ?? `idx:${index}`,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN
  })

  // Thread-open pin. Fires once per MessageList mount. Because ChatArea keys
  // this component on activeThreadId, "open thread" and "switch thread" are
  // both just mounts from this component's perspective. We schedule a pin on
  // the next frame (so the initial layout has a chance to settle), then re-pin
  // 96ms later if we still aren't at the bottom — covers late-measuring code
  // blocks, markdown, etc. User-initiated scroll (detected via the sample
  // listener above) cancels subsequent pins.
  useLayoutEffect(() => {
    let raf1: number | null = null
    let raf2: number | null = null
    let timeout: number | null = null
    let cancelled = false

    const pin = (): void => {
      if (cancelled) return
      const el = scrollRef.current
      if (!el) return
      el.scrollTop = el.scrollHeight
    }

    raf1 = requestAnimationFrame(() => {
      pin()
      raf2 = requestAnimationFrame(pin)
    })

    timeout = window.setTimeout(() => {
      const el = scrollRef.current
      if (!el || cancelled) return
      if (!isNearBottom(el)) pin()
    }, 96)

    return () => {
      cancelled = true
      if (raf1 !== null) cancelAnimationFrame(raf1)
      if (raf2 !== null) cancelAnimationFrame(raf2)
      if (timeout !== null) clearTimeout(timeout)
    }
    // Fire only on mount — re-open / thread-switch triggers a remount via the parent's key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Same-thread append pin. When the user sends a message or the assistant
  // streams more content and we were near the bottom, keep the bottom pinned.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const grewByOneUserMessage =
      messages.length === lastMessageCountRef.current + 1 &&
      messages[messages.length - 1]?.role === 'user'
    lastMessageCountRef.current = messages.length

    if (grewByOneUserMessage) {
      requestAnimationFrame(() => {
        const el2 = scrollRef.current
        if (el2) el2.scrollTop = el2.scrollHeight
      })
      return
    }

    if (pendingMessage && wasNearBottomRef.current) {
      requestAnimationFrame(() => {
        const el2 = scrollRef.current
        if (el2) el2.scrollTop = el2.scrollHeight
      })
    }
  }, [messages, pendingMessage, scrollRef])

  const renderRow = useCallback((row: Row): React.JSX.Element | null => {
    if (row.kind === 'message') return <MemoMessageRow msg={row.msg} />
    if (row.kind === 'pending') {
      return (
        <PendingRow
          content={row.content}
          toolCalls={row.toolCalls}
          toolResults={row.toolResults}
          toolCallBuffers={row.toolCallBuffers}
        />
      )
    }
    return (
      <div className="px-1">
        <WorkingIndicator startedAt={row.startedAt} />
      </div>
    )
  }, [])

  const virtualRows = rowVirtualizer.getVirtualItems()

  return (
    // min-h-full + flex-col + justify-end: when content is shorter than the
    // scroll viewport, it sticks to the bottom so the latest message is visible;
    // when content overflows, this degenerates into a normal scroll.
    <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end">
      <div
        className="relative w-full"
        style={{ height: virtualizedCount > 0 ? `${rowVirtualizer.getTotalSize()}px` : undefined }}
      >
        {virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index]
          if (!row) return null
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute left-0 right-0 px-4"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <div className="pb-6">{renderRow(row)}</div>
            </div>
          )
        })}
      </div>
      {/* Unvirtualized tail — last few rows always live in the DOM so streaming never unmounts */}
      <div className="flex flex-col gap-6 px-4 pb-32">
        {tailRows.map((row) => (
          <div key={row.key} data-tail-row>
            {renderRow(row)}
          </div>
        ))}
      </div>
    </div>
  )
}
