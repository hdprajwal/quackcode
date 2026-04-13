import { CheckCircle2, FolderOpen, Globe, Loader2, Pause, XCircle } from 'lucide-react'
import type { Automation, AutomationExecution } from '@shared/types'

export function ExecutionStatusBadge({
  status
}: {
  status: AutomationExecution['status']
}): React.JSX.Element {
  switch (status) {
    case 'running':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Running
        </span>
      )
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
          <XCircle className="h-3 w-3" /> Failed
        </span>
      )
  }
}

export function AutomationStatusBadge({
  status
}: {
  status: Automation['status']
}): React.JSX.Element {
  return status === 'active' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
      <CheckCircle2 className="h-3 w-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
      <Pause className="h-3 w-3" /> Paused
    </span>
  )
}

export function AutomationScopePills({
  automation,
  projectNameById
}: {
  automation: Automation
  projectNameById: Map<string, string>
}): React.JSX.Element {
  if (automation.projectIds.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
        <Globe className="h-2.5 w-2.5" /> Global
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {automation.projectIds.map((projectId) => (
        <span
          key={projectId}
          className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground"
        >
          <FolderOpen className="h-2.5 w-2.5" />
          {projectNameById.get(projectId) || projectId}
        </span>
      ))}
    </div>
  )
}
