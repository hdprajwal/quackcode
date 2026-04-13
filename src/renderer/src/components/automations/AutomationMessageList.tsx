import {
  Message as ChatMessage,
  MessageContent,
  MessageResponse
} from '@renderer/components/ai-elements/message'
import { ToolCallMessage } from '@renderer/components/chat/ToolCallMessage'
import type { Message as ThreadMessage } from '@shared/types'

export function AutomationMessageList({
  messages
}: {
  messages: ThreadMessage[]
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6 p-6 pb-10">
      {messages.map((message) => {
        if (message.role === 'user') {
          return (
            <ChatMessage key={message.id} from="user">
              <MessageContent>{message.content}</MessageContent>
            </ChatMessage>
          )
        }

        if (message.role === 'assistant') {
          const hasToolCalls = Boolean(message.toolCalls && message.toolCalls.length > 0)

          return (
            <ChatMessage
              key={message.id}
              from="assistant"
              className={hasToolCalls ? 'max-w-full' : undefined}
            >
              {hasToolCalls ? (
                <ToolCallMessage
                  toolCalls={message.toolCalls || []}
                  toolResults={message.toolResults || []}
                />
              ) : null}
              {message.content ? (
                <MessageContent>
                  <MessageResponse>{message.content}</MessageResponse>
                </MessageContent>
              ) : null}
            </ChatMessage>
          )
        }

        if (message.role === 'tool' && message.toolResults) {
          return (
            <div key={message.id} className="w-full">
              <ToolCallMessage toolCalls={[]} toolResults={message.toolResults} />
            </div>
          )
        }

        return null
      })}
    </div>
  )
}
