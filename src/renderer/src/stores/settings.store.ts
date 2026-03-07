import { create } from 'zustand'
import type { AppSettings, AIModel, AIProvider } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

interface SettingsStore {
  settings: AppSettings
  models: AIModel[]
  selectedModel: string
  selectedProvider: AIProvider

  setSettings: (settings: AppSettings) => void
  hydrateSettings: (settings: AppSettings) => void
  setModels: (models: AIModel[]) => void
  setSelectedModel: (model: string) => void
  setSelectedProvider: (provider: AIProvider) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  models: [],
  selectedModel: DEFAULT_SETTINGS.defaultModel,
  selectedProvider: DEFAULT_SETTINGS.defaultProvider,

  setSettings: (settings) => set({ settings }),
  hydrateSettings: (settings) =>
    set({
      settings,
      selectedModel: settings.defaultModel,
      selectedProvider: settings.defaultProvider
    }),
  setModels: (models) => set({ models }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setSelectedProvider: (provider) => set({ selectedProvider: provider })
}))
