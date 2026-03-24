import { useEffect, useMemo, useRef, useState } from 'react'
import { useAutomation } from '@renderer/hooks/useAutomation'
import { useAutomationStore } from '@renderer/stores/automation.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useUIStore } from '@renderer/stores/ui.store'
import { useThread } from '@renderer/hooks/useThread'
import { invoke } from '@renderer/lib/ipc'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Textarea } from '@renderer/components/ui/textarea'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import {
  ModelSelector as ModelSelectorRoot,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger
} from '@renderer/components/ai-elements/model-selector'
import {
  Sidebar as SidebarShell,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator
} from '@renderer/components/ui/sidebar'
import {
  Message as ChatMessage,
  MessageContent,
  MessageResponse
} from '@renderer/components/ai-elements/message'
import { ToolCallMessage } from '@renderer/components/chat/ToolCallMessage'
import { PROVIDER_LABELS } from '@renderer/lib/provider-labels'
import { cn } from '@renderer/lib/utils'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FolderOpen,
  Globe,
  Loader2,
  PanelLeft,
  Pause,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
  XCircle,
  Zap
} from 'lucide-react'
import type {
  AIModel,
  AIProvider,
  Automation,
  AutomationExecution,
  DayOfWeek,
  IntervalUnit,
  Message as ThreadMessage,
  ScheduleType
} from '@shared/types'
import { DAYS_OF_WEEK } from '@shared/types'

function getProviderLogo(provider: AIProvider): string {
  return provider === 'gemini' ? 'google' : provider
}

function formatSchedule(automation: Automation): string {
  if (automation.scheduleType === 'daily') {
    const time = automation.scheduledTime || '09:00'
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    const timeStr = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`
    const days = automation.scheduledDays
    if (days.length === 7 || days.length === 0) return `Daily at ${timeStr}`
    return `${days.join(', ')} at ${timeStr}`
  }

  const { intervalValue, intervalUnit } = automation
  if (intervalValue === 1) return `Every ${intervalUnit.slice(0, -1)}`
  return `Every ${intervalValue} ${intervalUnit}`
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  return `${diffDays}d ago`
}

function formatFutureTime(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()

  if (diffMs <= 0) return 'Now'

  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)

  if (diffMin < 1) return `${Math.floor(diffMs / 1000)}s`
  if (diffHr < 1) return `${diffMin}m`
  if (diffDays < 1) return `${diffHr}h ${diffMin % 60}m`
  return `${diffDays}d ${diffHr % 24}h`
}

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleString()
}

function to24Hour(hours: string, minutes: string, period: 'AM' | 'PM'): string {
  let h = parseInt(hours, 10)
  if (period === 'AM' && h === 12) h = 0
  if (period === 'PM' && h !== 12) h += 12
  return `${String(h).padStart(2, '0')}:${minutes.padStart(2, '0')}`
}

function to12Hour(time24: string | null): { hours: string; minutes: string; period: 'AM' | 'PM' } {
  if (!time24) {
    return { hours: '06', minutes: '00', period: 'PM' }
  }

  const [hours24, minutes = 0] = time24.split(':').map(Number)
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 || 12

  return {
    hours: String(hours12).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    period
  }
}

function ExecutionStatusBadge({
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

function AutomationStatusBadge({ status }: { status: Automation['status'] }): React.JSX.Element {
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
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Automation | null>(null)
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null)
  const [executionMessages, setExecutionMessages] = useState<ThreadMessage[]>([])
  const [executionMessagesLoading, setExecutionMessagesLoading] = useState(false)
  const [executionMessagesError, setExecutionMessagesError] = useState<string | null>(null)
  const [isExecutingNow, setIsExecutingNow] = useState(false)

  const [formName, setFormName] = useState('')
  const [formPrompt, setFormPrompt] = useState('')
  const [formProjectIds, setFormProjectIds] = useState<string[]>([])
  const [formProvider, setFormProvider] = useState<AIProvider>(selectedProvider)
  const [formModel, setFormModel] = useState(selectedModel)
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [formScheduleType, setFormScheduleType] = useState<ScheduleType>('daily')
  const [formTimeHours, setFormTimeHours] = useState('06')
  const [formTimeMinutes, setFormTimeMinutes] = useState('00')
  const [formTimePeriod, setFormTimePeriod] = useState<'AM' | 'PM'>('PM')
  const [formDays, setFormDays] = useState<DayOfWeek[]>([...DAYS_OF_WEEK])
  const [formIntervalValue, setFormIntervalValue] = useState('30')
  const [formIntervalUnit, setFormIntervalUnit] = useState<IntervalUnit>('minutes')
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    void loadAutomations()
  }, [loadAutomations])

  useEffect(() => {
    if (!workspaceDropdownOpen) return

    const handler = (event: MouseEvent): void => {
      if (workspaceRef.current && !workspaceRef.current.contains(event.target as Node)) {
        setWorkspaceDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [workspaceDropdownOpen])

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

    const hasSelection = selectedAutomationExecutions.some(
      (execution) => execution.id === selectedExecutionId
    )

    if (!hasSelection) {
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

  const groupedModels = useMemo(
    () =>
      models.reduce(
        (acc, model) => {
          if (!acc[model.provider]) acc[model.provider] = []
          acc[model.provider].push(model)
          return acc
        },
        {} as Record<AIProvider, AIModel[]>
      ),
    [models]
  )

  const selectedFormModel = useMemo(
    () => models.find((model) => model.id === formModel && model.provider === formProvider) ?? null,
    [formModel, formProvider, models]
  )

  const globalAutomations = useMemo(
    () => automations.filter((automation) => automation.projectIds.length === 0),
    [automations]
  )

  const projectAutomations = useMemo(
    () => automations.filter((automation) => automation.projectIds.length > 0),
    [automations]
  )

  const resetForm = (): void => {
    setFormName('')
    setFormPrompt('')
    setFormProjectIds([])
    setFormProvider(selectedProvider)
    setFormModel(selectedModel)
    setModelSelectorOpen(false)
    setWorkspaceDropdownOpen(false)
    setFormScheduleType('daily')
    setFormTimeHours('06')
    setFormTimeMinutes('00')
    setFormTimePeriod('PM')
    setFormDays([...DAYS_OF_WEEK])
    setFormIntervalValue('30')
    setFormIntervalUnit('minutes')
    setCreateError(null)
    setIsCreating(false)
  }

  const closeFormDialog = (): void => {
    resetForm()
    setEditingAutomationId(null)
    setCreateDialogOpen(false)
  }

  const openCreateDialog = (): void => {
    resetForm()
    setEditingAutomationId(null)
    setCreateDialogOpen(true)
  }

  const openEditDialog = (automation: Automation): void => {
    const time = to12Hour(automation.scheduledTime)

    setFormName(automation.name)
    setFormPrompt(automation.prompt)
    setFormProjectIds(automation.projectIds)
    setFormProvider(automation.provider)
    setFormModel(automation.model)
    setModelSelectorOpen(false)
    setWorkspaceDropdownOpen(false)
    setFormScheduleType(automation.scheduleType)
    setFormTimeHours(time.hours)
    setFormTimeMinutes(time.minutes)
    setFormTimePeriod(time.period)
    setFormDays(
      automation.scheduleType === 'daily' && automation.scheduledDays.length > 0
        ? automation.scheduledDays
        : [...DAYS_OF_WEEK]
    )
    setFormIntervalValue(String(automation.intervalValue))
    setFormIntervalUnit(automation.intervalUnit)
    setCreateError(null)
    setIsCreating(false)
    setEditingAutomationId(automation.id)
    setCreateDialogOpen(true)
  }

  const toggleProjectId = (id: string): void => {
    setCreateError(null)
    setFormProjectIds((prev) =>
      prev.includes(id) ? prev.filter((projectId) => projectId !== id) : [...prev, id]
    )
  }

  const toggleDay = (day: DayOfWeek): void => {
    setCreateError(null)
    setFormDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  const handleSubmit = async (): Promise<void> => {
    if (!formName.trim() || !formPrompt.trim()) {
      setCreateError('Add a name and prompt to create the automation.')
      return
    }

    if (formScheduleType === 'interval') {
      const intervalValue = parseInt(formIntervalValue, 10)
      if (isNaN(intervalValue) || intervalValue < 1) {
        setCreateError('Enter a valid interval greater than 0.')
        return
      }
    }

    if (formScheduleType === 'daily') {
      const hours = parseInt(formTimeHours, 10)
      const minutes = parseInt(formTimeMinutes, 10)

      if (
        isNaN(hours) ||
        hours < 1 ||
        hours > 12 ||
        isNaN(minutes) ||
        minutes < 0 ||
        minutes > 59
      ) {
        setCreateError('Enter a valid time for the daily schedule.')
        return
      }
    }

    setCreateError(null)
    setIsCreating(true)

    try {
      const payload = {
        name: formName.trim(),
        prompt: formPrompt.trim(),
        provider: formProvider,
        model: formModel,
        scheduleType: formScheduleType,
        intervalValue: formScheduleType === 'interval' ? parseInt(formIntervalValue, 10) : 1,
        intervalUnit: formScheduleType === 'interval' ? formIntervalUnit : 'days',
        scheduledTime:
          formScheduleType === 'daily'
            ? to24Hour(formTimeHours, formTimeMinutes, formTimePeriod)
            : null,
        scheduledDays: formScheduleType === 'daily' ? formDays : [],
        projectIds: formProjectIds
      }

      const automation = editingAutomationId
        ? await updateAutomation({ id: editingAutomationId, ...payload })
        : await createAutomation(payload)

      setSelectedAutomationId(automation.id)
      closeFormDialog()
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : editingAutomationId
            ? 'Failed to update automation.'
            : 'Failed to create automation.'
      )
    } finally {
      setIsCreating(false)
    }
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

  const renderScope = (automation: Automation): React.JSX.Element => {
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
          <SidebarShell className="w-[300px] min-w-[300px] border-r border-border bg-background/60 text-foreground">
            <SidebarHeader className="border-b border-border px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">Automations</div>
                  <div className="text-xs text-muted-foreground">
                    Browse schedules and execution logs
                  </div>
                </div>
                <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
                  <Plus className="h-3.5 w-3.5" />
                  New
                </Button>
              </div>
            </SidebarHeader>

            <SidebarContent>
              <ScrollArea className="min-h-0 flex-1">
                <div className="px-2 py-3">
                  <SidebarGroup>
                    <SidebarGroupLabel>Global</SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {globalAutomations.length > 0 ? (
                          globalAutomations.map((automation) => (
                            <SidebarMenuItem key={automation.id}>
                              <SidebarMenuButton
                                isActive={selectedAutomationId === automation.id}
                                className="items-start px-3 py-2"
                                onClick={() => setSelectedAutomationId(automation.id)}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium text-foreground">
                                    {automation.name}
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {formatSchedule(automation)}
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span>
                                      {automation.status === 'active'
                                        ? `Next ${formatFutureTime(automation.nextRunAt)}`
                                        : 'Paused'}
                                    </span>
                                  </div>
                                </div>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            No global automations
                          </div>
                        )}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>

                  <SidebarSeparator className="my-3" />

                  <SidebarGroup>
                    <SidebarGroupLabel>Projects</SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {projectAutomations.length > 0 ? (
                          projectAutomations.map((automation) => (
                            <SidebarMenuItem key={automation.id}>
                              <SidebarMenuButton
                                isActive={selectedAutomationId === automation.id}
                                className="items-start px-3 py-2"
                                onClick={() => setSelectedAutomationId(automation.id)}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium text-foreground">
                                    {automation.name}
                                  </div>
                                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                    {automation.projectIds
                                      .map(
                                        (projectId) => projectNameById.get(projectId) || projectId
                                      )
                                      .join(', ')}
                                  </div>
                                  <div className="mt-1 text-[11px] text-muted-foreground">
                                    {formatSchedule(automation)}
                                  </div>
                                </div>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            No project automations
                          </div>
                        )}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </div>
              </ScrollArea>
            </SidebarContent>
          </SidebarShell>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!selectedAutomation ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                  <Zap className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground">No automations yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create an automation from the sidebar to start scheduling runs and viewing logs.
                </p>
                <Button className="mt-5 gap-1.5" onClick={openCreateDialog}>
                  <Plus className="h-3.5 w-3.5" />
                  Create automation
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="border-b border-border px-6 py-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-foreground">
                          {selectedAutomation.name}
                        </h2>
                        <AutomationStatusBadge status={selectedAutomation.status} />
                      </div>
                      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                        {selectedAutomation.prompt}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {renderScope(selectedAutomation)}
                      <span className="rounded-md bg-accent px-2 py-1 text-xs text-muted-foreground">
                        {formatSchedule(selectedAutomation)}
                      </span>
                      <span className="rounded-md bg-accent px-2 py-1 text-xs text-muted-foreground">
                        Provider: {selectedAutomation.provider}
                      </span>
                      <span className="rounded-md bg-accent px-2 py-1 text-xs text-muted-foreground">
                        Model: {selectedAutomation.model}
                      </span>
                      <span className="rounded-md bg-accent px-2 py-1 text-xs text-muted-foreground">
                        Last run: {formatRelativeTime(selectedAutomation.lastRunAt)}
                      </span>
                      {selectedAutomation.status === 'active' && (
                        <span className="rounded-md bg-accent px-2 py-1 text-xs text-muted-foreground">
                          Next run: {formatFutureTime(selectedAutomation.nextRunAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => openEditDialog(selectedAutomation)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                      disabled={isExecutingNow}
                      onClick={() => void handleRunNow(selectedAutomation)}
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
                      onClick={() => void handleToggleStatus(selectedAutomation)}
                    >
                      {selectedAutomation.status === 'active' ? (
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
                      onClick={() => setDeleteTarget(selectedAutomation)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="border-b border-border lg:border-r lg:border-b-0">
                  <div className="border-b border-border px-4 py-3">
                    <div className="text-sm font-semibold text-foreground">Executions</div>
                    <div className="text-xs text-muted-foreground">
                      Select a run to inspect the thread log
                    </div>
                  </div>
                  <ScrollArea className="h-[calc(100vh-205px)] lg:h-full">
                    <div className="space-y-2 p-3">
                      {selectedAutomationExecutions.length > 0 ? (
                        selectedAutomationExecutions.map((execution) => (
                          <button
                            key={execution.id}
                            type="button"
                            className={cn(
                              'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                              selectedExecutionId === execution.id
                                ? 'border-foreground/20 bg-accent'
                                : 'border-border bg-background hover:bg-accent/60'
                            )}
                            onClick={() => setSelectedExecutionId(execution.id)}
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
                              {execution.error && (
                                <div className="line-clamp-2 text-destructive">
                                  {execution.error}
                                </div>
                              )}
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

                      {selectedExecution && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => void switchThread(selectedExecution.threadId)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open thread
                        </Button>
                      )}
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
                      <div className="flex flex-col gap-6 p-6 pb-10">
                        {executionMessages.map((message) => {
                          if (message.role === 'user') {
                            return (
                              <ChatMessage key={message.id} from="user">
                                <MessageContent>{message.content}</MessageContent>
                              </ChatMessage>
                            )
                          }

                          if (message.role === 'assistant') {
                            const hasToolCalls = Boolean(
                              message.toolCalls && message.toolCalls.length > 0
                            )

                            return (
                              <ChatMessage
                                key={message.id}
                                from="assistant"
                                className={hasToolCalls ? 'max-w-full' : undefined}
                              >
                                {hasToolCalls && (
                                  <ToolCallMessage
                                    toolCalls={message.toolCalls || []}
                                    toolResults={message.toolResults || []}
                                  />
                                )}
                                {message.content && (
                                  <MessageContent>
                                    <MessageResponse>{message.content}</MessageResponse>
                                  </MessageContent>
                                )}
                              </ChatMessage>
                            )
                          }

                          if (message.role === 'tool' && message.toolResults) {
                            return (
                              <div key={message.id} className="w-full">
                                <ToolCallMessage toolCalls={[]} toolResults={message.toolResults} />
                              </div>
                            )
                          }

                          return null
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeFormDialog()
            return
          }

          setCreateDialogOpen(true)
        }}
      >
        <DialogContent showCloseButton={false} className="gap-0 p-6 sm:max-w-xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-5">
            <DialogTitle className="text-lg font-bold">
              {editingAutomationId ? 'Edit automation' : 'Create automation'}
            </DialogTitle>
            <DialogClose className="text-muted-foreground transition-colors hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold">Name</label>
              <Input
                placeholder="e.g. Daily code review"
                value={formName}
                onChange={(event) => {
                  setFormName(event.target.value)
                  setCreateError(null)
                }}
              />
            </div>

            <div ref={workspaceRef} className="relative">
              <label className="mb-2 block text-sm font-semibold">Workspaces</label>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-sm"
                onClick={() => setWorkspaceDropdownOpen((open) => !open)}
              >
                {formProjectIds.length === 0 ? (
                  <span className="text-muted-foreground">Choose a folder</span>
                ) : (
                  <div className="flex flex-1 flex-wrap gap-1">
                    {formProjectIds.map((projectId) => {
                      const project = projects.find((item) => item.id === projectId)

                      return (
                        <span
                          key={projectId}
                          className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-xs"
                        >
                          {project?.name || projectId}
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleProjectId(projectId)
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
                <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>

              {workspaceDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-background py-1 shadow-lg">
                  {projects.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No projects available
                    </div>
                  ) : (
                    projects.map((project) => {
                      const selected = formProjectIds.includes(project.id)

                      return (
                        <button
                          key={project.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                          onClick={() => toggleProjectId(project.id)}
                        >
                          <div
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                              selected ? 'border-foreground bg-foreground' : 'border-border'
                            )}
                          >
                            {selected && <Check className="h-3 w-3 text-background" />}
                          </div>
                          <span className="truncate">{project.name}</span>
                          <span className="ml-auto truncate text-xs text-muted-foreground">
                            {project.path}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Prompt</label>
              <Textarea
                placeholder="e.g. Review all changed files for bugs, security issues, and code quality."
                rows={3}
                value={formPrompt}
                onChange={(event) => {
                  setFormPrompt(event.target.value)
                  setCreateError(null)
                }}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Model</label>
              <ModelSelectorRoot open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                <ModelSelectorTrigger
                  render={
                    <Button
                      variant="outline"
                      className="h-auto w-full justify-between gap-3 px-3 py-2 text-left"
                    />
                  }
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {selectedFormModel ? (
                      <ModelSelectorLogo provider={getProviderLogo(selectedFormModel.provider)} />
                    ) : (
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {selectedFormModel?.name ?? formModel}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {selectedFormModel
                          ? PROVIDER_LABELS[selectedFormModel.provider]
                          : PROVIDER_LABELS[formProvider]}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </ModelSelectorTrigger>

                <ModelSelectorContent className="max-w-md">
                  <ModelSelectorInput placeholder="Search models..." />
                  <ModelSelectorList>
                    <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                    {Object.entries(groupedModels).map(([provider, providerModels]) => (
                      <ModelSelectorGroup
                        key={provider}
                        heading={PROVIDER_LABELS[provider as AIProvider] ?? provider}
                      >
                        {providerModels.map((model) => {
                          const isSelected =
                            model.id === formModel && model.provider === formProvider

                          return (
                            <ModelSelectorItem
                              key={`${model.provider}-${model.id}`}
                              value={`${model.name} ${model.id} ${PROVIDER_LABELS[model.provider]}`}
                              onSelect={() => {
                                setFormProvider(model.provider)
                                setFormModel(model.id)
                                setModelSelectorOpen(false)
                                setCreateError(null)
                              }}
                            >
                              <ModelSelectorLogo provider={getProviderLogo(model.provider)} />
                              <ModelSelectorName>{model.name}</ModelSelectorName>
                              <Check
                                className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')}
                              />
                            </ModelSelectorItem>
                          )
                        })}
                      </ModelSelectorGroup>
                    ))}
                  </ModelSelectorList>
                </ModelSelectorContent>
              </ModelSelectorRoot>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-semibold">Schedule</label>
                <div className="flex overflow-hidden rounded-md border border-border text-xs">
                  <button
                    type="button"
                    className={cn(
                      'px-3 py-1 transition-colors',
                      formScheduleType === 'daily'
                        ? 'bg-foreground font-medium text-background'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => {
                      setFormScheduleType('daily')
                      setCreateError(null)
                    }}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'px-3 py-1 transition-colors',
                      formScheduleType === 'interval'
                        ? 'bg-foreground font-medium text-background'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => {
                      setFormScheduleType('interval')
                      setCreateError(null)
                    }}
                  >
                    Interval
                  </button>
                </div>
              </div>

              {formScheduleType === 'daily' ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 rounded-md border border-border px-3 py-2">
                    <input
                      type="text"
                      className="w-6 bg-transparent text-center text-sm outline-none"
                      value={formTimeHours}
                      maxLength={2}
                      onChange={(event) => {
                        const value = event.target.value.replace(/\D/g, '')
                        if (
                          value === '' ||
                          (parseInt(value, 10) >= 1 && parseInt(value, 10) <= 12)
                        ) {
                          setFormTimeHours(value)
                          setCreateError(null)
                        }
                      }}
                    />
                    <span className="text-muted-foreground">:</span>
                    <input
                      type="text"
                      className="w-6 bg-transparent text-center text-sm outline-none"
                      value={formTimeMinutes}
                      maxLength={2}
                      onChange={(event) => {
                        const value = event.target.value.replace(/\D/g, '')
                        if (
                          value === '' ||
                          (parseInt(value, 10) >= 0 && parseInt(value, 10) <= 59)
                        ) {
                          setFormTimeMinutes(value)
                          setCreateError(null)
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="ml-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setFormTimePeriod((period) => (period === 'AM' ? 'PM' : 'AM'))
                        setCreateError(null)
                      }}
                    >
                      {formTimePeriod}
                    </button>
                    <Clock className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
                  </div>

                  <div className="flex gap-1">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day}
                        type="button"
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                          formDays.includes(day)
                            ? 'bg-foreground text-background'
                            : 'border border-border text-muted-foreground hover:text-foreground'
                        )}
                        onClick={() => toggleDay(day)}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Every</span>
                  <Input
                    type="number"
                    min="1"
                    className="w-20"
                    value={formIntervalValue}
                    onChange={(event) => {
                      setFormIntervalValue(event.target.value)
                      setCreateError(null)
                    }}
                  />
                  <select
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                    value={formIntervalUnit}
                    onChange={(event) => {
                      setFormIntervalUnit(event.target.value as IntervalUnit)
                      setCreateError(null)
                    }}
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            {createError && <div className="mr-auto text-xs text-destructive">{createError}</div>}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={isCreating}
              onClick={closeFormDialog}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={!formName.trim() || !formPrompt.trim() || isCreating}
            >
              {isCreating
                ? editingAutomationId
                  ? 'Saving...'
                  : 'Creating...'
                : editingAutomationId
                  ? 'Save changes'
                  : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md gap-0 p-6">
          <DialogHeader className="pb-4">
            <DialogTitle>Delete automation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget
              ? `This will permanently delete "${deleteTarget.name}" and its execution history.`
              : ''}
          </p>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={() => void handleDelete()}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
