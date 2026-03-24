import { useEffect, useCallback } from 'react'
import { invoke, on } from '@renderer/lib/ipc'
import { useAutomationStore } from '@renderer/stores/automation.store'
import type {
  Automation,
  AutomationExecution,
  AutomationEvent,
  CreateAutomationParams,
  UpdateAutomationParams
} from '@shared/types'

export function useAutomation(): {
  loadAutomations: () => Promise<void>
  createAutomation: (params: CreateAutomationParams) => Promise<Automation>
  updateAutomation: (params: UpdateAutomationParams) => Promise<Automation>
  deleteAutomation: (id: string) => Promise<void>
  executeAutomation: (id: string) => Promise<AutomationExecution>
  loadExecutions: (automationId: string) => Promise<void>
} {
  const {
    setAutomations,
    addAutomation,
    updateAutomation: updateInStore,
    removeAutomation,
    setExecutions,
    updateExecution
  } = useAutomationStore()

  // Listen for automation events from main process
  useEffect(() => {
    const cleanup = on('automation:event', (event: unknown) => {
      const e = event as AutomationEvent
      if (e.automation) {
        updateInStore(e.automation)
      }
      if (e.execution) {
        updateExecution(e.execution)
      }
    })
    return cleanup
  }, [updateInStore, updateExecution])

  const loadAutomations = useCallback(async () => {
    // Load all automations — both global and project-specific
    const automations = await invoke<Automation[]>('automation:listAll')
    setAutomations(automations)
  }, [setAutomations])

  const createAutomation = useCallback(
    async (params: CreateAutomationParams) => {
      const automation = await invoke<Automation>('automation:create', params)
      addAutomation(automation)
      return automation
    },
    [addAutomation]
  )

  const updateAutomationFn = useCallback(
    async (params: UpdateAutomationParams) => {
      const automation = await invoke<Automation>('automation:update', params)
      updateInStore(automation)
      return automation
    },
    [updateInStore]
  )

  const deleteAutomation = useCallback(
    async (id: string) => {
      await invoke('automation:delete', id)
      removeAutomation(id)
    },
    [removeAutomation]
  )

  const executeAutomation = useCallback(async (id: string) => {
    return invoke<AutomationExecution>('automation:execute', id)
  }, [])

  const loadExecutions = useCallback(
    async (automationId: string) => {
      const executions = await invoke<AutomationExecution[]>(
        'automation:executions',
        automationId
      )
      setExecutions(executions)
    },
    [setExecutions]
  )

  return {
    loadAutomations,
    createAutomation,
    updateAutomation: updateAutomationFn,
    deleteAutomation,
    executeAutomation,
    loadExecutions
  }
}
