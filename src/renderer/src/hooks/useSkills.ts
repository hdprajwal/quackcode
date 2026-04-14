import { useCallback, useEffect } from 'react'
import { invoke, on } from '@renderer/lib/ipc'
import { useSkillsStore } from '@renderer/stores/skills.store'
import type {
  InstalledSkill,
  SkillDetails,
  SkillEvent,
  SkillInstallParams,
  SkillListing,
  SkillUninstallParams
} from '@shared/types'

export function useSkills(): {
  loadInstalled: () => Promise<void>
  search: (query: string) => Promise<void>
  getDetails: (params: { source: string; skillId: string }) => Promise<SkillDetails>
  getLocalDetails: (params: { path: string; skillId: string }) => Promise<SkillDetails>
  installSkill: (params: SkillInstallParams) => Promise<InstalledSkill>
  uninstallSkill: (params: SkillUninstallParams) => Promise<void>
} {
  const {
    setInstalled,
    upsertInstalled,
    removeInstalled,
    setSearchResults,
    setSearching,
    setSearchError
  } = useSkillsStore()

  useEffect(() => {
    const cleanup = on('skills:event', (payload: unknown) => {
      const event = payload as SkillEvent
      if (event.type === 'skill:installed') {
        upsertInstalled(event.skill)
      } else if (event.type === 'skill:uninstalled') {
        removeInstalled(event.skillId)
      }
    })
    return cleanup
  }, [upsertInstalled, removeInstalled])

  const loadInstalled = useCallback(async () => {
    const skills = await invoke<InstalledSkill[]>('skills:listInstalled')
    setInstalled(skills)
  }, [setInstalled])

  const search = useCallback(
    async (query: string) => {
      const trimmed = query.trim()
      if (trimmed.length < 2) {
        setSearchResults([])
        setSearchError(null)
        return
      }

      setSearching(true)
      setSearchError(null)
      try {
        const results = await invoke<SkillListing[]>('skills:search', { query: trimmed })
        setSearchResults(results)
      } catch (error) {
        setSearchResults([])
        setSearchError(error instanceof Error ? error.message : 'Failed to search skills.')
      } finally {
        setSearching(false)
      }
    },
    [setSearchResults, setSearching, setSearchError]
  )

  const getDetails = useCallback((params: { source: string; skillId: string }) => {
    return invoke<SkillDetails>('skills:details', params)
  }, [])

  const getLocalDetails = useCallback((params: { path: string; skillId: string }) => {
    return invoke<SkillDetails>('skills:localDetails', params)
  }, [])

  const installSkill = useCallback(
    async (params: SkillInstallParams) => {
      const installed = await invoke<InstalledSkill>('skills:install', params)
      upsertInstalled(installed)
      return installed
    },
    [upsertInstalled]
  )

  const uninstallSkill = useCallback(
    async (params: SkillUninstallParams) => {
      await invoke('skills:uninstall', params)
      if (!params.agents || params.agents.length === 0) {
        removeInstalled(params.skillId)
      }
    },
    [removeInstalled]
  )

  return { loadInstalled, search, getDetails, getLocalDetails, installSkill, uninstallSkill }
}
