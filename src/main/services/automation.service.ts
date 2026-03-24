import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/database'
import { threadService } from './thread.service'
import { projectService } from './project.service'
import { agentService } from './agent.service'
import type {
  Automation,
  AutomationExecution,
  AutomationEvent,
  CreateAutomationParams,
  UpdateAutomationParams,
  IntervalUnit,
  DayOfWeek
} from '@shared/types'

function intervalToMs(value: number, unit: IntervalUnit): number {
  switch (unit) {
    case 'minutes':
      return value * 60 * 1000
    case 'hours':
      return value * 60 * 60 * 1000
    case 'days':
      return value * 24 * 60 * 60 * 1000
  }
}

function computeNextRunAt(now: Date, intervalValue: number, intervalUnit: IntervalUnit): string {
  return new Date(now.getTime() + intervalToMs(intervalValue, intervalUnit)).toISOString()
}

const DAY_INDEX_MAP: Record<DayOfWeek, number> = {
  Su: 0,
  Mo: 1,
  Tu: 2,
  We: 3,
  Th: 4,
  Fr: 5,
  Sa: 6
}

function computeNextDailyRunAt(now: Date, time: string, days: DayOfWeek[]): string {
  if (days.length === 0) return computeNextRunAt(now, 1, 'days')

  const [hours, minutes] = time.split(':').map(Number)
  const dayIndices = days.map((d) => DAY_INDEX_MAP[d])

  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now)
    candidate.setDate(candidate.getDate() + offset)
    candidate.setHours(hours, minutes, 0, 0)

    if (candidate.getTime() <= now.getTime()) continue
    if (dayIndices.includes(candidate.getDay())) {
      return candidate.toISOString()
    }
  }

  return computeNextRunAt(now, 1, 'days')
}

export class AutomationService {
  private timers = new Map<string, ReturnType<typeof setTimeout>>()

  create(params: CreateAutomationParams): Automation {
    const db = getDatabase()
    const columns = this.getAutomationColumns()
    const hasLegacyProjectId = columns.has('project_id')
    const id = uuidv4()
    const now = new Date()
    const nowStr = now.toISOString()
    const projectIds = params.projectIds ?? []
    const scheduleType = params.scheduleType ?? 'interval'
    const scheduledTime = params.scheduledTime ?? null
    const scheduledDays = params.scheduledDays ?? []

    const nextRunAt =
      scheduleType === 'daily' && scheduledTime
        ? computeNextDailyRunAt(now, scheduledTime, scheduledDays)
        : computeNextRunAt(now, params.intervalValue, params.intervalUnit)

    const insertColumns = [
      'id',
      'name',
      ...(hasLegacyProjectId ? ['project_id'] : []),
      'project_ids',
      'prompt',
      'provider',
      'model',
      'schedule_type',
      'interval_value',
      'interval_unit',
      'scheduled_time',
      'scheduled_days',
      'status',
      'next_run_at',
      'created_at',
      'updated_at'
    ]
    const insertValues = [
      id,
      params.name,
      ...(hasLegacyProjectId ? [projectIds[0] ?? ''] : []),
      projectIds.join(','),
      params.prompt,
      params.provider,
      params.model,
      scheduleType,
      params.intervalValue,
      params.intervalUnit,
      scheduledTime,
      scheduledDays.join(','),
      'active',
      nextRunAt,
      nowStr,
      nowStr
    ]

    db.prepare(
      `INSERT INTO automations (${insertColumns.join(', ')}) VALUES (${insertColumns.map(() => '?').join(', ')})`
    ).run(...insertValues)

    const automation = this.get(id)!
    this.scheduleAutomation(automation)
    return automation
  }

  get(id: string): Automation | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM automations WHERE id = ?').get(id) as
      | Record<string, string>
      | undefined
    return row ? this.toAutomation(row) : null
  }

  list(projectId: string): Automation[] {
    const db = getDatabase()
    // Find automations that include this project ID
    const rows = db.prepare('SELECT * FROM automations ORDER BY created_at DESC').all() as Record<
      string,
      string
    >[]
    return rows
      .filter((r) => {
        const ids = (r.project_ids || '').split(',').filter(Boolean)
        return ids.includes(projectId)
      })
      .map(this.toAutomation)
  }

  listAll(): Automation[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM automations ORDER BY created_at DESC').all() as Record<
      string,
      string
    >[]
    return rows.map(this.toAutomation)
  }

  update(params: UpdateAutomationParams): Automation {
    const db = getDatabase()
    const columns = this.getAutomationColumns()
    const hasLegacyProjectId = columns.has('project_id')
    const existing = this.get(params.id)
    if (!existing) throw new Error(`Automation not found: ${params.id}`)

    const updates: string[] = []
    const values: unknown[] = []

    if (params.name !== undefined) {
      updates.push('name = ?')
      values.push(params.name)
    }
    if (params.prompt !== undefined) {
      updates.push('prompt = ?')
      values.push(params.prompt)
    }
    if (params.provider !== undefined) {
      updates.push('provider = ?')
      values.push(params.provider)
    }
    if (params.model !== undefined) {
      updates.push('model = ?')
      values.push(params.model)
    }
    if (params.projectIds !== undefined) {
      if (hasLegacyProjectId) {
        updates.push('project_id = ?')
        values.push(params.projectIds[0] ?? '')
      }
      updates.push('project_ids = ?')
      values.push(params.projectIds.join(','))
    }
    if (params.scheduleType !== undefined) {
      updates.push('schedule_type = ?')
      values.push(params.scheduleType)
    }
    if (params.intervalValue !== undefined) {
      updates.push('interval_value = ?')
      values.push(params.intervalValue)
    }
    if (params.intervalUnit !== undefined) {
      updates.push('interval_unit = ?')
      values.push(params.intervalUnit)
    }
    if (params.scheduledTime !== undefined) {
      updates.push('scheduled_time = ?')
      values.push(params.scheduledTime)
    }
    if (params.scheduledDays !== undefined) {
      updates.push('scheduled_days = ?')
      values.push(params.scheduledDays.join(','))
    }
    if (params.status !== undefined) {
      updates.push('status = ?')
      values.push(params.status)
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?')
      values.push(new Date().toISOString())
      values.push(params.id)

      db.prepare(`UPDATE automations SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    }

    const updated = this.get(params.id)!

    this.clearTimer(params.id)
    if (updated.status === 'active') {
      const scheduleChanged =
        params.intervalValue !== undefined ||
        params.intervalUnit !== undefined ||
        params.scheduleType !== undefined ||
        params.scheduledTime !== undefined ||
        params.scheduledDays !== undefined

      if (scheduleChanged) {
        const now = new Date()
        const nextRunAt =
          updated.scheduleType === 'daily' && updated.scheduledTime
            ? computeNextDailyRunAt(now, updated.scheduledTime, updated.scheduledDays)
            : computeNextRunAt(now, updated.intervalValue, updated.intervalUnit)
        db.prepare('UPDATE automations SET next_run_at = ? WHERE id = ?').run(nextRunAt, params.id)
      }
      this.scheduleAutomation(this.get(params.id)!)
    }

    this.broadcastEvent({
      type: 'automation:updated',
      automation: this.get(params.id)!
    })

    return this.get(params.id)!
  }

  delete(id: string): void {
    this.clearTimer(id)
    const db = getDatabase()
    db.prepare('DELETE FROM automations WHERE id = ?').run(id)
  }

  async execute(automationId: string): Promise<AutomationExecution> {
    const automation = this.get(automationId)
    if (!automation) throw new Error(`Automation not found: ${automationId}`)

    const executionTargets =
      automation.projectIds.length > 0
        ? automation.projectIds.map((projectId) => {
            const project = projectService.getProject(projectId)
            if (!project) throw new Error(`Project not found: ${projectId}`)

            return {
              projectId,
              projectName: project.name,
              projectPath: project.path
            }
          })
        : [
            {
              projectId: '',
              projectName: '',
              projectPath: ''
            }
          ]

    const db = getDatabase()
    const startedAt = new Date().toISOString()

    const now = new Date()
    const nextRunAt =
      automation.scheduleType === 'daily' && automation.scheduledTime
        ? computeNextDailyRunAt(now, automation.scheduledTime, automation.scheduledDays)
        : computeNextRunAt(now, automation.intervalValue, automation.intervalUnit)
    db.prepare(
      'UPDATE automations SET last_run_at = ?, next_run_at = ?, updated_at = ? WHERE id = ?'
    ).run(now.toISOString(), nextRunAt, now.toISOString(), automationId)

    const executions = executionTargets.map((target) => {
      const executionId = uuidv4()
      const titleParts = ['[Auto]', automation.name]

      if (target.projectName) {
        titleParts.push('-', target.projectName)
      }

      titleParts.push('-', new Date().toLocaleString())

      const thread = threadService.createThread({
        projectId: target.projectId,
        provider: automation.provider,
        model: automation.model,
        title: titleParts.join(' ')
      })

      db.prepare(
        `INSERT INTO automation_executions (id, automation_id, thread_id, status, started_at)
         VALUES (?, ?, ?, 'running', ?)`
      ).run(executionId, automationId, thread.id, startedAt)

      const execution: AutomationExecution = {
        id: executionId,
        automationId,
        threadId: thread.id,
        status: 'running',
        error: null,
        startedAt,
        completedAt: null
      }

      this.broadcastEvent({
        type: 'automation:started',
        automation: this.get(automationId)!,
        execution
      })

      agentService
        .handleMessage({
          threadId: thread.id,
          content: automation.prompt,
          provider: automation.provider,
          model: automation.model,
          projectPath: target.projectPath,
          environmentMode: 'local'
        })
        .then(() => {
          const completedAt = new Date().toISOString()
          db.prepare(
            'UPDATE automation_executions SET status = ?, completed_at = ? WHERE id = ?'
          ).run('completed', completedAt, executionId)

          this.broadcastEvent({
            type: 'automation:completed',
            automation: this.get(automationId)!,
            execution: {
              ...execution,
              status: 'completed',
              completedAt
            }
          })
        })
        .catch((error: unknown) => {
          const completedAt = new Date().toISOString()
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          db.prepare(
            'UPDATE automation_executions SET status = ?, error = ?, completed_at = ? WHERE id = ?'
          ).run('failed', errorMsg, completedAt, executionId)

          this.broadcastEvent({
            type: 'automation:failed',
            automation: this.get(automationId)!,
            execution: {
              ...execution,
              status: 'failed',
              error: errorMsg,
              completedAt
            }
          })
        })

      return execution
    })

    return executions[0]
  }

  getExecutions(automationId: string): AutomationExecution[] {
    const db = getDatabase()
    const rows = db
      .prepare(
        'SELECT * FROM automation_executions WHERE automation_id = ? ORDER BY started_at DESC LIMIT 50'
      )
      .all(automationId) as Record<string, string>[]
    return rows.map(this.toExecution)
  }

  // --- Scheduler ---

  startAllSchedulers(): void {
    const automations = this.listAll()
    for (const automation of automations) {
      if (automation.status === 'active') {
        this.scheduleAutomation(automation)
      }
    }
  }

  stopAllSchedulers(): void {
    for (const [id] of this.timers) {
      this.clearTimer(id)
    }
  }

  private scheduleAutomation(automation: Automation): void {
    this.clearTimer(automation.id)

    if (automation.status !== 'active') return

    let delay: number
    if (automation.nextRunAt) {
      const nextRun = new Date(automation.nextRunAt).getTime()
      const now = Date.now()
      delay = Math.max(nextRun - now, 1000)
    } else {
      delay = intervalToMs(automation.intervalValue, automation.intervalUnit)
    }

    const timer = setTimeout(() => {
      this.runAndReschedule(automation.id)
    }, delay)

    this.timers.set(automation.id, timer)
  }

  private async runAndReschedule(automationId: string): Promise<void> {
    const automation = this.get(automationId)
    if (!automation || automation.status !== 'active') return

    if (automation.scheduleType === 'daily' && automation.scheduledDays.length > 0) {
      const now = new Date()
      const todayIndex = now.getDay()
      const dayIndices = automation.scheduledDays.map((d) => DAY_INDEX_MAP[d])
      if (!dayIndices.includes(todayIndex)) {
        const fresh = this.get(automationId)
        if (fresh && fresh.status === 'active') {
          this.scheduleAutomation(fresh)
        }
        return
      }
    }

    try {
      await this.execute(automationId)
    } catch (error) {
      console.error(`Automation execution failed for ${automationId}:`, error)
    }

    const fresh = this.get(automationId)
    if (fresh && fresh.status === 'active') {
      this.scheduleAutomation(fresh)
    }
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(id)
    }
  }

  private broadcastEvent(event: AutomationEvent): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('automation:event', event)
    }
  }

  private getAutomationColumns(): Set<string> {
    const db = getDatabase()
    return new Set(
      (
        db.prepare("PRAGMA table_info('automations')").all() as Array<{
          name: string
        }>
      ).map((column) => column.name)
    )
  }

  private toAutomation(row: Record<string, string>): Automation {
    const daysStr = row.scheduled_days || ''
    const projectIdsStr = row.project_ids || ''
    return {
      id: row.id,
      name: row.name,
      projectIds: projectIdsStr ? projectIdsStr.split(',').filter(Boolean) : [],
      prompt: row.prompt,
      provider: row.provider as Automation['provider'],
      model: row.model,
      scheduleType: (row.schedule_type || 'interval') as Automation['scheduleType'],
      intervalValue: Number(row.interval_value),
      intervalUnit: row.interval_unit as Automation['intervalUnit'],
      scheduledTime: row.scheduled_time || null,
      scheduledDays: daysStr ? (daysStr.split(',') as DayOfWeek[]) : [],
      status: row.status as Automation['status'],
      lastRunAt: row.last_run_at || null,
      nextRunAt: row.next_run_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  private toExecution(row: Record<string, string>): AutomationExecution {
    return {
      id: row.id,
      automationId: row.automation_id,
      threadId: row.thread_id,
      status: row.status as AutomationExecution['status'],
      error: row.error || null,
      startedAt: row.started_at,
      completedAt: row.completed_at || null
    }
  }
}

export const automationService = new AutomationService()
