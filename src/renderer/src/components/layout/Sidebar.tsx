import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useUIStore } from '@renderer/stores/ui.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useThread } from '@renderer/hooks/useThread'
import { on } from '@renderer/lib/ipc'
import type { Thread } from '@shared/types'
import {
  Settings,
  PanelLeftClose,
  Plus,
  Zap,
  Brain,
  Search,
  Folder,
  ChevronRight,
  ChevronDown,
  PlusIcon,
  FolderPlus
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Separator } from '@renderer/components/ui/separator'
import { ThreadItem } from '@renderer/components/sidebar/ThreadItem'
import { cn } from '@renderer/lib/utils'

export function Sidebar(): React.JSX.Element {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const navigate = useNavigate()
  const { recentProjects: projects, project: activeProject, setProject } = useProjectStore()
  const threads = useThreadStore((s) => s.threads)
  const { loadAllThreads } = useThread()
  const { setActiveThread, updateThread } = useThreadStore()
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const cleanup = on('thread:update', (updatedThread: unknown) => {
      updateThread(updatedThread as Thread)
    })
    return cleanup
  }, [updateThread])

  useEffect(() => {
    loadAllThreads()
  }, [loadAllThreads])

  // Expand the active project by default
  useEffect(() => {
    if (activeProject) {
      setExpandedProjects((prev) => ({ ...prev, [activeProject.id]: true }))
    }
  }, [activeProject])

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }))
  }

  const handleProjectClick = (project: any) => {
    setProject(project)
    toggleProject(project.id)
  }

  return (
    <div
      className={cn(
        'flex flex-col border-r border-border bg-sidebar transition-all duration-200',
        sidebarOpen ? 'w-[260px] min-w-[260px]' : 'w-0 min-w-0 overflow-hidden'
      )}
    >
      {/* Header with drag region */}
      <div className="drag-region flex h-12 items-center justify-between px-3 pt-2">
        <span className="no-drag text-sm font-semibold text-sidebar-foreground truncate">
          QuackCode
        </span>
        <Button variant="ghost" size="icon" className="no-drag h-7 w-7" onClick={toggleSidebar}>
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-2 flex flex-col gap-1">
          {/* Top Section */}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm font-normal"
            onClick={() => {
              setActiveThread(null)
              navigate({ to: '/' })
            }}
          >
            <Plus className="h-4 w-4" />
            New Thread
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm font-normal"
            disabled
          >
            <Zap className="h-4 w-4" />
            Automations
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm font-normal"
            disabled
          >
            <Brain className="h-4 w-4" />
            Skills
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm font-normal"
            disabled
          >
            <Search className="h-4 w-4" />
            Search
          </Button>

          <Separator className="my-2" />
          <div className="text-sm text-muted-foreground font-medium px-2 h-8 flex items-center justify-between">
            <span>Thread</span>
            <Button size="icon" variant="ghost">
              <FolderPlus className="size-4 " />
            </Button>
          </div>
          {/* Projects Section */}
          <div className="flex flex-col gap-4">
            {projects.map((project) => {
              const projectThreads = threads.filter((t) => t.projectId === project.id)
              const isExpanded = expandedProjects[project.id]

              return (
                <div key={project.id} className="flex flex-col gap-1 group/project">
                  <div className="flex items-center gap-1 pr-2">
                    <Button
                      variant="ghost"
                      className={cn(
                        'flex-1 justify-start gap-2 text-sm font-medium px-2 h-8 hover:bg-accent/50',
                        activeProject?.id === project.id && 'bg-accent text-accent-foreground'
                      )}
                      onClick={() => handleProjectClick(project)}
                    >
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{project.name}</span>
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="pl-4 flex flex-col gap-0.5 border-l border-border/50 ml-3.5">
                      {projectThreads.length > 0 ? (
                        projectThreads.map((thread) => (
                          <ThreadItem key={thread.id} thread={thread} />
                        ))
                      ) : (
                        <div className="px-2 py-1 text-xs text-muted-foreground">No threads</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sm text-muted-foreground"
          onClick={() => navigate({ to: '/settings' })}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  )
}
