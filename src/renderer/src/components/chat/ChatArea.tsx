import { useCallback, useMemo } from 'react'
import {
  Conversation,
  ConversationScrollButton
} from '@renderer/components/ai-elements/conversation'
import {
  useThreadStore,
  selectMessagesForThread,
  selectPendingForThread
} from '@renderer/stores/thread.store'
import { useChat } from '@renderer/hooks/useChat'
import { useThread } from '@renderer/hooks/useThread'
import { NewThreadView } from './NewThreadView'
import { ChatInput } from './ChatInput'
import { EmptyState } from './EmptyState'
import { MessageList } from './MessageList'
import { ThreadActivityPanel } from './ThreadActivityPanel'

export function ChatArea(): React.JSX.Element {
  const activeThreadId = useThreadStore((s) => s.activeThreadId)
  const messagesSelector = useMemo(() => selectMessagesForThread(activeThreadId), [activeThreadId])
  const pendingSelector = useMemo(() => selectPendingForThread(activeThreadId), [activeThreadId])
  const messages = useThreadStore(messagesSelector)
  const pendingMessage = useThreadStore(pendingSelector)
  const { sendMessage, cancelStream } = useChat()
  const { createThread } = useThread()

  const handleSend = useCallback(
    async (content: string) => {
      let threadId = activeThreadId
      if (!threadId) {
        const thread = await createThread()
        if (!thread) return
        threadId = thread.id
      }
      sendMessage(content)
    },
    [activeThreadId, sendMessage, createThread]
  )

  const hasMessages = messages.length > 0 || pendingMessage !== null

  if (!activeThreadId) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <NewThreadView />
        <div className="mx-auto w-full max-w-3xl">
          <ChatInput onSend={handleSend} onCancel={cancelStream} />
        </div>
      </div>
    )
  }

  // Conversation stays mounted for the whole lifetime of an active thread so the
  // scroll container's ref is stable. MessageList / EmptyState toggle inside it.
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ThreadActivityPanel />
      <Conversation>
        {hasMessages ? <MessageList key={activeThreadId} /> : <EmptyState onSuggestion={handleSend} />}
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl">
        <ChatInput onSend={handleSend} onCancel={cancelStream} />
      </div>
    </div>
  )
}
