import { useState, useCallback } from 'react'
import { invoke } from '@renderer/lib/ipc'
import { useProjectStore } from '@renderer/stores/project.store'
import type { GitWorktreeInfo } from '@shared/types'

export function useWorktree(): {
  worktrees: GitWorktreeInfo[]
  loading: boolean
  createWorktree: (branch?: string) => Promise<GitWorktreeInfo | null>
  removeWorktree: (path: string) => Promise<void>
  loadWorktrees: () => Promise<void>
} {
  const [worktrees, setWorktrees] = useState<GitWorktreeInfo[]>([])
  const [loading, setLoading] = useState(false)
  const project = useProjectStore((s) => s.project)
  const { setWorktreePath, setEnvironmentMode } = useProjectStore()

  const loadWorktrees = useCallback(async () => {
    if (!project) return
    try {
      const wts = await invoke<GitWorktreeInfo[]>('git:worktree:list', project.path)
      setWorktrees(wts)
    } catch {
      setWorktrees([])
    }
  }, [project])

  const createWorktree = useCallback(
    async (branch?: string) => {
      if (!project) return null
      setLoading(true)
      try {
        const wt = await invoke<GitWorktreeInfo>('git:worktree:create', {
          projectPath: project.path,
          branch
        })
        setWorktreePath(wt.path)
        setEnvironmentMode('worktree')
        await loadWorktrees()
        return wt
      } catch {
        return null
      } finally {
        setLoading(false)
      }
    },
    [project, loadWorktrees]
  )

  const removeWorktree = useCallback(
    async (path: string) => {
      setLoading(true)
      try {
        await invoke('git:worktree:remove', path)
        setWorktreePath(null)
        setEnvironmentMode('local')
        await loadWorktrees()
      } finally {
        setLoading(false)
      }
    },
    [loadWorktrees]
  )

  return { worktrees, loading, createWorktree, removeWorktree, loadWorktrees }
}
