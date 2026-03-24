import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CreateAutomationParams } from '@shared/types/automation'

// ---- In-memory DB mock ----
// Simulates better-sqlite3's prepare().run/get/all API using plain objects

type Row = Record<string, unknown>

class MockStatement {
  constructor(
    private store: MockDatabase,
    private sql: string
  ) {}

  run(...params: unknown[]): { changes: number } {
    return this.store.execRun(this.sql, params)
  }

  get(...params: unknown[]): Row | undefined {
    return this.store.execGet(this.sql, params)
  }

  all(...params: unknown[]): Row[] {
    return this.store.execAll(this.sql, params)
  }
}

class MockDatabase {
  tables: Record<string, Row[]> = {
    projects: [],
    threads: [],
    messages: [],
    automations: [],
    automation_executions: []
  }

  constructor() {
    // Seed test project
    this.tables.projects.push({
      id: 'proj-1',
      name: 'TestProject',
      path: '/tmp/test',
      last_opened_at: new Date().toISOString()
    })
  }

  pragma(): void {}

  prepare(sql: string): MockStatement {
    return new MockStatement(this, sql)
  }

  exec(): void {}

  execRun(sql: string, params: unknown[]): { changes: number } {
    const sqlLower = sql.toLowerCase().trim()

    if (sqlLower.startsWith('insert into automations')) {
      const columns =
        sql
          .match(/insert into automations\s*\(([^)]+)\)/i)?.[1]
          ?.split(',')
          .map((column) => column.trim()) ?? []

      const row: Row = {
        last_run_at: null,
        scheduled_days: ''
      }

      for (const [index, column] of columns.entries()) {
        row[column] = params[index]
      }

      this.tables.automations.push(row)
      return { changes: 1 }
    }

    if (sqlLower.startsWith('insert into automation_executions')) {
      this.tables.automation_executions.push({
        id: params[0] as string,
        automation_id: params[1] as string,
        thread_id: params[2] as string,
        status: 'running',
        error: null,
        started_at: params[3] as string,
        completed_at: null
      })
      return { changes: 1 }
    }

    if (sqlLower.startsWith('update automations set') && sqlLower.includes('last_run_at')) {
      // UPDATE automations SET last_run_at = ?, next_run_at = ?, updated_at = ? WHERE id = ?
      const id = params[params.length - 1] as string
      const row = this.tables.automations.find((r) => r.id === id)
      if (row) {
        row.last_run_at = params[0]
        row.next_run_at = params[1]
        row.updated_at = params[2]
        return { changes: 1 }
      }
      return { changes: 0 }
    }

    if (
      sqlLower.startsWith('update automations set') &&
      sqlLower.includes('next_run_at = ? where')
    ) {
      // UPDATE automations SET next_run_at = ? WHERE id = ?
      const row = this.tables.automations.find((r) => r.id === params[1])
      if (row) {
        row.next_run_at = params[0]
        return { changes: 1 }
      }
      return { changes: 0 }
    }

    if (sqlLower.startsWith('update automations set')) {
      // Generic dynamic update: parse SET clause fields from params
      // The params are: [...values, id]
      const id = params[params.length - 1] as string
      const row = this.tables.automations.find((r) => r.id === id)
      if (row) {
        // Extract field names from SQL SET clause
        const setClause = sql.match(/SET\s+(.+)\s+WHERE/i)?.[1] || ''
        const fields = setClause.split(',').map((f) => f.trim().split(/\s*=\s*/)[0])
        for (let i = 0; i < fields.length; i++) {
          row[fields[i]] = params[i]
        }
        return { changes: 1 }
      }
      return { changes: 0 }
    }

    if (sqlLower.startsWith('update automation_executions')) {
      const id = params[params.length - 1] as string
      const row = this.tables.automation_executions.find((r) => r.id === id)
      if (row) {
        if (sqlLower.includes('error')) {
          row.status = params[0]
          row.error = params[1]
          row.completed_at = params[2]
        } else {
          row.status = params[0]
          row.completed_at = params[1]
        }
        return { changes: 1 }
      }
      return { changes: 0 }
    }

    if (sqlLower.startsWith('delete from automations')) {
      const id = params[0] as string
      const before = this.tables.automations.length
      this.tables.automations = this.tables.automations.filter((r) => r.id !== id)
      this.tables.automation_executions = this.tables.automation_executions.filter(
        (r) => r.automation_id !== id
      )
      return { changes: before - this.tables.automations.length }
    }

    return { changes: 0 }
  }

  execGet(sql: string, params: unknown[]): Row | undefined {
    const sqlLower = sql.toLowerCase().trim()

    if (sqlLower.includes('from automations') && sqlLower.includes('where id')) {
      return this.tables.automations.find((r) => r.id === params[0]) as Row | undefined
    }

    return undefined
  }

  execAll(sql: string, params: unknown[]): Row[] {
    const sqlLower = sql.toLowerCase().trim()

    if (sqlLower.startsWith("pragma table_info('automations')")) {
      return [
        { name: 'id' },
        { name: 'name' },
        { name: 'project_ids' },
        { name: 'prompt' },
        { name: 'provider' },
        { name: 'model' },
        { name: 'schedule_type' },
        { name: 'interval_value' },
        { name: 'interval_unit' },
        { name: 'scheduled_time' },
        { name: 'scheduled_days' },
        { name: 'status' },
        { name: 'last_run_at' },
        { name: 'next_run_at' },
        { name: 'created_at' },
        { name: 'updated_at' }
      ]
    }

    // list() now filters in JS, so all queries hit the general "from automations order by" branch

    if (sqlLower.includes('from automations') && sqlLower.includes('order by')) {
      return [...this.tables.automations].sort(
        (a, b) =>
          new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
      ) as Row[]
    }

    if (
      sqlLower.includes('from automation_executions') &&
      sqlLower.includes('where automation_id')
    ) {
      return this.tables.automation_executions
        .filter((r) => r.automation_id === params[0])
        .sort(
          (a, b) =>
            new Date(b.started_at as string).getTime() - new Date(a.started_at as string).getTime()
        )
        .slice(0, 50) as Row[]
    }

    return []
  }
}

let mockDb: MockDatabase

vi.mock('../../db/database', () => ({
  getDatabase: () => mockDb
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => []
  }
}))

// Mock threadService
const mockCreateThread = vi.fn()
vi.mock('../thread.service', () => ({
  threadService: {
    createThread: (...args: unknown[]) => mockCreateThread(...args),
    getMessages: vi.fn().mockReturnValue([]),
    createMessage: vi.fn(),
    updateTitle: vi.fn(),
    getThread: vi.fn()
  }
}))

// Mock projectService
const mockGetProject = vi.fn()
vi.mock('../project.service', () => ({
  projectService: {
    getProject: (...args: unknown[]) => mockGetProject(...args)
  }
}))

// Mock agentService
const mockHandleMessage = vi.fn()
vi.mock('../agent.service', () => ({
  agentService: {
    handleMessage: (...args: unknown[]) => mockHandleMessage(...args)
  }
}))

// ---- Import AFTER mocks ----
import { AutomationService } from '../automation.service'

const defaultParams: CreateAutomationParams = {
  name: 'Daily Review',
  projectIds: ['proj-1'],
  prompt: 'Review all code changes for bugs',
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  scheduleType: 'interval',
  intervalValue: 30,
  intervalUnit: 'minutes'
}

describe('AutomationService', () => {
  let service: AutomationService

  beforeEach(() => {
    vi.useFakeTimers()
    mockDb = new MockDatabase()
    service = new AutomationService()

    mockCreateThread.mockReset()
    mockGetProject.mockReset()
    mockHandleMessage.mockReset()
  })

  afterEach(() => {
    service.stopAllSchedulers()
    vi.useRealTimers()
  })

  // =============================================
  //  CRUD Tests
  // =============================================

  describe('create', () => {
    it('should create an automation and return it', () => {
      const automation = service.create(defaultParams)

      expect(automation).toBeDefined()
      expect(automation.id).toBeTruthy()
      expect(automation.name).toBe('Daily Review')
      expect(automation.projectIds).toEqual(['proj-1'])
      expect(automation.prompt).toBe('Review all code changes for bugs')
      expect(automation.provider).toBe('anthropic')
      expect(automation.model).toBe('claude-sonnet-4-20250514')
      expect(automation.intervalValue).toBe(30)
      expect(automation.intervalUnit).toBe('minutes')
      expect(automation.status).toBe('active')
    })

    it('should set nextRunAt based on interval', () => {
      const now = new Date('2026-01-15T10:00:00.000Z')
      vi.setSystemTime(now)

      const automation = service.create(defaultParams)

      expect(automation.nextRunAt).toBeTruthy()
      const nextRun = new Date(automation.nextRunAt!)
      expect(nextRun.getTime()).toBe(now.getTime() + 30 * 60 * 1000)
    })

    it('should persist the automation to the database', () => {
      const automation = service.create(defaultParams)
      const fetched = service.get(automation.id)

      expect(fetched).toBeDefined()
      expect(fetched!.id).toBe(automation.id)
      expect(fetched!.name).toBe(automation.name)
    })
  })

  describe('get', () => {
    it('should return null for non-existent automation', () => {
      const result = service.get('non-existent-id')
      expect(result).toBeNull()
    })

    it('should return the automation by id', () => {
      const created = service.create(defaultParams)
      const fetched = service.get(created.id)

      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.prompt).toBe(defaultParams.prompt)
    })
  })

  describe('list', () => {
    it('should return empty array when no automations exist', () => {
      const result = service.list('proj-1')
      expect(result).toEqual([])
    })

    it('should return automations for a specific project', () => {
      service.create(defaultParams)
      service.create({ ...defaultParams, name: 'Second Automation' })

      const result = service.list('proj-1')
      expect(result).toHaveLength(2)
    })

    it('should not return automations from other projects', () => {
      service.create(defaultParams)

      const result = service.list('other-project')
      expect(result).toEqual([])
    })
  })

  describe('listAll', () => {
    it('should return all automations across projects', () => {
      service.create(defaultParams)

      const all = service.listAll()
      expect(all.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('update', () => {
    it('should update the name', () => {
      const automation = service.create(defaultParams)
      const updated = service.update({ id: automation.id, name: 'New Name' })

      expect(updated.name).toBe('New Name')
      expect(updated.prompt).toBe(defaultParams.prompt)
    })

    it('should update the status to paused', () => {
      const automation = service.create(defaultParams)
      const updated = service.update({ id: automation.id, status: 'paused' })

      expect(updated.status).toBe('paused')
    })

    it('should update the interval', () => {
      const automation = service.create(defaultParams)
      const updated = service.update({
        id: automation.id,
        intervalValue: 2,
        intervalUnit: 'hours'
      })

      expect(updated.intervalValue).toBe(2)
      expect(updated.intervalUnit).toBe('hours')
    })

    it('should throw for non-existent automation', () => {
      expect(() => service.update({ id: 'non-existent' })).toThrow('Automation not found')
    })

    it('should update updatedAt timestamp', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'))
      const automation = service.create(defaultParams)

      vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))
      const updated = service.update({ id: automation.id, name: 'Updated' })

      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
        new Date(automation.updatedAt).getTime()
      )
    })
  })

  describe('delete', () => {
    it('should remove the automation from the database', () => {
      const automation = service.create(defaultParams)
      service.delete(automation.id)

      const fetched = service.get(automation.id)
      expect(fetched).toBeNull()
    })

    it('should not throw when deleting non-existent automation', () => {
      expect(() => service.delete('non-existent')).not.toThrow()
    })
  })

  // =============================================
  //  Interval Computation Tests
  // =============================================

  describe('interval computation', () => {
    it('should compute correct nextRunAt for minutes', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'))

      const automation = service.create({
        ...defaultParams,
        intervalValue: 15,
        intervalUnit: 'minutes'
      })

      const nextRun = new Date(automation.nextRunAt!)
      expect(nextRun.toISOString()).toBe('2026-01-15T10:15:00.000Z')
    })

    it('should compute correct nextRunAt for hours', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'))

      const automation = service.create({
        ...defaultParams,
        intervalValue: 3,
        intervalUnit: 'hours'
      })

      const nextRun = new Date(automation.nextRunAt!)
      expect(nextRun.toISOString()).toBe('2026-01-15T13:00:00.000Z')
    })

    it('should compute correct nextRunAt for days', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'))

      const automation = service.create({
        ...defaultParams,
        intervalValue: 1,
        intervalUnit: 'days'
      })

      const nextRun = new Date(automation.nextRunAt!)
      expect(nextRun.toISOString()).toBe('2026-01-16T10:00:00.000Z')
    })
  })

  // =============================================
  //  Scheduling Tests
  // =============================================

  describe('scheduling', () => {
    it('should schedule a timer on create', () => {
      service.create(defaultParams)
      expect(service['timers'].size).toBe(1)
    })

    it('should clear timer when automation is paused', () => {
      const automation = service.create(defaultParams)
      expect(service['timers'].size).toBe(1)

      service.update({ id: automation.id, status: 'paused' })
      expect(service['timers'].size).toBe(0)
    })

    it('should reschedule when interval changes', () => {
      const automation = service.create(defaultParams)
      const originalTimerId = service['timers'].get(automation.id)

      service.update({ id: automation.id, intervalValue: 60 })
      const newTimerId = service['timers'].get(automation.id)

      expect(newTimerId).not.toBe(originalTimerId)
    })

    it('should clear timer on delete', () => {
      const automation = service.create(defaultParams)
      expect(service['timers'].size).toBe(1)

      service.delete(automation.id)
      expect(service['timers'].size).toBe(0)
    })

    it('should stop all timers on stopAllSchedulers', () => {
      service.create(defaultParams)
      service.create({ ...defaultParams, name: 'Second' })
      expect(service['timers'].size).toBe(2)

      service.stopAllSchedulers()
      expect(service['timers'].size).toBe(0)
    })

    it('should start schedulers for all active automations', () => {
      service.create(defaultParams)
      const a2 = service.create({ ...defaultParams, name: 'Second' })
      service.update({ id: a2.id, status: 'paused' })

      service.stopAllSchedulers()
      expect(service['timers'].size).toBe(0)

      service.startAllSchedulers()
      expect(service['timers'].size).toBe(1)
    })
  })

  // =============================================
  //  Execution Tests
  // =============================================

  describe('execute', () => {
    beforeEach(() => {
      mockGetProject.mockImplementation((projectId: string) => ({
        id: projectId,
        name: projectId === 'proj-2' ? 'SecondProject' : 'TestProject',
        path: projectId === 'proj-2' ? '/tmp/test-2' : '/tmp/test',
        lastOpenedAt: new Date().toISOString()
      }))

      mockCreateThread.mockReturnValue({
        id: 'thread-123',
        title: '[Auto] Daily Review',
        projectId: 'proj-1',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      mockHandleMessage.mockResolvedValue(undefined)
    })

    it('should create a new thread for each execution', async () => {
      const automation = service.create(defaultParams)
      await service.execute(automation.id)

      expect(mockCreateThread).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514'
        })
      )
    })

    it('should call agentService.handleMessage with the automation prompt', async () => {
      const automation = service.create(defaultParams)
      await service.execute(automation.id)

      expect(mockHandleMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: 'thread-123',
          content: 'Review all code changes for bugs',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          projectPath: '/tmp/test',
          environmentMode: 'local'
        })
      )
    })

    it('should return an execution record with running status', async () => {
      const automation = service.create(defaultParams)
      const execution = await service.execute(automation.id)

      expect(execution).toBeDefined()
      expect(execution.automationId).toBe(automation.id)
      expect(execution.threadId).toBe('thread-123')
      expect(execution.status).toBe('running')
      expect(execution.startedAt).toBeTruthy()
    })

    it('should update lastRunAt after execution', async () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'))
      const automation = service.create(defaultParams)

      vi.setSystemTime(new Date('2026-01-15T10:30:00.000Z'))
      await service.execute(automation.id)

      const updated = service.get(automation.id)
      expect(updated!.lastRunAt).toBeTruthy()
      expect(new Date(updated!.lastRunAt!).toISOString()).toBe('2026-01-15T10:30:00.000Z')
    })

    it('should update nextRunAt after execution', async () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'))
      const automation = service.create(defaultParams)

      vi.setSystemTime(new Date('2026-01-15T10:30:00.000Z'))
      await service.execute(automation.id)

      const updated = service.get(automation.id)
      expect(new Date(updated!.nextRunAt!).toISOString()).toBe('2026-01-15T11:00:00.000Z')
    })

    it('should throw for non-existent automation', async () => {
      await expect(service.execute('non-existent')).rejects.toThrow('Automation not found')
    })

    it('should throw for non-existent project', async () => {
      mockGetProject.mockReturnValue(null)
      const automation = service.create(defaultParams)

      await expect(service.execute(automation.id)).rejects.toThrow('Project not found')
    })

    it('should record execution in the database', async () => {
      const automation = service.create(defaultParams)
      await service.execute(automation.id)

      const executions = service.getExecutions(automation.id)
      expect(executions).toHaveLength(1)
      expect(executions[0].automationId).toBe(automation.id)
      expect(executions[0].threadId).toBe('thread-123')
    })

    it('should execute once per assigned project', async () => {
      mockCreateThread
        .mockReturnValueOnce({
          id: 'thread-1',
          title: '[Auto] Daily Review - TestProject',
          projectId: 'proj-1',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .mockReturnValueOnce({
          id: 'thread-2',
          title: '[Auto] Daily Review - SecondProject',
          projectId: 'proj-2',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })

      const automation = service.create({
        ...defaultParams,
        projectIds: ['proj-1', 'proj-2']
      })

      const execution = await service.execute(automation.id)

      expect(execution.threadId).toBe('thread-1')
      expect(mockGetProject).toHaveBeenCalledWith('proj-1')
      expect(mockGetProject).toHaveBeenCalledWith('proj-2')
      expect(mockCreateThread).toHaveBeenCalledTimes(2)
      expect(mockHandleMessage).toHaveBeenCalledTimes(2)
      expect(mockHandleMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          threadId: 'thread-1',
          projectPath: '/tmp/test'
        })
      )
      expect(mockHandleMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          threadId: 'thread-2',
          projectPath: '/tmp/test-2'
        })
      )

      const executions = service.getExecutions(automation.id)
      expect(executions).toHaveLength(2)
      expect(executions.map((item) => item.threadId)).toEqual(['thread-1', 'thread-2'])
    })
  })

  // =============================================
  //  Execution History Tests
  // =============================================

  describe('getExecutions', () => {
    it('should return empty array when no executions exist', () => {
      const automation = service.create(defaultParams)
      const executions = service.getExecutions(automation.id)
      expect(executions).toEqual([])
    })

    it('should return executions in descending order by startedAt', async () => {
      mockGetProject.mockReturnValue({
        id: 'proj-1',
        name: 'TestProject',
        path: '/tmp/test',
        lastOpenedAt: new Date().toISOString()
      })
      mockCreateThread.mockReturnValue({
        id: 'thread-1',
        title: 'Test',
        projectId: 'proj-1',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      mockHandleMessage.mockResolvedValue(undefined)

      const automation = service.create(defaultParams)

      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'))
      await service.execute(automation.id)

      mockCreateThread.mockReturnValue({
        id: 'thread-2',
        title: 'Test 2',
        projectId: 'proj-1',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      vi.setSystemTime(new Date('2026-01-15T11:00:00.000Z'))
      await service.execute(automation.id)

      const executions = service.getExecutions(automation.id)
      expect(executions).toHaveLength(2)
      expect(new Date(executions[0].startedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(executions[1].startedAt).getTime()
      )
    })
  })

  // =============================================
  //  Project-independent automations
  // =============================================

  describe('project-independent automations', () => {
    it('should create an automation without projectIds', () => {
      const automation = service.create({
        ...defaultParams,
        projectIds: []
      })

      expect(automation).toBeDefined()
      expect(automation.projectIds).toEqual([])
      expect(automation.name).toBe('Daily Review')
      expect(automation.status).toBe('active')
    })

    it('should persist and retrieve a global automation', () => {
      const automation = service.create({
        ...defaultParams,
        name: 'Global Cleanup',
        prompt: 'Clean up temp files',
        projectIds: []
      })

      const fetched = service.get(automation.id)
      expect(fetched).not.toBeNull()
      expect(fetched!.projectIds).toEqual([])
    })

    it('should include global automations in listAll', () => {
      service.create(defaultParams) // project-bound
      service.create({ ...defaultParams, name: 'Global Task', projectIds: [] })

      const all = service.listAll()
      expect(all).toHaveLength(2)
    })

    it('should NOT include global automations in project-specific list', () => {
      service.create(defaultParams) // project-bound
      service.create({ ...defaultParams, name: 'Global Task', projectIds: [] })

      const projectAutomations = service.list('proj-1')
      expect(projectAutomations).toHaveLength(1)
      expect(projectAutomations[0].name).toBe('Daily Review')
    })

    it('should support multiple projectIds', () => {
      const automation = service.create({
        ...defaultParams,
        name: 'Multi-project',
        projectIds: ['proj-1', 'proj-2']
      })

      expect(automation.projectIds).toEqual(['proj-1', 'proj-2'])
      expect(service.list('proj-1')).toHaveLength(1)
      expect(service.list('proj-2')).toHaveLength(1)
    })

    it('should execute a global automation without a project', async () => {
      mockCreateThread.mockReturnValue({
        id: 'thread-global',
        title: '[Auto] Global Task',
        projectId: '',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      mockHandleMessage.mockResolvedValue(undefined)

      const automation = service.create({
        ...defaultParams,
        name: 'Global Task',
        prompt: 'Do something global',
        projectIds: []
      })

      const execution = await service.execute(automation.id)

      expect(execution).toBeDefined()
      expect(execution.status).toBe('running')
      expect(mockGetProject).not.toHaveBeenCalled()
      expect(mockHandleMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Do something global',
          projectPath: ''
        })
      )
    })
  })

  // =============================================
  //  Timer-based auto-execution test
  // =============================================

  describe('automatic scheduled execution', () => {
    it('should execute automation when timer fires', async () => {
      mockGetProject.mockReturnValue({
        id: 'proj-1',
        name: 'TestProject',
        path: '/tmp/test',
        lastOpenedAt: new Date().toISOString()
      })
      mockCreateThread.mockReturnValue({
        id: 'thread-auto',
        title: 'Auto',
        projectId: 'proj-1',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      mockHandleMessage.mockResolvedValue(undefined)

      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'))
      service.create({ ...defaultParams, intervalValue: 10, intervalUnit: 'minutes' })

      await vi.advanceTimersByTimeAsync(10 * 60 * 1000)

      expect(mockHandleMessage).toHaveBeenCalled()
    })
  })
})
