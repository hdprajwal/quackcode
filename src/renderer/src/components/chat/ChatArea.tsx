import { useCallback } from 'react'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton
} from '@renderer/components/ai-elements/conversation'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { useChat } from '@renderer/hooks/useChat'
import { useThread } from '@renderer/hooks/useThread'
import { NewThreadView } from './NewThreadView'
import { ChatInput } from './ChatInput'
import { EmptyState } from './EmptyState'
import { MessageList } from './MessageList'

export function ChatArea(): React.JSX.Element {
  const activeThreadId = useThreadStore((s) => s.activeThreadId)
  const messages = useThreadStore((s) => s.messages)
  const pendingMessage = useThreadStore((s) => s.pendingMessage)
  const project = useProjectStore((s) => s.project)
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

  if (!hasMessages) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <EmptyState onSuggestion={handleSend} />
        <div className="mx-auto w-full max-w-3xl">
          <ChatInput onSend={handleSend} onCancel={cancelStream} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Conversation>
        <ConversationContent className="mx-auto max-w-3xl gap-0 p-4">
          <MessageList />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl">
        <ChatInput onSend={handleSend} onCancel={cancelStream} />
      </div>
    </div>
  )
}
