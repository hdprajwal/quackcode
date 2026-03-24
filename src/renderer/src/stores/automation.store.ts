import { create } from 'zustand'
import type { Automation, AutomationExecution } from '@shared/types'

interface AutomationStore {
  automations: Automation[]
  selectedAutomationId: string | null
  executions: AutomationExecution[]

  setAutomations: (automations: Automation[]) => void
  addAutomation: (automation: Automation) => void
  updateAutomation: (automation: Automation) => void
  removeAutomation: (id: string) => void
  setSelectedAutomationId: (id: string | null) => void
  setExecutions: (executions: AutomationExecution[]) => void
  updateExecution: (execution: AutomationExecution) => void
}

export const useAutomationStore = create<AutomationStore>((set) => ({
  automations: [],
  selectedAutomationId: null,
  executions: [],

  setAutomations: (automations) => set({ automations }),
  addAutomation: (automation) =>
    set((s) => ({ automations: [automation, ...s.automations] })),
  updateAutomation: (automation) =>
    set((s) => ({
      automations: s.automations.map((a) => (a.id === automation.id ? automation : a))
    })),
  removeAutomation: (id) =>
    set((s) => ({
      automations: s.automations.filter((a) => a.id !== id),
      selectedAutomationId: s.selectedAutomationId === id ? null : s.selectedAutomationId
    })),
  setSelectedAutomationId: (id) => set({ selectedAutomationId: id }),
  setExecutions: (executions) => set({ executions }),
  updateExecution: (execution) =>
    set((s) => {
      const exists = s.executions.some((e) => e.id === execution.id)
      return {
        executions: exists
          ? s.executions.map((e) => (e.id === execution.id ? execution : e))
          : [execution, ...s.executions]
      }
    })
}))
