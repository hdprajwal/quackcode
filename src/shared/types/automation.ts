import type { AIProvider } from './ai'

export type AutomationStatus = 'active' | 'paused'

export type IntervalUnit = 'minutes' | 'hours' | 'days'

export type ScheduleType = 'daily' | 'interval'

export const DAYS_OF_WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

export interface Automation {
  id: string
  name: string
  projectIds: string[]
  prompt: string
  provider: AIProvider
  model: string
  scheduleType: ScheduleType
  intervalValue: number
  intervalUnit: IntervalUnit
  scheduledTime: string | null
  scheduledDays: DayOfWeek[]
  status: AutomationStatus
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateAutomationParams {
  name: string
  projectIds?: string[]
  prompt: string
  provider: AIProvider
  model: string
  scheduleType: ScheduleType
  intervalValue: number
  intervalUnit: IntervalUnit
  scheduledTime?: string | null
  scheduledDays?: DayOfWeek[]
}

export interface UpdateAutomationParams {
  id: string
  name?: string
  prompt?: string
  provider?: AIProvider
  model?: string
  projectIds?: string[]
  scheduleType?: ScheduleType
  intervalValue?: number
  intervalUnit?: IntervalUnit
  scheduledTime?: string | null
  scheduledDays?: DayOfWeek[]
  status?: AutomationStatus
}

export interface AutomationExecution {
  id: string
  automationId: string
  threadId: string
  status: 'running' | 'completed' | 'failed'
  error: string | null
  startedAt: string
  completedAt: string | null
}

export interface AutomationEvent {
  type: 'automation:started' | 'automation:completed' | 'automation:failed' | 'automation:updated'
  automation: Automation
  execution?: AutomationExecution
}
