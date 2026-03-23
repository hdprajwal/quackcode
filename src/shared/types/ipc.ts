import type { SendMessageParams, StreamChunk, AIModel, AIProvider } from './ai'
import type { Thread, Message, CreateThreadParams } from './thread'
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

// Invoke channels (renderer -> main, returns a value)
export interface InvokeChannels {
  // Thread
  'thread:create': (params: CreateThreadParams) => Thread
  'thread:list': (projectId: string) => Thread[]
  'thread:get': (threadId: string) => Thread | null
  'thread:delete': (threadId: string) => void
  'thread:updateTitle': (params: { threadId: string; title: string }) => void

  // Messages
  'message:list': (threadId: string) => Message[]

  // AI
  'ai:send': (params: SendMessageParams) => void
  'ai:cancel': (threadId: string) => void
  'ai:models': () => Promise<AIModel[]>
  'ai:verifyKey': (params: { provider: AIProvider; apiKey: string }) => Promise<boolean>

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

  // Claude Pro (via Claude Code credentials)
  'auth:claudePro:connect': () => { success: boolean; subscriptionType?: string; error?: string }
  'auth:claudePro:verify': () => boolean
  'auth:claudePro:logout': () => void
}

// Push channels (main -> renderer)
export interface PushChannels {
  'ai:stream': StreamChunk
}

// Channel name types
export type InvokeChannel = keyof InvokeChannels
export type PushChannel = keyof PushChannels
