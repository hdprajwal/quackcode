import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CreateAutomationParams, UpdateAutomationParams } from '@shared/types/automation'

// ---- Capture ipcMain.handle registrations ----

const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))

vi.mock('../../services/automation.service', () => ({
  automationService: {
    list: vi.fn(),
    listAll: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
    getExecutions: vi.fn()
  }
}))

import { registerAutomationIpc } from '../automation.ipc'
import { automationService } from '../../services/automation.service'

// Cast to access mock functions
const mockService = automationService as unknown as Record<string, ReturnType<typeof vi.fn>>

describe('automation IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
    registerAutomationIpc()
  })

  it('should register all 8 automation channels', () => {
    expect(handlers.has('automation:list')).toBe(true)
    expect(handlers.has('automation:listAll')).toBe(true)
    expect(handlers.has('automation:get')).toBe(true)
    expect(handlers.has('automation:create')).toBe(true)
    expect(handlers.has('automation:update')).toBe(true)
    expect(handlers.has('automation:delete')).toBe(true)
    expect(handlers.has('automation:execute')).toBe(true)
    expect(handlers.has('automation:executions')).toBe(true)
  })

  it('automation:list should delegate to automationService.list', () => {
    const mockAutomations = [{ id: '1', name: 'Test' }]
    mockService.list.mockReturnValue(mockAutomations)

    const handler = handlers.get('automation:list')!
    const result = handler({}, 'proj-1')

    expect(mockService.list).toHaveBeenCalledWith('proj-1')
    expect(result).toEqual(mockAutomations)
  })

  it('automation:listAll should delegate to automationService.listAll', () => {
    const mockAutomations = [{ id: '1' }, { id: '2' }]
    mockService.listAll.mockReturnValue(mockAutomations)

    const handler = handlers.get('automation:listAll')!
    const result = handler({})

    expect(mockService.listAll).toHaveBeenCalled()
    expect(result).toEqual(mockAutomations)
  })

  it('automation:get should delegate to automationService.get', () => {
    const mockAutomation = { id: 'abc', name: 'Test' }
    mockService.get.mockReturnValue(mockAutomation)

    const handler = handlers.get('automation:get')!
    const result = handler({}, 'abc')

    expect(mockService.get).toHaveBeenCalledWith('abc')
    expect(result).toEqual(mockAutomation)
  })

  it('automation:create should delegate to automationService.create', () => {
    const params: CreateAutomationParams = {
      name: 'Test',
      projectIds: ['proj-1'],
      prompt: 'Do something',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      scheduleType: 'interval',
      intervalValue: 30,
      intervalUnit: 'minutes'
    }
    const mockResult = { id: 'new-1', ...params }
    mockService.create.mockReturnValue(mockResult)

    const handler = handlers.get('automation:create')!
    const result = handler({}, params)

    expect(mockService.create).toHaveBeenCalledWith(params)
    expect(result).toEqual(mockResult)
  })

  it('automation:update should delegate to automationService.update', () => {
    const params: UpdateAutomationParams = { id: 'abc', name: 'Updated' }
    const mockResult = { id: 'abc', name: 'Updated' }
    mockService.update.mockReturnValue(mockResult)

    const handler = handlers.get('automation:update')!
    const result = handler({}, params)

    expect(mockService.update).toHaveBeenCalledWith(params)
    expect(result).toEqual(mockResult)
  })

  it('automation:delete should delegate to automationService.delete', () => {
    const handler = handlers.get('automation:delete')!
    handler({}, 'abc')

    expect(mockService.delete).toHaveBeenCalledWith('abc')
  })

  it('automation:execute should delegate to automationService.execute', async () => {
    const mockExecution = { id: 'exec-1', status: 'running' }
    mockService.execute.mockResolvedValue(mockExecution)

    const handler = handlers.get('automation:execute')!
    const result = await handler({}, 'abc')

    expect(mockService.execute).toHaveBeenCalledWith('abc')
    expect(result).toEqual(mockExecution)
  })

  it('automation:executions should delegate to automationService.getExecutions', () => {
    const mockExecutions = [{ id: 'exec-1' }, { id: 'exec-2' }]
    mockService.getExecutions.mockReturnValue(mockExecutions)

    const handler = handlers.get('automation:executions')!
    const result = handler({}, 'abc')

    expect(mockService.getExecutions).toHaveBeenCalledWith('abc')
    expect(result).toEqual(mockExecutions)
  })
})
