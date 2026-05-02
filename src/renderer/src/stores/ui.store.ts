import { create } from 'zustand'

export type ActiveView = 'chat' | 'automations' | 'skills'

interface UIStore {
  sidebarOpen: boolean
  settingsOpen: boolean
  activeView: ActiveView

  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setActiveView: (view: ActiveView) => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  settingsOpen: false,
  activeView: 'chat',

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setActiveView: (view) => set({ activeView: view })
}))
