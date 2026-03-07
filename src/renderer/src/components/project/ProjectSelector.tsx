import { FolderOpen, ChevronDown } from 'lucide-react'
import { buttonVariants } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { useProjectStore } from '@renderer/stores/project.store'
import { useThreadStore } from '@renderer/stores/thread.store'
import { invoke } from '@renderer/lib/ipc'
import type { Project } from '@shared/types'

export function ProjectSelector(): React.JSX.Element {
  const { project, recentProjects, setProject, setRecentProjects } = useProjectStore()
  const { setThreads, setActiveThread, setMessages } = useThreadStore()

  const handleSelectFolder = async (): Promise<void> => {
    const selected = await invoke<Project | null>('project:select')
    if (selected) {
      setProject(selected)
      // Reload threads for new project
      const threads = await invoke<import('@shared/types').Thread[]>('thread:list', selected.id)
      setThreads(threads)
      setActiveThread(null)
      setMessages([])
      // Refresh recent projects
      const projects = await invoke<Project[]>('project:list')
      setRecentProjects(projects)
    }
  }

  const handleOpenRecent = async (p: Project): Promise<void> => {
    setProject(p)
    const threads = await invoke<import('@shared/types').Thread[]>('thread:list', p.id)
    setThreads(threads)
    setActiveThread(null)
    setMessages([])
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 text-sm')}>
        <FolderOpen className="h-4 w-4" />
        <span className="max-w-[150px] truncate">
          {project?.name || 'Open Project'}
        </span>
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuItem onClick={handleSelectFolder}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Open folder...
        </DropdownMenuItem>
        {recentProjects.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {recentProjects.slice(0, 5).map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => handleOpenRecent(p)}>
                <span className="truncate">{p.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
