import type { AIProvider, Automation } from '@shared/types'

type AutomationSchedule = Pick<
  Automation,
  'scheduleType' | 'scheduledTime' | 'scheduledDays' | 'intervalValue' | 'intervalUnit'
>

export function getProviderLogo(provider: AIProvider): string {
  return provider === 'gemini' ? 'google' : provider
}

export function formatSchedule(automation: AutomationSchedule): string {
  if (automation.scheduleType === 'daily') {
    const time = automation.scheduledTime || '09:00'
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const formattedHours = hours % 12 || 12
    const timeLabel = `${String(formattedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`

    if (automation.scheduledDays.length === 7 || automation.scheduledDays.length === 0) {
      return `Daily at ${timeLabel}`
    }

    return `${automation.scheduledDays.join(', ')} at ${timeLabel}`
  }

  if (automation.intervalValue === 1) {
    return `Every ${automation.intervalUnit.slice(0, -1)}`
  }

  return `Every ${automation.intervalValue} ${automation.intervalUnit}`
}

export function formatRelativeTime(dateStr: string | null): string {
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

export function formatFutureTime(dateStr: string | null): string {
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

export function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleString()
}

export function to24Hour(hours: string, minutes: string, period: 'AM' | 'PM'): string {
  let normalizedHours = parseInt(hours, 10)

  if (period === 'AM' && normalizedHours === 12) normalizedHours = 0
  if (period === 'PM' && normalizedHours !== 12) normalizedHours += 12

  return `${String(normalizedHours).padStart(2, '0')}:${minutes.padStart(2, '0')}`
}

export function to12Hour(time24: string | null): {
  hours: string
  minutes: string
  period: 'AM' | 'PM'
} {
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
