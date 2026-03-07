import { useState, useEffect } from 'react'
import { invoke } from '@renderer/lib/ipc'
import { useProjectStore } from '@renderer/stores/project.store'
import type { GitStatus } from '@shared/types'

export function useGitStatus(): { status: GitStatus | null; refresh: () => void } {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const project = useProjectStore((s) => s.project)

  const refresh = (): void => {
    if (!project) return
    invoke<GitStatus>('git:status', project.path)
      .then(setStatus)
      .catch(() => setStatus(null))
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 10000)
    return () => clearInterval(interval)
  }, [project?.path])

  return { status, refresh }
}
