import { ipcMain } from 'electron'
import type { AIProvider, ProviderConfig } from '@shared/types'
import { settingsService } from '../services/settings.service'
import { getClaudeCliStatus } from '../services/ai/claude-cli'

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

  // Report local Claude CLI install + auth status for the settings UI.
  ipcMain.handle('auth:claudeCli:status', () => {
    return getClaudeCliStatus()
  })
}
