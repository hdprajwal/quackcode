import { memo, useEffect, useMemo, useState } from 'react'
import { Shimmer } from '@renderer/components/ai-elements/shimmer'
import { cn } from '@renderer/lib/utils'

const DUCK_VERBS = [
  'Quacking',
  'Paddling',
  'Waddling',
  'Pondering',
  'Diving',
  'Dabbling',
  'Preening',
  'Honking',
  'Floating',
  'Splashing',
  'Foraging',
  'Bobbing',
  'Migrating',
  'Nesting',
  'Hatching',
  'Ruffling',
  'Marshaling',
  'Webbing',
  'Cogitating',
  'Scheming'
] as const

const VERB_ROTATE_MS = 4000

function pickStartIndex(seed: number): number {
  return Math.abs(Math.floor(seed)) % DUCK_VERBS.length
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remSeconds = seconds % 60
  if (minutes < 60) {
    return remSeconds > 0 ? `${minutes}m ${remSeconds}s` : `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`
}

interface WorkingIndicatorProps {
  startedAt: number
  className?: string
}

function WorkingIndicatorComponent({
  startedAt,
  className
}: WorkingIndicatorProps): React.JSX.Element {
  const initialIndex = useMemo(() => pickStartIndex(startedAt), [startedAt])
  const [verbIndex, setVerbIndex] = useState(initialIndex)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setVerbIndex(initialIndex)
  }, [initialIndex])

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [])

  useEffect(() => {
    const rotate = window.setInterval(() => {
      setVerbIndex((i) => (i + 1) % DUCK_VERBS.length)
    }, VERB_ROTATE_MS)
    return () => window.clearInterval(rotate)
  }, [])

  const verb = DUCK_VERBS[verbIndex]
  const elapsed = formatElapsed(now - startedAt)

  return (
    <div
      aria-live="polite"
      className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}
    >
      <span className="inline-flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
        <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:200ms]" />
        <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:400ms]" />
      </span>
      <Shimmer className="text-sm">{`${verb}…`}</Shimmer>
      <span className="text-xs tabular-nums text-muted-foreground/60">({elapsed})</span>
    </div>
  )
}

export const WorkingIndicator = memo(WorkingIndicatorComponent)
