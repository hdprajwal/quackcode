import type { AIProvider, ToolCall, ToolResult } from './ai'

export interface Thread {
  id: string
  title: string
  projectId: string
  provider: AIProvider
  model: string
  createdAt: string
  updatedAt: string
}

export type MessageRole = 'user' | 'assistant' | 'tool'

export interface Message {
  id: string
  threadId: string
  role: MessageRole
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  createdAt: string
}

export interface CreateThreadParams {
  projectId: string
  provider: AIProvider
  model: string
  title?: string
}

export interface CreateMessageParams {
  threadId: string
  role: MessageRole
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}
