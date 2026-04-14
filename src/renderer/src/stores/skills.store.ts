import { create } from 'zustand'
import type { InstalledSkill, SkillListing } from '@shared/types'

export type SkillsTab = 'installed' | 'browse'

interface SkillsStore {
  installed: InstalledSkill[]
  searchResults: SkillListing[]
  searchQuery: string
  searching: boolean
  searchError: string | null
  activeTab: SkillsTab
  selectedKey: string | null

  setInstalled: (skills: InstalledSkill[]) => void
  upsertInstalled: (skill: InstalledSkill) => void
  removeInstalled: (skillId: string) => void

  setSearchResults: (results: SkillListing[]) => void
  setSearchQuery: (query: string) => void
  setSearching: (searching: boolean) => void
  setSearchError: (error: string | null) => void

  setActiveTab: (tab: SkillsTab) => void
  setSelectedKey: (key: string | null) => void
}

export const useSkillsStore = create<SkillsStore>((set) => ({
  installed: [],
  searchResults: [],
  searchQuery: '',
  searching: false,
  searchError: null,
  activeTab: 'installed',
  selectedKey: null,

  setInstalled: (installed) => set({ installed }),
  upsertInstalled: (skill) =>
    set((s) => {
      const existing = s.installed.some((entry) => entry.skillId === skill.skillId)
      return {
        installed: existing
          ? s.installed.map((entry) => (entry.skillId === skill.skillId ? skill : entry))
          : [...s.installed, skill].sort((a, b) => a.name.localeCompare(b.name))
      }
    }),
  removeInstalled: (skillId) =>
    set((s) => ({
      installed: s.installed.filter((entry) => entry.skillId !== skillId)
    })),

  setSearchResults: (searchResults) => set({ searchResults }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearching: (searching) => set({ searching }),
  setSearchError: (searchError) => set({ searchError }),

  setActiveTab: (activeTab) => set({ activeTab }),
  setSelectedKey: (selectedKey) => set({ selectedKey })
}))
