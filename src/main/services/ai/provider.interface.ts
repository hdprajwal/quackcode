import type { AIModel, AIProvider, ToolDefinition } from '@shared/types'

export interface StreamCallbacks {
  onText: (text: string) => void
  onToolCall: (id: string, name: string, args: Record<string, unknown>) => void
  onToolCallDelta: (id: string, argsDelta: string) => void
  onError: (error: string) => void
  onDone: () => void
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolCalls?: Array<{
    id: string
    name: string
    arguments: Record<string, unknown>
    /** Gemini-specific: thought signature required when replaying function calls in multi-turn */
    thoughtSignature?: string
  }>
}

export interface AIProviderInterface {
  readonly provider: AIProvider

  setApiKey(apiKey: string): void

  listModels(): AIModel[]

  sendMessage(
    messages: ChatMessage[],
    model: string,
    tools: ToolDefinition[],
    systemPrompt: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
    context?: {
      threadId?: string
      cwd?: string
    }
  ): Promise<ChatMessage | null>

  verifyApiKey(apiKey: string): Promise<boolean>

  disposeThread?(threadId: string): Promise<void> | void
}
