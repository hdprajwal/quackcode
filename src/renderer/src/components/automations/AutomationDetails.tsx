import { Loader2, Pause, Pencil, Play, Trash2, Zap } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import type { Automation, AutomationExecution, Message as ThreadMessage } from '@shared/types'
import { AutomationScopePills, AutomationStatusBadge } from './AutomationBadges'
import { AutomationExecutionLog } from './AutomationExecutionLog'
import { AutomationExecutionsList } from './AutomationExecutionsList'
import { formatFutureTime, formatRelativeTime, formatSchedule } from './automation-utils'

interface AutomationDetailsProps {
  automation: Automation
  executions: AutomationExecution[]
  selectedExecutionId: string | null
  selectedExecution: AutomationExecution | null
  executionMessages: ThreadMessage[]
  executionMessagesLoading: boolean
  executionMessagesError: string | null
  isExecutingNow: boolean
  projectNameById: Map<string, string>
  onSelectExecution: (executionId: string) => void
  onEdit: (automation: Automation) => void
  onRunNow: (automation: Automation) => Promise<void>
  onToggleStatus: (automation: Automation) => Promise<void>
  onDelete: (automation: Automation) => void
  onOpenThread: (threadId: string) => Promise<void>
}

export function AutomationDetails({
  automation,
  executions,
  selectedExecutionId,
  selectedExecution,
  executionMessages,
  executionMessagesLoading,
  executionMessagesError,
  isExecutingNow,
  projectNameById,
  onSelectExecution,
  onEdit,
  onRunNow,
  onToggleStatus,
  onDelete,
  onOpenThread
}: AutomationDetailsProps): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground">{automation.name}</h2>
                <AutomationStatusBadge status={automation.status} />
              </div>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{automation.prompt}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <AutomationScopePills automation={automation} projectNameById={projectNameById} />
              <span className="rounded-md bg-accent px-2 py-1 text-xs text-muted-foreground">
                {formatSchedule(automation)}
              </span>
              <span className="rounded-md bg-accent px-2 py-1 text-xs text-muted-foreground">
                Provider: {automation.provider}
              </span>
              <span className="rounded-md bg-accent px-2 py-1 text-xs text-muted-foreground">
                Model: {automation.model}
              </span>
              <span className="rounded-md bg-accent px-2 py-1 text-xs text-muted-foreground">
                Last run: {formatRelativeTime(automation.lastRunAt)}
              </span>
              {automation.status === 'active' ? (
                <span className="rounded-md bg-accent px-2 py-1 text-xs text-muted-foreground">
                  Next run: {formatFutureTime(automation.nextRunAt)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onEdit(automation)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              disabled={isExecutingNow}
              onClick={() => void onRunNow(automation)}
            >
              {isExecutingNow ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Run now
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void onToggleStatus(automation)}
            >
              {automation.status === 'active' ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Resume
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => onDelete(automation)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <AutomationExecutionsList
          executions={executions}
          selectedExecutionId={selectedExecutionId}
          onSelectExecution={onSelectExecution}
        />
        <AutomationExecutionLog
          selectedExecution={selectedExecution}
          executionMessages={executionMessages}
          executionMessagesLoading={executionMessagesLoading}
          executionMessagesError={executionMessagesError}
          onOpenThread={onOpenThread}
        />
      </div>
    </div>
  )
}
