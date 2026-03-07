import { useThreadStore } from '@renderer/stores/thread.store'
import { ToolCallMessage } from './ToolCallMessage'
import { Shimmer } from '@renderer/components/ai-elements/shimmer'
import { Message, MessageContent, MessageResponse } from '@renderer/components/ai-elements/message'

export function MessageList(): React.JSX.Element {
  const messages = useThreadStore((s) => s.messages)
  const pendingMessage = useThreadStore((s) => s.pendingMessage)
  const isStreaming = useThreadStore((s) => s.isStreaming)

  return (
    <div className="flex flex-col gap-6 p-4 pb-32">
      {messages.map((msg) => {
        if (msg.role === 'user') {
          return (
            <Message key={msg.id} from="user">
              <MessageContent>{msg.content}</MessageContent>
            </Message>
          )
        }
        if (msg.role === 'assistant') {
          const hasToolCalls = msg.toolCalls && msg.toolCalls.length > 0
          return (
            <Message
              key={msg.id}
              from="assistant"
              className={hasToolCalls ? 'max-w-full' : undefined}
            >
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
            <div key={msg.id} className="w-full">
              <ToolCallMessage toolCalls={[]} toolResults={msg.toolResults} />
            </div>
          )
        }
        return null
      })}

      {/* Pending streaming message */}
      {pendingMessage && (
        <Message
          from="assistant"
          className={pendingMessage.toolCalls.length > 0 ? 'max-w-full' : undefined}
        >
          {pendingMessage.toolCalls.length > 0 && (
            <ToolCallMessage
              toolCalls={pendingMessage.toolCalls}
              toolResults={pendingMessage.toolResults}
            />
          )}
          {pendingMessage.content && (
            <MessageContent>
              <MessageResponse>{pendingMessage.content}</MessageResponse>
            </MessageContent>
          )}
        </Message>
      )}

      {/* Streaming indicator with shimmer */}
      {isStreaming && !pendingMessage?.content && pendingMessage?.toolCalls.length === 0 && (
        <Message from="assistant">
          <MessageContent>
            <Shimmer className="text-sm">Thinking...</Shimmer>
          </MessageContent>
        </Message>
      )}
    </div>
  )
}
