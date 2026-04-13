import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import type { AutomationExecution, Message as ThreadMessage } from '@shared/types'
import { AutomationMessageList } from './AutomationMessageList'

interface AutomationExecutionLogProps {
  selectedExecution: AutomationExecution | null
  executionMessages: ThreadMessage[]
  executionMessagesLoading: boolean
  executionMessagesError: string | null
  onOpenThread: (threadId: string) => Promise<void>
}

export function AutomationExecutionLog({
  selectedExecution,
  executionMessages,
  executionMessagesLoading,
  executionMessagesError,
  onOpenThread
}: AutomationExecutionLogProps): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="border-b border-border px-6 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">Execution log</div>
            <div className="text-xs text-muted-foreground">
              {selectedExecution
                ? `Thread ${selectedExecution.threadId}`
                : 'Choose an execution to see its thread output'}
            </div>
          </div>

          {selectedExecution ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void onOpenThread(selectedExecution.threadId)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open thread
            </Button>
          ) : null}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {!selectedExecution ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Select an execution from the list to inspect the logs.
          </div>
        ) : executionMessagesLoading && executionMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading execution log...
          </div>
        ) : executionMessagesError ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-destructive">
            {executionMessagesError}
          </div>
        ) : executionMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
            {selectedExecution.status === 'running'
              ? 'Waiting for the execution to emit messages...'
              : 'This execution finished without saved thread messages.'}
          </div>
        ) : (
          <AutomationMessageList messages={executionMessages} />
        )}
      </ScrollArea>
    </div>
  )
}
