import type { SendMessageParams, StreamChunk, AIModel, AIProvider } from './ai'
import type {
  Thread,
  Message,
  CreateThreadParams,
  ThreadEvent,
  ThreadReorderEntry,
  ThreadEventNotification
} from './thread'
import type {
  FileReadResult,
  FileWriteParams,
  FileEditParams,
  FileEntry,
  ListDirectoryParams,
  SearchFilesParams,
  SearchResult
} from './filesystem'
import type { GitStatus, GitDiff, GitCommitParams, GitWorktreeParams, GitWorktreeInfo } from './git'
import type { AppSettings, ProviderConfig } from './settings'
import type { Project } from './project'
import type {
  Automation,
  AutomationExecution,
  AutomationEvent,
  CreateAutomationParams,
  UpdateAutomationParams
} from './automation'

// Invoke channels (renderer -> main, returns a value)
export interface InvokeChannels {
  // Thread
  'thread:create': (params: CreateThreadParams) => Thread
  'thread:list': (projectId: string) => Thread[]
  'thread:listAll': () => Thread[]
  'thread:get': (threadId: string) => Thread | null
  'thread:delete': (threadId: string) => void
  'thread:deleteMany': (threadIds: string[]) => void
  'thread:updateTitle': (params: { threadId: string; title: string }) => void
  'thread:archive': (threadId: string) => void
  'thread:unarchive': (threadId: string) => void
  'thread:archiveMany': (threadIds: string[]) => void
  'thread:reorder': (entries: ThreadReorderEntry[]) => void

  // Thread events
  'thread-event:list': (threadId: string) => ThreadEvent[]

  // Messages
  'message:list': (threadId: string) => Message[]

  // AI
  'ai:send': (params: SendMessageParams) => void
  'ai:cancel': (threadId: string) => void
  'ai:models': () => AIModel[]
  'ai:verifyKey': (params: { provider: AIProvider; apiKey: string }) => boolean

  // Filesystem
  'fs:read': (params: { path: string; projectPath: string }) => FileReadResult
  'fs:write': (params: FileWriteParams) => void
  'fs:edit': (params: FileEditParams) => void
  'fs:list': (params: ListDirectoryParams) => FileEntry[]
  'fs:search': (params: SearchFilesParams) => SearchResult[]

  // Git
  'git:status': (projectPath: string) => GitStatus
  'git:diff': (projectPath: string) => GitDiff
  'git:commit': (params: GitCommitParams) => string
  'git:worktree:create': (params: GitWorktreeParams) => GitWorktreeInfo
  'git:worktree:remove': (worktreePath: string) => void
  'git:worktree:list': (projectPath: string) => GitWorktreeInfo[]

  // Project
  'project:select': () => Project | null
  'project:list': () => Project[]
  'project:open': (projectId: string) => Project | null
  'project:delete': (projectId: string) => void

  // Settings
  'settings:get': () => AppSettings
  'settings:set': (settings: Partial<AppSettings>) => void
  'settings:getProvider': (provider: AIProvider) => ProviderConfig
  'settings:setProvider': (params: {
    provider: AIProvider
    config: Partial<ProviderConfig>
  }) => void

  // Claude Code CLI status
  'auth:claudeCli:status': () => {
    installed: boolean
    executablePath: string | null
    version: string | null
    auth: 'ready' | 'unauthenticated' | 'unknown'
    subscriptionType: string | null
    message: string
  }

  // Automations
  'automation:list': (projectId: string) => Automation[]
  'automation:listAll': () => Automation[]
  'automation:get': (automationId: string) => Automation | null
  'automation:create': (params: CreateAutomationParams) => Automation
  'automation:update': (params: UpdateAutomationParams) => Automation
  'automation:delete': (automationId: string) => void
  'automation:execute': (automationId: string) => AutomationExecution
  'automation:executions': (automationId: string) => AutomationExecution[]
}

// Push channels (main -> renderer)
export interface PushChannels {
  'ai:stream': StreamChunk
  'automation:event': AutomationEvent
  'thread:update': Thread
  'thread-event:new': ThreadEventNotification
}

// Channel name types
export type InvokeChannel = keyof InvokeChannels
export type PushChannel = keyof PushChannels
