import Store from 'electron-store'
import type { AIProvider, AppSettings, ProviderConfig, EditorId } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

const store = new Store<AppSettings>({
  name: 'settings',
  defaults: DEFAULT_SETTINGS,
  encryptionKey: 'quackcode-settings-v1'
})

export class SettingsService {
  private getProviders(): AppSettings['providers'] {
    const providers = store.get('providers') as Partial<AppSettings['providers']> | undefined
    return {
      ...DEFAULT_SETTINGS.providers,
      ...providers
    }
  }

  getAll(): AppSettings {
    return {
      providers: this.getProviders(),
      defaultProvider: store.get('defaultProvider', DEFAULT_SETTINGS.defaultProvider),
      defaultModel: store.get('defaultModel', DEFAULT_SETTINGS.defaultModel),
      theme: store.get('theme', DEFAULT_SETTINGS.theme),
      defaultEditor: store.get('defaultEditor', DEFAULT_SETTINGS.defaultEditor) as EditorId
    }
  }

  set(settings: Partial<AppSettings>): void {
    for (const [key, value] of Object.entries(settings)) {
      store.set(key as keyof AppSettings, value)
    }
  }

  getProvider(provider: AIProvider): ProviderConfig {
    const providers = this.getProviders()
    return providers[provider] || { apiKey: '', enabled: false }
  }

  setProvider(provider: AIProvider, config: Partial<ProviderConfig>): void {
    const providers = this.getProviders()
    const current = providers[provider] || { apiKey: '', enabled: false }
    providers[provider] = { ...current, ...config }
    store.set('providers', providers)
  }

  getApiKey(provider: AIProvider): string {
    return this.getProvider(provider).apiKey
  }
}

export const settingsService = new SettingsService()
