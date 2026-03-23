import type { AIProvider } from '@shared/types'

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
  cursor: 'Cursor',
  opencode: 'OpenCode'
}
