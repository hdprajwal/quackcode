import type { AIProvider, ToolCall, ToolResult } from './ai'

export type ThreadStatus = 'idle' | 'running' | 'completed' | 'error'

export interface Thread {
  id: string
  title: string
  projectId: string
  provider: AIProvider
  model: string
  status: ThreadStatus
  archivedAt: string | null
  sortOrder: number
  lastActivityAt: string
  latestTurnId: string | null
  hasPendingApproval: boolean
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

export type ThreadEventTone = 'info' | 'tool' | 'approval' | 'error'

export type ThreadEventKind =
  | 'turn.started'
  | 'turn.completed'
  | 'turn.error'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'approval.requested'
  | 'approval.resolved'
  | 'runtime.error'
  | 'runtime.warning'
  | 'note'

export interface ThreadEvent {
  id: string
  threadId: string
  turnId: string | null
  sequence: number
  kind: ThreadEventKind
  tone: ThreadEventTone
  summary: string
  payload: Record<string, unknown> | null
  createdAt: string
}

export interface AppendThreadEventParams {
  threadId: string
  turnId?: string | null
  kind: ThreadEventKind
  tone: ThreadEventTone
  summary: string
  payload?: Record<string, unknown> | null
}

export interface ThreadReorderEntry {
  threadId: string
  sortOrder: number
}

export interface ThreadEventNotification {
  type: 'thread-event:new'
  event: ThreadEvent
  thread: Thread
}
