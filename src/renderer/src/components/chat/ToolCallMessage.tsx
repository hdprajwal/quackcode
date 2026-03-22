import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
  type ToolState
} from '@renderer/components/ai-elements/tool'
import type { ToolCall, ToolResult } from '@shared/types'

interface ToolCallMessageProps {
  toolCalls: ToolCall[]
  toolResults: ToolResult[]
  toolCallBuffers?: Record<string, string>
}

function getToolInput(
  toolCall: ToolCall,
  toolCallBuffers?: Record<string, string>
): Record<string, unknown> | string {
  const buffer = toolCallBuffers?.[toolCall.id]
  if (!buffer) return toolCall.arguments

  try {
    return JSON.parse(buffer) as Record<string, unknown>
  } catch {
    return buffer
  }
}

export function ToolCallMessage({
  toolCalls,
  toolResults,
  toolCallBuffers
}: ToolCallMessageProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 w-full">
      {toolCalls.map((tc) => {
        const result = toolResults.find((r) => r.toolCallId === tc.id)
        const state: ToolState = result ? (result.isError ? 'error' : 'completed') : 'running'

        return (
          <Tool key={tc.id} className="mb-0">
            <ToolHeader toolName={tc.name} state={state} />
            <ToolContent>
              <ToolInput input={getToolInput(tc, toolCallBuffers)} />
              {result && (
                <ToolOutput
                  output={result.content}
                  errorText={result.isError ? result.content : undefined}
                />
              )}
            </ToolContent>
          </Tool>
        )
      })}
    </div>
  )
}
