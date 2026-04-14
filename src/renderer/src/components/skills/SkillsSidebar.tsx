import { useCallback, useEffect, useRef } from 'react'
import { Download, Loader2, RefreshCw, Search } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { cn } from '@renderer/lib/utils'
import type { InstalledSkill, SkillListing } from '@shared/types'
import type { SkillsTab } from '@renderer/stores/skills.store'

interface SkillsSidebarProps {
  activeTab: SkillsTab
  onTabChange: (tab: SkillsTab) => void
  installed: InstalledSkill[]
  searchResults: SkillListing[]
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  onRunSearch: (query: string) => void
  searching: boolean
  searchError: string | null
  selectedKey: string | null
  isListingInstalled: (source: string, skillId: string) => boolean
  onSelectInstalled: (skill: InstalledSkill) => void
  onSelectListing: (listing: SkillListing) => void
  onRefreshInstalled: () => void
  refreshing: boolean
  installedError: string | null
}

function formatInstalls(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return String(count)
}

export function SkillsSidebar({
  activeTab,
  onTabChange,
  installed,
  searchResults,
  searchQuery,
  onSearchQueryChange,
  onRunSearch,
  searching,
  searchError,
  selectedKey,
  isListingInstalled,
  onSelectInstalled,
  onSelectListing,
  onRefreshInstalled,
  refreshing,
  installedError
}: SkillsSidebarProps): React.JSX.Element {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => onRunSearch(value), 300)
    },
    [onRunSearch]
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="flex h-full w-[320px] min-w-[320px] min-h-0 flex-col overflow-hidden border-r border-border bg-background/60">
      <div className="border-b border-border px-3 py-3">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Skills</div>
            <div className="text-xs text-muted-foreground">
              Manage Claude skills from the skills.sh directory
            </div>
          </div>
          {activeTab === 'installed' ? (
            <button
              type="button"
              onClick={onRefreshInstalled}
              disabled={refreshing}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:opacity-50"
              aria-label="Refresh installed skills"
              title="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </button>
          ) : null}
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-muted/60 p-1">
          <button
            type="button"
            onClick={() => onTabChange('installed')}
            className={cn(
              'inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors',
              activeTab === 'installed'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Installed
            {installed.length > 0 ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  activeTab === 'installed'
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted-foreground/15 text-muted-foreground'
                )}
              >
                {installed.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => onTabChange('browse')}
            className={cn(
              'inline-flex h-7 flex-1 items-center justify-center rounded-md text-xs font-medium transition-colors',
              activeTab === 'browse'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Browse
          </button>
        </div>
      </div>

      {activeTab === 'browse' ? (
        <div className="border-b border-border px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              placeholder="Search skills…"
              className="h-8 pl-7"
              onChange={(event) => {
                const value = event.target.value
                onSearchQueryChange(value)
                scheduleSearch(value)
              }}
            />
            {searching ? (
              <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-2 py-2">
          {activeTab === 'installed' ? (
            installedError ? (
              <div className="px-3 py-6 text-center text-xs text-destructive">
                {installedError}
              </div>
            ) : installed.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No skills installed yet. Switch to Browse to find some.
              </div>
            ) : (
              <ul className="space-y-1">
                {installed.map((skill) => {
                  const key = `installed:${skill.skillId}`
                  const isActive = selectedKey === key
                  return (
                    <li key={skill.skillId}>
                      <button
                        type="button"
                        onClick={() => onSelectInstalled(skill)}
                        className={cn(
                          'flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition-colors',
                          isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                        )}
                      >
                        <span className="truncate text-sm font-medium text-foreground">
                          {skill.name}
                        </span>
                        {skill.description ? (
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {skill.description}
                          </span>
                        ) : null}
                        {skill.source ? (
                          <span className="text-[11px] text-muted-foreground/70">
                            {skill.source}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )
          ) : searchError ? (
            <div className="px-3 py-6 text-center text-xs text-destructive">{searchError}</div>
          ) : searchQuery.trim().length < 2 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Type at least 2 characters to search the skills.sh directory.
            </div>
          ) : searchResults.length === 0 && !searching ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No skills match your search.
            </div>
          ) : (
            <ul className="space-y-1">
              {searchResults.map((listing) => {
                const key = `listing:${listing.id}`
                const isActive = selectedKey === key
                const isInstalled = isListingInstalled(listing.source, listing.skillId)
                return (
                  <li key={listing.id}>
                    <button
                      type="button"
                      onClick={() => onSelectListing(listing)}
                      className={cn(
                        'flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition-colors',
                        isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                      )}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {listing.name}
                        </span>
                        {isInstalled ? (
                          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                            Installed
                          </span>
                        ) : null}
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {listing.source}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                        <Download className="h-3 w-3" />
                        {formatInstalls(listing.installs)}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
