import { Monitor, GitFork, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { buttonVariants } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { useProjectStore } from '@renderer/stores/project.store'
import { useWorktree } from '@renderer/hooks/useWorktree'
import { useEffect } from 'react'

export function EnvironmentSelector(): React.JSX.Element {
  const { environmentMode, setEnvironmentMode, setWorktreePath, project } = useProjectStore()
  const { worktrees, createWorktree, removeWorktree, loadWorktrees } = useWorktree()

  useEffect(() => {
    if (project) loadWorktrees()
  }, [project?.id])

  const Icon = environmentMode === 'worktree' ? GitFork : Monitor
  const label = environmentMode === 'worktree' ? 'Worktree' : 'Local'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 text-sm')}>
        <Icon className="h-3.5 w-3.5" />
        {label}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuItem
          onClick={() => {
            setEnvironmentMode('local')
            setWorktreePath(null)
          }}
        >
          <Monitor className="mr-2 h-4 w-4" />
          Local
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Worktrees</DropdownMenuLabel>
          {worktrees.map((wt) => (
            <DropdownMenuItem
              key={wt.path}
              onClick={() => {
                setEnvironmentMode('worktree')
                setWorktreePath(wt.path)
              }}
            >
              <GitFork className="mr-2 h-4 w-4" />
              <span className="flex-1 truncate">{wt.branch}</span>
              <button
                className="ml-1 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  removeWorktree(wt.path)
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => createWorktree()}>
          <Plus className="mr-2 h-4 w-4" />
          New Worktree
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
