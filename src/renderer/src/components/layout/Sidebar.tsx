import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useUIStore } from '@renderer/stores/ui.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useThread } from '@renderer/hooks/useThread'
import { invoke, on } from '@renderer/lib/ipc'
import type { Project, Thread } from '@shared/types'
import {
  ChevronDown,
  ChevronRight,
  Clock,
  FolderPlus,
  Grid2X2Plus,
  MessageSquarePlus,
  MoreHorizontal,
  Settings,
  SquarePen,
  Trash2
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { ThreadItem } from '@renderer/components/sidebar/ThreadItem'
import {
  Sidebar as SidebarShell,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarSeparator
} from '@renderer/components/ui/sidebar'

export function Sidebar(): React.JSX.Element {
  const { sidebarOpen, activeView, setActiveView } = useUIStore()
  const navigate = useNavigate()
  const {
    recentProjects: projects,
    project: activeProject,
    setProject,
    setRecentProjects,
    removeProject
  } = useProjectStore()
  const threads = useThreadStore((s) => s.threads)
  const { createThread, loadAllThreads } = useThread()
  const { setActiveThread, setMessages, updateThread, removeProjectThreads } = useThreadStore()
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})
  const [createThreadDialogOpen, setCreateThreadDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)

  useEffect(() => {
    const cleanup = on('thread:update', (updatedThread: unknown) => {
      updateThread(updatedThread as Thread)
    })
    return cleanup
  }, [updateThread])

  useEffect(() => {
    loadAllThreads()
  }, [loadAllThreads])

  const groupedThreads = useMemo(() => {
    const groups = new Map<string, Thread[]>()
    for (const thread of threads) {
      const existing = groups.get(thread.projectId) ?? []
      existing.push(thread)
      groups.set(thread.projectId, existing)
    }
    return groups
  }, [threads])

  const projectExpansionState = useMemo(() => {
    return Object.fromEntries(
      projects.map((project) => [project.id, expandedProjects[project.id] ?? true])
    )
  }, [expandedProjects, projects])

  const toggleProject = (projectId: string): void => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: prev[projectId] === undefined ? false : !prev[projectId]
    }))
  }

  const handleProjectClick = (project: Project): void => {
    const state = useThreadStore.getState()
    const activeThread = state.threads.find((thread) => thread.id === state.activeThreadId)

    if (activeThread?.projectId !== project.id) {
      setActiveThread(null)
      setMessages([])
    }

    setProject(project)
    setExpandedProjects((prev) => ({ ...prev, [project.id]: true }))
  }

  const handleAddProject = async (): Promise<void> => {
    const selected = await invoke<Project | null>('project:select')
    if (!selected) return

    setProject(selected)
    setExpandedProjects((prev) => ({ ...prev, [selected.id]: true }))
    setRecentProjects(await invoke<Project[]>('project:list'))
    await loadAllThreads()
    setActiveThread(null)
    setMessages([])
    navigate({ to: '/' })
  }

  const handleDeleteProject = async (): Promise<void> => {
    if (!projectToDelete) return

    const deletedProjectId = projectToDelete.id
    const wasActiveProject = activeProject?.id === deletedProjectId

    await invoke('project:delete', deletedProjectId)

    removeProject(deletedProjectId)
    removeProjectThreads(deletedProjectId)
    setExpandedProjects((prev) => {
      const next = { ...prev }
      delete next[deletedProjectId]
      return next
    })

    if (wasActiveProject) {
      setActiveThread(null)
      setMessages([])
      navigate({ to: '/' })
    }

    setProjectToDelete(null)
  }

  const handleCreateThread = async (project: Project): Promise<void> => {
    setExpandedProjects((prev) => ({ ...prev, [project.id]: true }))
    await createThread(project.id)
    navigate({ to: '/' })
  }

  return (
    <>
      {sidebarOpen ? (
        <SidebarShell className="w-[306px] min-w-[306px]">
          <SidebarHeader className="drag-region flex flex-row h-12 items-center justify-between border-b border-border px-3">
            <div className="no-drag text-[15px] font-semibold tracking-[-0.02em] text-white/92">
              QuackCode
            </div>
            <div className="no-drag flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white/45 hover:bg-white/6 hover:text-white"
                onClick={() => navigate({ to: '/settings' })}
                aria-label="Open settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup className="px-2 py-3">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setCreateThreadDialogOpen(true)}>
                      <SquarePen className="h-4 w-4" />
                      <span>Add Thread</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={activeView === 'automations'}
                      onClick={() => {
                        navigate({ to: '/' })
                        setActiveView(activeView === 'automations' ? 'chat' : 'automations')
                      }}
                    >
                      <Clock className="h-4 w-4" />
                      <span>Automations</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled>
                      <Grid2X2Plus className="h-4 w-4" />
                      <span>Skills</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            <ScrollArea className="flex-1 px-2 ">
              <SidebarGroup>
                <SidebarGroupContent className="pt-2">
                  <SidebarMenu className="gap-2">
                    {projects.map((project) => {
                      const projectThreads = groupedThreads.get(project.id) ?? []
                      const isExpanded = projectExpansionState[project.id]

                      return (
                        <SidebarMenuItem key={project.id} className="group/project">
                          <div className="flex items-center gap-1">
                            <SidebarMenuAction
                              className="size-6"
                              onClick={() => toggleProject(project.id)}
                              aria-label={
                                isExpanded ? `Collapse ${project.name}` : `Expand ${project.name}`
                              }
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </SidebarMenuAction>

                            <SidebarMenuButton
                              variant="ghost"
                              className="min-w-0 flex-1 rounded-md px-2"
                              onClick={() => handleProjectClick(project)}
                              tooltip={project.path}
                            >
                              <span className="truncate font-semibold tracking-[-0.02em] text-white/92">
                                {project.name}
                              </span>
                            </SidebarMenuButton>

                            <DropdownMenu>
                              <DropdownMenuTrigger>
                                <SidebarMenuAction
                                  className="text-white/0 group-hover/project:text-white/35"
                                  aria-label={`Open ${project.name} menu`}
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </SidebarMenuAction>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-44 border-white/10 bg-[#1f1f1d] text-white shadow-lg ring-white/10"
                              >
                                <DropdownMenuItem
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handleCreateThread(project)
                                  }}
                                >
                                  <MessageSquarePlus className="h-3.5 w-3.5" />
                                  New thread
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setProjectToDelete(project)
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete project
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {isExpanded && (
                            <SidebarMenuSub className="mt-1">
                              {projectThreads.length > 0 ? (
                                projectThreads.map((thread) => (
                                  <ThreadItem key={thread.id} thread={thread} />
                                ))
                              ) : (
                                <li className="px-2 py-2 text-sm text-white/30">No threads yet</li>
                              )}
                            </SidebarMenuSub>
                          )}
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </ScrollArea>
          </SidebarContent>
          <SidebarFooter className="p-3">
            <Button
              variant="ghost"
              className="flex w-full items-center justify-start gap-2 py-2 text-sm text-muted-foreground hover:text-foreground"
              onClick={handleAddProject}
            >
              <FolderPlus className="h-4 w-4" />
              Add project
            </Button>
          </SidebarFooter>
        </SidebarShell>
      ) : null}

      <Dialog open={createThreadDialogOpen} onOpenChange={setCreateThreadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create a new thread</DialogTitle>
            <DialogDescription>
              {projects.length > 0
                ? 'Choose which project this thread should belong to.'
                : 'Add a project first so the new thread has somewhere to live.'}
            </DialogDescription>
          </DialogHeader>

          {projects.length > 0 ? (
            <div className="space-y-2">
              {projects.map((project) => {
                const projectThreads = groupedThreads.get(project.id) ?? []

                return (
                  <button
                    key={project.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 text-left transition-colors hover:bg-white/[0.06]"
                    onClick={() => {
                      setCreateThreadDialogOpen(false)
                      void handleCreateThread(project)
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white/92">
                        {project.name}
                      </div>
                      <div className="truncate text-xs text-white/45">{project.path}</div>
                    </div>
                    <div className="shrink-0 text-xs text-white/35">
                      {projectThreads.length === 1
                        ? '1 thread'
                        : `${projectThreads.length} threads`}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateThreadDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void handleAddProject()
                setCreateThreadDialogOpen(false)
              }}
            >
              <FolderPlus className="h-4 w-4" />
              Add project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={projectToDelete !== null}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              {projectToDelete
                ? `Remove ${projectToDelete.name} from QuackCode. Its saved threads and messages will also be deleted.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProject}>
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
