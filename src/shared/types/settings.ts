import type { AIProvider } from './ai'

export interface ProviderConfig {
  apiKey: string
  baseUrl?: string
  enabled: boolean
}

export type EditorId = 'zed' | 'vscode' | 'cursor' | 'nvim'

export interface EditorInfo {
  id: EditorId
  name: string
  available: boolean
}

export interface AppSettings {
  providers: Record<AIProvider, ProviderConfig>
  defaultProvider: AIProvider
  defaultModel: string
  theme: 'dark' | 'light' | 'system'
  defaultEditor: EditorId
}

export const DEFAULT_SETTINGS: AppSettings = {
  providers: {
    anthropic: { apiKey: '', enabled: true },
    openai: { apiKey: '', enabled: false },
    gemini: { apiKey: '', enabled: false },
    opencode: { apiKey: '', enabled: false },
    cursor: { apiKey: '', enabled: false }
  },
  defaultProvider: 'anthropic',
  defaultModel: 'claude-sonnet-4-6',
  theme: 'dark',
  defaultEditor: 'zed'
}
