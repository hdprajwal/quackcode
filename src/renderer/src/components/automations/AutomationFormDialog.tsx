import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Clock, Sparkles, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
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
import { PROVIDER_LABELS } from '@renderer/lib/provider-labels'
import { cn } from '@renderer/lib/utils'
import type {
  AIModel,
  AIProvider,
  Automation,
  CreateAutomationParams,
  DayOfWeek,
  IntervalUnit,
  Project,
  ScheduleType
} from '@shared/types'
import { DAYS_OF_WEEK } from '@shared/types'
import { getProviderLogo, to12Hour, to24Hour } from './automation-utils'

interface AutomationFormDialogProps {
  open: boolean
  editingAutomation: Automation | null
  projects: Project[]
  models: AIModel[]
  defaultProvider: AIProvider
  defaultModel: string
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: CreateAutomationParams) => Promise<void>
}

interface AutomationFormState {
  name: string
  prompt: string
  projectIds: string[]
  provider: AIProvider
  model: string
  scheduleType: ScheduleType
  timeHours: string
  timeMinutes: string
  timePeriod: 'AM' | 'PM'
  days: DayOfWeek[]
  intervalValue: string
  intervalUnit: IntervalUnit
}

function buildFormState(
  editingAutomation: Automation | null,
  defaultProvider: AIProvider,
  defaultModel: string
): AutomationFormState {
  if (!editingAutomation) {
    return {
      name: '',
      prompt: '',
      projectIds: [],
      provider: defaultProvider,
      model: defaultModel,
      scheduleType: 'daily',
      timeHours: '06',
      timeMinutes: '00',
      timePeriod: 'PM',
      days: [...DAYS_OF_WEEK],
      intervalValue: '30',
      intervalUnit: 'minutes'
    }
  }

  const time = to12Hour(editingAutomation.scheduledTime)

  return {
    name: editingAutomation.name,
    prompt: editingAutomation.prompt,
    projectIds: editingAutomation.projectIds,
    provider: editingAutomation.provider,
    model: editingAutomation.model,
    scheduleType: editingAutomation.scheduleType,
    timeHours: time.hours,
    timeMinutes: time.minutes,
    timePeriod: time.period,
    days:
      editingAutomation.scheduleType === 'daily' && editingAutomation.scheduledDays.length > 0
        ? editingAutomation.scheduledDays
        : [...DAYS_OF_WEEK],
    intervalValue: String(editingAutomation.intervalValue),
    intervalUnit: editingAutomation.intervalUnit
  }
}

export function AutomationFormDialog({
  open,
  editingAutomation,
  projects,
  models,
  defaultProvider,
  defaultModel,
  onOpenChange,
  onSubmit
}: AutomationFormDialogProps): React.JSX.Element {
  const [form, setForm] = useState<AutomationFormState>(() =>
    buildFormState(editingAutomation, defaultProvider, defaultModel)
  )
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const workspaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    setForm(buildFormState(editingAutomation, defaultProvider, defaultModel))
    setModelSelectorOpen(false)
    setWorkspaceDropdownOpen(false)
    setError(null)
    setIsSubmitting(false)
  }, [open, editingAutomation, defaultProvider, defaultModel])

  useEffect(() => {
    if (!workspaceDropdownOpen) return

    const handleMouseDown = (event: MouseEvent): void => {
      if (workspaceRef.current && !workspaceRef.current.contains(event.target as Node)) {
        setWorkspaceDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [workspaceDropdownOpen])

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
    () =>
      models.find((model) => model.id === form.model && model.provider === form.provider) ?? null,
    [form.model, form.provider, models]
  )

  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects]
  )

  function setField<K extends keyof AutomationFormState>(
    key: K,
    value: AutomationFormState[K]
  ): void {
    setForm((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  const toggleProjectId = (projectId: string): void => {
    setError(null)
    setForm((current) => ({
      ...current,
      projectIds: current.projectIds.includes(projectId)
        ? current.projectIds.filter((id) => id !== projectId)
        : [...current.projectIds, projectId]
    }))
  }

  const toggleDay = (day: DayOfWeek): void => {
    setError(null)
    setForm((current) => ({
      ...current,
      days: current.days.includes(day)
        ? current.days.filter((currentDay) => currentDay !== day)
        : [...current.days, day]
    }))
  }

  const handleSubmit = async (): Promise<void> => {
    if (!form.name.trim() || !form.prompt.trim()) {
      setError('Add a name and prompt to create the automation.')
      return
    }

    if (form.scheduleType === 'interval') {
      const intervalValue = parseInt(form.intervalValue, 10)

      if (Number.isNaN(intervalValue) || intervalValue < 1) {
        setError('Enter a valid interval greater than 0.')
        return
      }
    }

    if (form.scheduleType === 'daily') {
      const hours = parseInt(form.timeHours, 10)
      const minutes = parseInt(form.timeMinutes, 10)

      if (
        Number.isNaN(hours) ||
        hours < 1 ||
        hours > 12 ||
        Number.isNaN(minutes) ||
        minutes < 0 ||
        minutes > 59
      ) {
        setError('Enter a valid time for the daily schedule.')
        return
      }
    }

    setError(null)
    setIsSubmitting(true)

    try {
      await onSubmit({
        name: form.name.trim(),
        prompt: form.prompt.trim(),
        provider: form.provider,
        model: form.model,
        scheduleType: form.scheduleType,
        intervalValue: form.scheduleType === 'interval' ? parseInt(form.intervalValue, 10) : 1,
        intervalUnit: form.scheduleType === 'interval' ? form.intervalUnit : 'days',
        scheduledTime:
          form.scheduleType === 'daily'
            ? to24Hour(form.timeHours, form.timeMinutes, form.timePeriod)
            : null,
        scheduledDays: form.scheduleType === 'daily' ? form.days : [],
        projectIds: form.projectIds
      })
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : editingAutomation
            ? 'Failed to update automation.'
            : 'Failed to create automation.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 p-6 sm:max-w-xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-5">
          <DialogTitle className="text-lg font-bold">
            {editingAutomation ? 'Edit automation' : 'Create automation'}
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
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
            />
          </div>

          <div ref={workspaceRef} className="relative">
            <label className="mb-2 block text-sm font-semibold">Workspaces</label>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-sm"
              onClick={() => setWorkspaceDropdownOpen((current) => !current)}
            >
              {form.projectIds.length === 0 ? (
                <span className="text-muted-foreground">Choose a folder</span>
              ) : (
                <div className="flex flex-1 flex-wrap gap-1">
                  {form.projectIds.map((projectId) => (
                    <span
                      key={projectId}
                      className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-xs"
                    >
                      {projectNameById.get(projectId) || projectId}
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
                  ))}
                </div>
              )}
              <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>

            {workspaceDropdownOpen ? (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-background py-1 shadow-lg">
                {projects.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No projects available
                  </div>
                ) : (
                  projects.map((project) => {
                    const isSelected = form.projectIds.includes(project.id)

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
                            isSelected ? 'border-foreground bg-foreground' : 'border-border'
                          )}
                        >
                          {isSelected ? <Check className="h-3 w-3 text-background" /> : null}
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
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">Prompt</label>
            <Textarea
              placeholder="e.g. Review all changed files for bugs, security issues, and code quality."
              rows={3}
              value={form.prompt}
              onChange={(event) => setField('prompt', event.target.value)}
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
                      {selectedFormModel?.name ?? form.model}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {selectedFormModel
                        ? PROVIDER_LABELS[selectedFormModel.provider]
                        : PROVIDER_LABELS[form.provider]}
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
                          model.id === form.model && model.provider === form.provider

                        return (
                          <ModelSelectorItem
                            key={`${model.provider}-${model.id}`}
                            value={`${model.name} ${model.id} ${PROVIDER_LABELS[model.provider]}`}
                            onSelect={() => {
                              setForm((current) => ({
                                ...current,
                                provider: model.provider,
                                model: model.id
                              }))
                              setModelSelectorOpen(false)
                              setError(null)
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
                    form.scheduleType === 'daily'
                      ? 'bg-foreground font-medium text-background'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setField('scheduleType', 'daily')}
                >
                  Daily
                </button>
                <button
                  type="button"
                  className={cn(
                    'px-3 py-1 transition-colors',
                    form.scheduleType === 'interval'
                      ? 'bg-foreground font-medium text-background'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setField('scheduleType', 'interval')}
                >
                  Interval
                </button>
              </div>
            </div>

            {form.scheduleType === 'daily' ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-md border border-border px-3 py-2">
                  <input
                    type="text"
                    className="w-6 bg-transparent text-center text-sm outline-none"
                    value={form.timeHours}
                    maxLength={2}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, '')

                      if (value === '' || (parseInt(value, 10) >= 1 && parseInt(value, 10) <= 12)) {
                        setField('timeHours', value)
                      }
                    }}
                  />
                  <span className="text-muted-foreground">:</span>
                  <input
                    type="text"
                    className="w-6 bg-transparent text-center text-sm outline-none"
                    value={form.timeMinutes}
                    maxLength={2}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, '')

                      if (value === '' || (parseInt(value, 10) >= 0 && parseInt(value, 10) <= 59)) {
                        setField('timeMinutes', value)
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="ml-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => setField('timePeriod', form.timePeriod === 'AM' ? 'PM' : 'AM')}
                  >
                    {form.timePeriod}
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
                        form.days.includes(day)
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
                  value={form.intervalValue}
                  onChange={(event) => setField('intervalValue', event.target.value)}
                />
                <select
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={form.intervalUnit}
                  onChange={(event) => setField('intervalUnit', event.target.value as IntervalUnit)}
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
          {error ? <div className="mr-auto text-xs text-destructive">{error}</div> : null}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={!form.name.trim() || !form.prompt.trim() || isSubmitting}
          >
            {isSubmitting
              ? editingAutomation
                ? 'Saving...'
                : 'Creating...'
              : editingAutomation
                ? 'Save changes'
                : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
