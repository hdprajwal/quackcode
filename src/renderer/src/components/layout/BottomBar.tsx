import { useProjectStore } from '@renderer/stores/project.store'
import { GitBranch, ArrowUp, ArrowDown } from 'lucide-react'
import { useGitStatus } from '@renderer/hooks/useGitStatus'

export function BottomBar(): React.JSX.Element {
  const project = useProjectStore((s) => s.project)
  const environmentMode = useProjectStore((s) => s.environmentMode)
  const { status } = useGitStatus()

  return (
    <div className="flex h-8 items-center gap-3 border-t border-border px-3 text-xs text-muted-foreground">
      {project && status && (
        <>
          <div className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            <span>{status.branch}</span>
          </div>
          {status.ahead > 0 && (
            <div className="flex items-center gap-0.5">
              <ArrowUp className="h-3 w-3" />
              <span>{status.ahead}</span>
            </div>
          )}
          {status.behind > 0 && (
            <div className="flex items-center gap-0.5">
              <ArrowDown className="h-3 w-3" />
              <span>{status.behind}</span>
            </div>
          )}
          {!status.isClean && (
            <span>
              {status.modified.length > 0 && (
                <span className="text-yellow-500">{status.modified.length}M</span>
              )}
              {status.modified.length > 0 && status.untracked.length > 0 && ' '}
              {status.untracked.length > 0 && (
                <span className="text-green-500">{status.untracked.length}U</span>
              )}
              {status.staged.length > 0 && (
                <span className="text-blue-500"> {status.staged.length}S</span>
              )}
            </span>
          )}
        </>
      )}
      <div className="flex-1" />
      {environmentMode === 'worktree' && <span className="text-yellow-500">Worktree</span>}
      <span>QuackCode</span>
    </div>
  )
}
