import { describe, it, expect, beforeEach } from 'vitest'
import { useAutomationStore } from '../automation.store'
import type { Automation, AutomationExecution } from '@shared/types/automation'

const makeAutomation = (overrides: Partial<Automation> = {}): Automation => ({
  id: 'auto-1',
  name: 'Test Automation',
  projectIds: ['proj-1'],
  prompt: 'Review code',
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  scheduleType: 'interval',
  intervalValue: 30,
  intervalUnit: 'minutes',
  scheduledTime: null,
  scheduledDays: [],
  status: 'active',
  lastRunAt: null,
  nextRunAt: '2026-01-15T10:30:00.000Z',
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-15T10:00:00.000Z',
  ...overrides
})

const makeExecution = (overrides: Partial<AutomationExecution> = {}): AutomationExecution => ({
  id: 'exec-1',
  automationId: 'auto-1',
  threadId: 'thread-1',
  status: 'running',
  error: null,
  startedAt: '2026-01-15T10:00:00.000Z',
  completedAt: null,
  ...overrides
})

describe('useAutomationStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAutomationStore.setState({
      automations: [],
      selectedAutomationId: null,
      executions: []
    })
  })

  describe('setAutomations', () => {
    it('should set the automations list', () => {
      const automations = [makeAutomation(), makeAutomation({ id: 'auto-2', name: 'Second' })]
      useAutomationStore.getState().setAutomations(automations)

      expect(useAutomationStore.getState().automations).toHaveLength(2)
      expect(useAutomationStore.getState().automations[0].id).toBe('auto-1')
    })
  })

  describe('addAutomation', () => {
    it('should prepend a new automation to the list', () => {
      useAutomationStore.getState().setAutomations([makeAutomation()])
      useAutomationStore.getState().addAutomation(makeAutomation({ id: 'auto-new', name: 'New' }))

      const { automations } = useAutomationStore.getState()
      expect(automations).toHaveLength(2)
      expect(automations[0].id).toBe('auto-new') // New one at front
    })
  })

  describe('updateAutomation', () => {
    it('should update an existing automation by id', () => {
      useAutomationStore.getState().setAutomations([makeAutomation()])
      useAutomationStore
        .getState()
        .updateAutomation(makeAutomation({ id: 'auto-1', name: 'Updated Name' }))

      const { automations } = useAutomationStore.getState()
      expect(automations[0].name).toBe('Updated Name')
    })

    it('should not change other automations', () => {
      useAutomationStore
        .getState()
        .setAutomations([makeAutomation(), makeAutomation({ id: 'auto-2', name: 'Other' })])
      useAutomationStore
        .getState()
        .updateAutomation(makeAutomation({ id: 'auto-1', name: 'Changed' }))

      const { automations } = useAutomationStore.getState()
      expect(automations.find((a) => a.id === 'auto-2')!.name).toBe('Other')
    })
  })

  describe('removeAutomation', () => {
    it('should remove the automation by id', () => {
      useAutomationStore
        .getState()
        .setAutomations([makeAutomation(), makeAutomation({ id: 'auto-2' })])
      useAutomationStore.getState().removeAutomation('auto-1')

      const { automations } = useAutomationStore.getState()
      expect(automations).toHaveLength(1)
      expect(automations[0].id).toBe('auto-2')
    })

    it('should clear selectedAutomationId if the removed automation was selected', () => {
      useAutomationStore.setState({ selectedAutomationId: 'auto-1' })
      useAutomationStore.getState().setAutomations([makeAutomation()])
      useAutomationStore.getState().removeAutomation('auto-1')

      expect(useAutomationStore.getState().selectedAutomationId).toBeNull()
    })

    it('should preserve selectedAutomationId if a different automation is removed', () => {
      useAutomationStore.setState({ selectedAutomationId: 'auto-2' })
      useAutomationStore
        .getState()
        .setAutomations([makeAutomation(), makeAutomation({ id: 'auto-2' })])
      useAutomationStore.getState().removeAutomation('auto-1')

      expect(useAutomationStore.getState().selectedAutomationId).toBe('auto-2')
    })
  })

  describe('setSelectedAutomationId', () => {
    it('should set the selected automation id', () => {
      useAutomationStore.getState().setSelectedAutomationId('auto-1')
      expect(useAutomationStore.getState().selectedAutomationId).toBe('auto-1')
    })

    it('should clear selection with null', () => {
      useAutomationStore.getState().setSelectedAutomationId('auto-1')
      useAutomationStore.getState().setSelectedAutomationId(null)
      expect(useAutomationStore.getState().selectedAutomationId).toBeNull()
    })
  })

  describe('setExecutions', () => {
    it('should set the executions list', () => {
      const executions = [makeExecution(), makeExecution({ id: 'exec-2' })]
      useAutomationStore.getState().setExecutions(executions)

      expect(useAutomationStore.getState().executions).toHaveLength(2)
    })
  })

  describe('updateExecution', () => {
    it('should update an existing execution', () => {
      useAutomationStore.getState().setExecutions([makeExecution()])
      useAutomationStore
        .getState()
        .updateExecution(makeExecution({ id: 'exec-1', status: 'completed' }))

      expect(useAutomationStore.getState().executions[0].status).toBe('completed')
    })

    it('should prepend a new execution if it does not exist', () => {
      useAutomationStore.getState().setExecutions([makeExecution()])
      useAutomationStore.getState().updateExecution(makeExecution({ id: 'exec-new' }))

      const { executions } = useAutomationStore.getState()
      expect(executions).toHaveLength(2)
      expect(executions[0].id).toBe('exec-new')
    })
  })
})
