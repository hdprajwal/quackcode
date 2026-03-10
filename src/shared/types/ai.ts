export type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'opencode'

export interface AIModel {
  id: string
  name: string
  provider: AIProvider
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  content: string
  isError?: boolean
}

export interface StreamChunk {
  threadId: string
  messageId: string
  type: 'text_delta' | 'tool_call_start' | 'tool_call_delta' | 'tool_result' | 'done' | 'error'
  content?: string
  toolCall?: Partial<ToolCall>
  toolResult?: ToolResult
  error?: string
}

export interface SendMessageParams {
  threadId: string
  content: string
  provider: AIProvider
  model: string
  projectPath: string
  environmentMode: EnvironmentMode
  worktreePath?: string
}

export type EnvironmentMode = 'local' | 'worktree'
