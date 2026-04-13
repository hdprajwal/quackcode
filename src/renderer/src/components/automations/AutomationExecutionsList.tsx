import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { cn } from '@renderer/lib/utils'
import type { AutomationExecution } from '@shared/types'
import { ExecutionStatusBadge } from './AutomationBadges'
import { formatRelativeTime, formatTimestamp } from './automation-utils'

export function AutomationExecutionsList({
  executions,
  selectedExecutionId,
  onSelectExecution
}: {
  executions: AutomationExecution[]
  selectedExecutionId: string | null
  onSelectExecution: (executionId: string) => void
}): React.JSX.Element {
  return (
    <div className="border-b border-border lg:border-r lg:border-b-0">
      <div className="border-b border-border px-4 py-3">
        <div className="text-sm font-semibold text-foreground">Executions</div>
        <div className="text-xs text-muted-foreground">Select a run to inspect the thread log</div>
      </div>
      <ScrollArea className="h-[calc(100vh-205px)] lg:h-full">
        <div className="space-y-2 p-3">
          {executions.length > 0 ? (
            executions.map((execution) => (
              <button
                key={execution.id}
                type="button"
                className={cn(
                  'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                  selectedExecutionId === execution.id
                    ? 'border-foreground/20 bg-accent'
                    : 'border-border bg-background hover:bg-accent/60'
                )}
                onClick={() => onSelectExecution(execution.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <ExecutionStatusBadge status={execution.status} />
                  <span className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(execution.startedAt)}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div>Started {formatTimestamp(execution.startedAt)}</div>
                  <div>
                    {execution.completedAt
                      ? `Finished ${formatTimestamp(execution.completedAt)}`
                      : 'Still running'}
                  </div>
                  {execution.error ? (
                    <div className="line-clamp-2 text-destructive">{execution.error}</div>
                  ) : null}
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No executions yet. Run the automation to generate logs.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
