import type { AIModel, AIProvider } from '@shared/types'
import type { AIProviderInterface } from './provider.interface'
import { anthropicProvider, AnthropicProvider } from './anthropic.provider'
import { geminiProvider } from './gemini.provider'
import { opencodeProvider } from './opencode.provider'
import { openaiProvider } from './openai.provider'
import { settingsService } from '../settings.service'
import { readClaudeCodeToken, isTokenExpired } from './claude-credentials'

export class AIService {
  private providers: Record<AIProvider, AIProviderInterface> = {
    anthropic: anthropicProvider,
    openai: openaiProvider,
    gemini: geminiProvider,
    opencode: opencodeProvider
  }

  getProvider(provider: AIProvider): AIProviderInterface {
    const p = this.providers[provider]
    if (!p) throw new Error(`Unknown provider: ${provider}`)

    if (provider === 'anthropic' && p instanceof AnthropicProvider) {
      const config = settingsService.getProvider('anthropic')
      if (config.authMode === 'claudePro') {
        const token = readClaudeCodeToken()
        if (!token)
          throw new Error('Claude Code credentials not found. Open Claude Code to sign in.')
        if (isTokenExpired(token.expiresAt))
          throw new Error('Claude Code session expired. Open Claude Code to refresh.')
        p.setAuthToken(token.accessToken)
      } else if (config.apiKey) {
        p.setApiKey(config.apiKey)
      }
    } else {
      const apiKey = settingsService.getApiKey(provider)
      if (apiKey) {
        p.setApiKey(apiKey)
      }
    }

    return p
  }

  listAllModels(): AIModel[] {
    const models: AIModel[] = []
    for (const [providerId, provider] of Object.entries(this.providers) as Array<
      [AIProvider, AIProviderInterface]
    >) {
      this.configureProviderForModelListing(providerId, provider)
      models.push(...provider.listModels())
    }
    return models
  }

  private configureProviderForModelListing(
    providerId: AIProvider,
    provider: AIProviderInterface
  ): void {
    if (providerId === 'anthropic' && provider instanceof AnthropicProvider) {
      const config = settingsService.getProvider('anthropic')
      if (config.authMode === 'claudePro') {
        const token = readClaudeCodeToken()
        if (token && !isTokenExpired(token.expiresAt)) {
          provider.setAuthToken(token.accessToken)
        }
        return
      }
    }

    provider.setApiKey(settingsService.getApiKey(providerId))
  }

  async verifyApiKey(provider: AIProvider, apiKey: string): Promise<boolean> {
    const p = this.providers[provider]
    if (!p) return false
    return p.verifyApiKey(apiKey)
  }

  disposeThread(threadId: string): void {
    for (const provider of Object.values(this.providers)) {
      provider.disposeThread?.(threadId)
    }
  }
}

export const aiService = new AIService()
