import type { AIProvider } from './ai'

export type AnthropicAuthMode = 'apiKey' | 'claudePro'

export interface ProviderConfig {
  apiKey: string
  baseUrl?: string
  enabled: boolean
  authMode?: AnthropicAuthMode
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
    gemini: { apiKey: '', enabled: false }
  },
  defaultProvider: 'anthropic',
  defaultModel: 'claude-sonnet-4-20250514',
  theme: 'dark',
  defaultEditor: 'zed'
}
