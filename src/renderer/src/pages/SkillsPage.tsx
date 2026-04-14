import { useCallback, useEffect, useMemo, useState } from 'react'
import { PanelLeft, Package } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { SkillDetails } from '@renderer/components/skills/SkillDetails'
import { SkillsEmptyState } from '@renderer/components/skills/SkillsEmptyState'
import { SkillsSidebar } from '@renderer/components/skills/SkillsSidebar'
import { useSkills } from '@renderer/hooks/useSkills'
import { useSkillsStore } from '@renderer/stores/skills.store'
import { useUIStore } from '@renderer/stores/ui.store'
import type { InstalledSkill, SkillDetails as SkillDetailsType, SkillListing } from '@shared/types'

type Selection =
  | { kind: 'installed'; skill: InstalledSkill }
  | { kind: 'listing'; listing: SkillListing }
  | null

export function SkillsPanel(): React.JSX.Element {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const {
    installed,
    searchResults,
    searchQuery,
    searching,
    searchError,
    activeTab,
    selectedKey,
    setSearchQuery,
    setActiveTab,
    setSelectedKey
  } = useSkillsStore()
  const { loadInstalled, search, getDetails, getLocalDetails, installSkill, uninstallSkill } =
    useSkills()

  const [selection, setSelection] = useState<Selection>(null)
  const [details, setDetails] = useState<SkillDetailsType | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [refreshingInstalled, setRefreshingInstalled] = useState(false)
  const [installedError, setInstalledError] = useState<string | null>(null)

  useEffect(() => {
    loadInstalled().catch((error) => {
      setInstalledError(
        error instanceof Error ? error.message : 'Failed to load installed skills.'
      )
    })
  }, [loadInstalled])

  const handleRefreshInstalled = async (): Promise<void> => {
    setRefreshingInstalled(true)
    setInstalledError(null)
    try {
      await loadInstalled()
    } catch (error) {
      setInstalledError(
        error instanceof Error ? error.message : 'Failed to load installed skills.'
      )
    } finally {
      setRefreshingInstalled(false)
    }
  }

  // Match installed skills by source+skillId so two listings sharing a name from
  // different repos don't both light up as "Installed". Skills installed outside
  // QuackCode (no recorded source) fall back to skillId-only matching.
  const installedMatchKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const skill of installed) {
      if (skill.source) keys.add(`${skill.source}/${skill.skillId}`)
      else keys.add(`*/${skill.skillId}`)
    }
    return keys
  }, [installed])

  const isListingInstalled = useCallback(
    (source: string, skillId: string) =>
      installedMatchKeys.has(`${source}/${skillId}`) || installedMatchKeys.has(`*/${skillId}`),
    [installedMatchKeys]
  )

  const installedBySkillId = useMemo(() => {
    const map = new Map<string, InstalledSkill>()
    for (const skill of installed) map.set(skill.skillId, skill)
    return map
  }, [installed])

  // Keep the selected entry consistent if the underlying data changes.
  useEffect(() => {
    if (!selection) return
    if (selection.kind === 'installed') {
      const latest = installedBySkillId.get(selection.skill.skillId)
      if (!latest) {
        setSelection(null)
        setSelectedKey(null)
        setDetails(null)
      } else if (latest !== selection.skill) {
        setSelection({ kind: 'installed', skill: latest })
      }
    }
  }, [installedBySkillId, selection, setSelectedKey])

  // Fetch SKILL.md details when a listing is selected or when an installed skill has a source.
  useEffect(() => {
    let cancelled = false

    // Clear previous payload synchronously so resolveInstallSource() and the
    // details view don't read stale data while the new fetch is in flight.
    setDetails(null)
    setDetailsError(null)

    async function loadDetails(): Promise<void> {
      if (!selection) return

      setDetailsLoading(true)
      try {
        const fetched =
          selection.kind === 'listing'
            ? await getDetails({
                source: selection.listing.source,
                skillId: selection.listing.skillId
              })
            : selection.skill.source
              ? await getDetails({
                  source: selection.skill.source,
                  skillId: selection.skill.skillId
                })
              : await getLocalDetails({
                  path: selection.skill.path,
                  skillId: selection.skill.skillId
                })
        if (!cancelled) setDetails(fetched)
      } catch (error) {
        if (!cancelled) {
          setDetails(null)
          setDetailsError(error instanceof Error ? error.message : 'Failed to load skill details.')
        }
      } finally {
        if (!cancelled) setDetailsLoading(false)
      }
    }

    void loadDetails()
    return () => {
      cancelled = true
    }
  }, [selection, getDetails, getLocalDetails])

  const handleSelectInstalled = (skill: InstalledSkill): void => {
    setSelection({ kind: 'installed', skill })
    setSelectedKey(`installed:${skill.skillId}`)
  }

  const handleSelectListing = (listing: SkillListing): void => {
    setSelection({ kind: 'listing', listing })
    setSelectedKey(`listing:${listing.id}`)
  }

  const handleTabChange = (tab: 'installed' | 'browse'): void => {
    setActiveTab(tab)
  }

  const resolveInstallSource = (): { source: string; skillId: string } | null => {
    if (!selection) return null
    if (selection.kind === 'listing') {
      return { source: selection.listing.source, skillId: selection.listing.skillId }
    }
    const source = selection.skill.source ?? details?.source ?? null
    if (!source) return null
    return { source, skillId: selection.skill.skillId }
  }

  const handleInstall = async (agents: string[]): Promise<void> => {
    const target = resolveInstallSource()
    if (!target) {
      setDetailsError('Cannot determine upstream source for this skill.')
      return
    }

    setWorking(true)
    try {
      const installedSkill = await installSkill({
        source: target.source,
        skillId: target.skillId,
        agents
      })
      setSelection({ kind: 'installed', skill: installedSkill })
      setSelectedKey(`installed:${installedSkill.skillId}`)
      setActiveTab('installed')
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : 'Failed to install skill.')
    } finally {
      setWorking(false)
    }
  }

  const handleUninstall = async (agents: string[] | null): Promise<void> => {
    if (!selection || selection.kind !== 'installed') return
    const skillId = selection.skill.skillId

    setWorking(true)
    try {
      await uninstallSkill({ skillId, agents: agents ?? undefined })
      if (agents === null) {
        setSelection(null)
        setSelectedKey(null)
        setDetails(null)
      }
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : 'Failed to uninstall skill.')
    } finally {
      setWorking(false)
    }
  }

  const installedForSelection =
    selection?.kind === 'installed'
      ? selection.skill
      : selection?.kind === 'listing'
        ? (installedBySkillId.get(selection.listing.skillId) ?? null)
        : null

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="drag-region flex h-12 items-center gap-2 border-b border-border px-3">
        <Button
          variant="ghost"
          size="icon"
          className="no-drag h-7 w-7"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Package className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Skills</span>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SkillsSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          installed={installed}
          searchResults={searchResults}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onRunSearch={(query) => void search(query)}
          searching={searching}
          searchError={searchError}
          selectedKey={selectedKey}
          isListingInstalled={isListingInstalled}
          onSelectInstalled={handleSelectInstalled}
          onSelectListing={handleSelectListing}
          onRefreshInstalled={() => void handleRefreshInstalled()}
          refreshing={refreshingInstalled}
          installedError={installedError}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {selection ? (
            <SkillDetails
              key={selectedKey ?? 'none'}
              details={details}
              installed={installedForSelection}
              loading={detailsLoading}
              error={detailsError}
              working={working}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
            />
          ) : (
            <SkillsEmptyState tab={activeTab} />
          )}
        </div>
      </div>
    </div>
  )
}
