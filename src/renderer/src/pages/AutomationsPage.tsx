import { useEffect, useMemo, useState } from 'react'
import { Clock, PanelLeft } from 'lucide-react'
import { useAutomation } from '@renderer/hooks/useAutomation'
import { useThread } from '@renderer/hooks/useThread'
import { invoke } from '@renderer/lib/ipc'
import { Button } from '@renderer/components/ui/button'
import { AutomationDeleteDialog } from '@renderer/components/automations/AutomationDeleteDialog'
import { AutomationDetails } from '@renderer/components/automations/AutomationDetails'
import { AutomationEmptyState } from '@renderer/components/automations/AutomationEmptyState'
import { AutomationFormDialog } from '@renderer/components/automations/AutomationFormDialog'
import { AutomationSidebar } from '@renderer/components/automations/AutomationSidebar'
import { cn } from '@renderer/lib/utils'
import { useAutomationStore } from '@renderer/stores/automation.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useUIStore } from '@renderer/stores/ui.store'
import type { Automation, CreateAutomationParams, Message as ThreadMessage } from '@shared/types'

export function AutomationsPanel(): React.JSX.Element {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { recentProjects: projects } = useProjectStore()
  const { models, selectedProvider, selectedModel } = useSettingsStore()
  const { automations, executions, selectedAutomationId, setSelectedAutomationId } =
    useAutomationStore()
  const {
    loadAutomations,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    executeAutomation,
    loadExecutions
  } = useAutomation()
  const { switchThread } = useThread()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Automation | null>(null)
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null)
  const [executionMessages, setExecutionMessages] = useState<ThreadMessage[]>([])
  const [executionMessagesLoading, setExecutionMessagesLoading] = useState(false)
  const [executionMessagesError, setExecutionMessagesError] = useState<string | null>(null)
  const [isExecutingNow, setIsExecutingNow] = useState(false)

  useEffect(() => {
    void loadAutomations()
  }, [loadAutomations])

  useEffect(() => {
    if (automations.length === 0) {
      if (selectedAutomationId !== null) {
        setSelectedAutomationId(null)
      }

      return
    }

    const hasSelectedAutomation = automations.some(
      (automation) => automation.id === selectedAutomationId
    )

    if (!hasSelectedAutomation) {
      setSelectedAutomationId(automations[0].id)
    }
  }, [automations, selectedAutomationId, setSelectedAutomationId])

  const selectedAutomation = useMemo(
    () => automations.find((automation) => automation.id === selectedAutomationId) ?? null,
    [automations, selectedAutomationId]
  )

  useEffect(() => {
    if (!selectedAutomation) {
      setSelectedExecutionId(null)
      setExecutionMessages([])
      setExecutionMessagesError(null)
      return
    }

    setSelectedExecutionId(null)
    setExecutionMessages([])
    setExecutionMessagesError(null)
    void loadExecutions(selectedAutomation.id)
  }, [selectedAutomation, loadExecutions])

  const selectedAutomationExecutions = useMemo(
    () => executions.filter((execution) => execution.automationId === selectedAutomation?.id),
    [executions, selectedAutomation]
  )

  useEffect(() => {
    if (selectedAutomationExecutions.length === 0) {
      setSelectedExecutionId(null)
      setExecutionMessages([])
      setExecutionMessagesError(null)
      return
    }

    const hasSelectedExecution = selectedAutomationExecutions.some(
      (execution) => execution.id === selectedExecutionId
    )

    if (!hasSelectedExecution) {
      setSelectedExecutionId(selectedAutomationExecutions[0].id)
    }
  }, [selectedAutomationExecutions, selectedExecutionId])

  const selectedExecution = useMemo(
    () =>
      selectedAutomationExecutions.find((execution) => execution.id === selectedExecutionId) ??
      null,
    [selectedAutomationExecutions, selectedExecutionId]
  )

  useEffect(() => {
    let cancelled = false
    let intervalId: number | undefined

    const loadMessages = async (): Promise<void> => {
      if (!selectedExecution) {
        if (!cancelled) {
          setExecutionMessages([])
          setExecutionMessagesError(null)
        }

        return
      }

      if (!cancelled) {
        setExecutionMessagesLoading(true)
        setExecutionMessagesError(null)
      }

      try {
        const messages = await invoke<ThreadMessage[]>('message:list', selectedExecution.threadId)

        if (!cancelled) {
          setExecutionMessages(messages)
        }
      } catch (error) {
        if (!cancelled) {
          setExecutionMessages([])
          setExecutionMessagesError(
            error instanceof Error ? error.message : 'Failed to load execution log.'
          )
        }
      } finally {
        if (!cancelled) {
          setExecutionMessagesLoading(false)
        }
      }
    }

    void loadMessages()

    if (selectedExecution?.status === 'running') {
      intervalId = window.setInterval(() => {
        void loadMessages()
      }, 2000)
    }

    return () => {
      cancelled = true

      if (intervalId) {
        window.clearInterval(intervalId)
      }
    }
  }, [selectedExecution])

  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects]
  )

  const globalAutomations = useMemo(
    () => automations.filter((automation) => automation.projectIds.length === 0),
    [automations]
  )

  const projectAutomations = useMemo(
    () => automations.filter((automation) => automation.projectIds.length > 0),
    [automations]
  )

  const closeFormDialog = (): void => {
    setCreateDialogOpen(false)
    setEditingAutomation(null)
  }

  const openCreateDialog = (): void => {
    setEditingAutomation(null)
    setCreateDialogOpen(true)
  }

  const openEditDialog = (automation: Automation): void => {
    setEditingAutomation(automation)
    setCreateDialogOpen(true)
  }

  const handleFormSubmit = async (payload: CreateAutomationParams): Promise<void> => {
    const automation = editingAutomation
      ? await updateAutomation({ id: editingAutomation.id, ...payload })
      : await createAutomation(payload)

    setSelectedAutomationId(automation.id)
  }

  const handleToggleStatus = async (automation: Automation): Promise<void> => {
    await updateAutomation({
      id: automation.id,
      status: automation.status === 'active' ? 'paused' : 'active'
    })
  }

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return

    await deleteAutomation(deleteTarget.id)
    setDeleteTarget(null)
  }

  const handleRunNow = async (automation: Automation): Promise<void> => {
    setIsExecutingNow(true)

    try {
      const execution = await executeAutomation(automation.id)
      await loadExecutions(automation.id)
      setSelectedExecutionId(execution.id)
    } finally {
      setIsExecutingNow(false)
    }
  }

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
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Automation logs</span>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            'overflow-hidden transition-[width,opacity] duration-300 ease-out',
            automations.length > 0 ? 'w-[300px] opacity-100' : 'w-0 opacity-0'
          )}
          aria-hidden={automations.length === 0}
        >
          <AutomationSidebar
            globalAutomations={globalAutomations}
            projectAutomations={projectAutomations}
            selectedAutomationId={selectedAutomationId}
            projectNameById={projectNameById}
            onSelectAutomation={setSelectedAutomationId}
            onCreateAutomation={openCreateDialog}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {selectedAutomation ? (
            <AutomationDetails
              automation={selectedAutomation}
              executions={selectedAutomationExecutions}
              selectedExecutionId={selectedExecutionId}
              selectedExecution={selectedExecution}
              executionMessages={executionMessages}
              executionMessagesLoading={executionMessagesLoading}
              executionMessagesError={executionMessagesError}
              isExecutingNow={isExecutingNow}
              projectNameById={projectNameById}
              onSelectExecution={setSelectedExecutionId}
              onEdit={openEditDialog}
              onRunNow={handleRunNow}
              onToggleStatus={handleToggleStatus}
              onDelete={setDeleteTarget}
              onOpenThread={switchThread}
            />
          ) : (
            <AutomationEmptyState onCreateAutomation={openCreateDialog} />
          )}
        </div>
      </div>

      <AutomationFormDialog
        open={createDialogOpen}
        editingAutomation={editingAutomation}
        projects={projects}
        models={models}
        defaultProvider={selectedProvider}
        defaultModel={selectedModel}
        onOpenChange={(open) => {
          if (!open) {
            closeFormDialog()
            return
          }

          setCreateDialogOpen(true)
        }}
        onSubmit={handleFormSubmit}
      />

      <AutomationDeleteDialog
        automation={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
