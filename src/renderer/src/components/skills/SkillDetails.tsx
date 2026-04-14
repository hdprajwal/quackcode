import { useEffect, useMemo, useState } from 'react'
import { Download, Loader2, Package, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { cn } from '@renderer/lib/utils'
import {
  SUPPORTED_AGENTS,
  type InstalledSkill,
  type SkillDetails as SkillDetailsType
} from '@shared/types'

interface SkillDetailsProps {
  details: SkillDetailsType | null
  installed: InstalledSkill | null
  loading: boolean
  error: string | null
  working: boolean
  onInstall: (agents: string[]) => void
  onUninstall: (agents: string[] | null) => void
}

function agentLabel(id: string): string {
  return SUPPORTED_AGENTS.find((agent) => agent.id === id)?.label ?? id
}

export function SkillDetails({
  details,
  installed,
  loading,
  error,
  working,
  onInstall,
  onUninstall
}: SkillDetailsProps): React.JSX.Element {
  const name = details?.name ?? installed?.name ?? 'Skill'
  const description = details?.description ?? ''
  const source = details?.source ?? null
  const isInstalled = installed !== null

  const installedAgents = useMemo(() => new Set(installed?.agents ?? []), [installed])

  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(() => {
    const defaults = SUPPORTED_AGENTS.filter(
      (agent) => agent.default && !installedAgents.has(agent.id)
    ).map((agent) => agent.id)
    return new Set(defaults.length > 0 ? defaults : ['claude-code'])
  })

  const toggleAgent = (id: string): void => {
    setSelectedAgents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectableAgents = SUPPORTED_AGENTS.filter((agent) => !installedAgents.has(agent.id))

  // After install/uninstall, the installed agent set changes. Drop any
  // now-installed ids from the pending selection, and if nothing is selectable
  // anymore, fall back to defaults so the CTA count doesn't go stale.
  useEffect(() => {
    setSelectedAgents((prev) => {
      const pruned = new Set<string>()
      for (const id of prev) {
        if (!installedAgents.has(id)) pruned.add(id)
      }
      if (pruned.size > 0) return pruned
      const defaults = SUPPORTED_AGENTS.filter(
        (agent) => agent.default && !installedAgents.has(agent.id)
      ).map((agent) => agent.id)
      return new Set(defaults.length > 0 ? defaults : ['claude-code'])
    })
  }, [installedAgents])

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h2 className="truncate text-base font-semibold text-foreground">{name}</h2>
            {isInstalled ? (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                Installed
              </span>
            ) : null}
          </div>
          {source ? <div className="mt-1 text-xs text-muted-foreground">{source}</div> : null}
          {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 px-5 py-5">
          {installed && installed.agents.length > 0 ? (
            <section>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Installed on
              </div>
              <div className="flex flex-wrap gap-2">
                {installed.agents.map((agentId) => (
                  <span
                    key={agentId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-accent/40 px-2.5 py-0.5 text-xs text-foreground"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {agentLabel(agentId)}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {installed.agents.map((agentId) => (
                  <Button
                    key={`rm-${agentId}`}
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    disabled={working}
                    onClick={() => onUninstall([agentId])}
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove from {agentLabel(agentId)}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  disabled={working}
                  onClick={() => onUninstall(null)}
                >
                  {working ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Uninstall everywhere
                </Button>
              </div>
            </section>
          ) : null}

          {selectableAgents.length > 0 ? (
            <section>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isInstalled ? 'Install on additional agents' : 'Install to'}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectableAgents.map((agent) => {
                  const checked = selectedAgents.has(agent.id)
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggleAgent(agent.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                        checked
                          ? 'border-primary/60 bg-primary/15 text-foreground'
                          : 'border-border text-muted-foreground hover:bg-accent/40'
                      )}
                    >
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full border',
                          checked ? 'border-primary bg-primary' : 'border-muted-foreground'
                        )}
                      />
                      {agent.label}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3">
                <Button
                  size="sm"
                  disabled={working || loading || !details || selectedAgents.size === 0}
                  className="gap-1.5"
                  onClick={() => onInstall(Array.from(selectedAgents))}
                >
                  {working ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {isInstalled
                    ? `Install on ${selectedAgents.size} more`
                    : `Install to ${selectedAgents.size} agent${selectedAgents.size === 1 ? '' : 's'}`}
                </Button>
              </div>
            </section>
          ) : null}

          <section>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              SKILL.md
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading SKILL.md…
              </div>
            ) : error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : details ? (
              <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-foreground/90">
                {details.body}
              </pre>
            ) : installed ? (
              <div className="text-sm text-muted-foreground">
                Installed at <code className="text-xs">{installed.path}</code>.
              </div>
            ) : null}
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
