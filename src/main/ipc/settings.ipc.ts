import { ipcMain } from 'electron'
import type { AIProvider, ProviderConfig } from '@shared/types'
import { settingsService } from '../services/settings.service'
import { readClaudeCodeToken, isTokenExpired } from '../services/ai/claude-credentials'
import { anthropicProvider } from '../services/ai/anthropic.provider'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => {
    return settingsService.getAll()
  })

  ipcMain.handle('settings:set', (_event, settings) => {
    settingsService.set(settings)
  })

  ipcMain.handle('settings:getProvider', (_event, provider: AIProvider) => {
    return settingsService.getProvider(provider)
  })

  ipcMain.handle(
    'settings:setProvider',
    (_event, params: { provider: AIProvider; config: Partial<ProviderConfig> }) => {
      settingsService.setProvider(params.provider, params.config)
    }
  )

  // Connect using Claude Code's locally stored credentials (~/.claude/.credentials.json)
  ipcMain.handle('auth:claudePro:connect', () => {
    const token = readClaudeCodeToken()

    if (!token) {
      return {
        success: false,
        error: 'Claude Code credentials not found. Sign in with Claude Code first.'
      }
    }

    if (isTokenExpired(token.expiresAt)) {
      return {
        success: false,
        error: 'Claude Code session is expired. Open Claude Code to refresh it, then try again.'
      }
    }

    settingsService.setProvider('anthropic', { authMode: 'claudePro', enabled: true })

    return { success: true, subscriptionType: token.subscriptionType }
  })

  // Test the current Claude Code credentials against the actual API
  ipcMain.handle('auth:claudePro:verify', async () => {
    const token = readClaudeCodeToken()
    if (!token || isTokenExpired(token.expiresAt)) return false
    anthropicProvider.setAuthToken(token.accessToken)
    return anthropicProvider.verifyApiKey('')
  })

  ipcMain.handle('auth:claudePro:logout', () => {
    settingsService.setProvider('anthropic', { authMode: 'apiKey' })
  })
}
