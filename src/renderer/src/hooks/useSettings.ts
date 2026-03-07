import { useCallback } from 'react'
import { invoke } from '@renderer/lib/ipc'
import { useSettingsStore } from '@renderer/stores/settings.store'
import type { AppSettings, AIModel, AIProvider, ProviderConfig } from '@shared/types'

export function useSettings(): {
  loadSettings: () => Promise<void>
  loadModels: () => Promise<void>
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>
  updateProvider: (provider: AIProvider, config: Partial<ProviderConfig>) => Promise<void>
  verifyApiKey: (provider: AIProvider, apiKey: string) => Promise<boolean>
} {
  const { setSettings, hydrateSettings, setModels } = useSettingsStore()

  const loadSettings = useCallback(async () => {
    const settings = await invoke<AppSettings>('settings:get')
    hydrateSettings(settings)
  }, [hydrateSettings])

  const loadModels = useCallback(async () => {
    const models = await invoke<AIModel[]>('ai:models')
    setModels(models)
  }, [setModels])

  const updateSettings = useCallback(
    async (settings: Partial<AppSettings>) => {
      await invoke('settings:set', settings)
      const updated = await invoke<AppSettings>('settings:get')
      setSettings(updated)
    },
    [setSettings]
  )

  const updateProvider = useCallback(
    async (provider: AIProvider, config: Partial<ProviderConfig>) => {
      await invoke('settings:setProvider', { provider, config })
      const updated = await invoke<AppSettings>('settings:get')
      setSettings(updated)
    },
    [setSettings]
  )

  const verifyApiKey = useCallback(async (provider: AIProvider, apiKey: string) => {
    return invoke<boolean>('ai:verifyKey', { provider, apiKey })
  }, [])

  return { loadSettings, loadModels, updateSettings, updateProvider, verifyApiKey }
}
