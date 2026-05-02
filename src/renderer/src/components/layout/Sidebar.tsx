import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useUIStore } from '@renderer/stores/ui.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useThreadSelectionStore } from '@renderer/stores/thread-selection.store'
import { useThread } from '@renderer/hooks/useThread'
import { invoke } from '@renderer/lib/ipc'
import type { Project, Thread } from '@shared/types'
import {
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Clock,
  FolderPlus,
  Package,
  Settings,
  SquarePen,
  Trash2
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { ThreadGroup } from '@renderer/components/sidebar/ThreadGroup'
import { ArchivedThreadsSection } from '@renderer/components/sidebar/ArchivedThreadsSection'
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
  const { createThread, switchThread, loadAllThreads } = useThread()
  const { setActiveThread, removeProjectThreads } = useThreadStore()
  const clearSelection = useThreadSelectionStore((s) => s.clear)

  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})
  const [createThreadDialogOpen, setCreateThreadDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)

  useEffect(() => {
    void loadAllThreads()
  }, [loadAllThreads])

  const { activeThreadsByProject, flatActiveThreads } = useMemo(() => {
    const groups = new Map<string, Thread[]>()
    const flat: Thread[] = []
    for (const thread of threads) {
      if (thread.archivedAt !== null) continue
      const existing = groups.get(thread.projectId) ?? []
      existing.push(thread)
      groups.set(thread.projectId, existing)
      flat.push(thread)
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder)
    }
    flat.sort((a, b) => {
      if (a.projectId !== b.projectId) return a.projectId.localeCompare(b.projectId)
      return a.sortOrder - b.sortOrder
    })
    return { activeThreadsByProject: groups, flatActiveThreads: flat }
  }, [threads])

  // Cmd/Ctrl + 1..9 quick-jump across visible active threads.
  useEffect(() => {
    function handleKey(event: KeyboardEvent): void {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.shiftKey || event.altKey) return
      const digit = Number(event.key)
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) return
      const target = flatActiveThreads[digit - 1]
      if (!target) return
      event.preventDefault()
      void switchThread(target.id)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [flatActiveThreads, switchThread])

  // Escape to clear multi-selection.
  useEffect(() => {
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        const size = useThreadSelectionStore.getState().selectedIds.size
        if (size > 0) {
          event.preventDefault()
          clearSelection()
        }
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [clearSelection])

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

  // Click anywhere on the project row — toggles expansion and marks the
  // project as active. Matches the archived-threads section's behavior so
  // the user doesn't have to aim for the tiny chevron target.
  const handleProjectClick = (project: Project): void => {
    const state = useThreadStore.getState()
    const activeThread = state.threads.find((thread) => thread.id === state.activeThreadId)

    if (activeThread?.projectId !== project.id) {
      setActiveThread(null)
    }

    setProject(project)
    toggleProject(project.id)
  }

  const handleCopyProjectPath = async (project: Project): Promise<void> => {
    try {
      await navigator.clipboard.writeText(project.path)
    } catch {
      // Clipboard access can fail in some contexts — silently ignore.
    }
  }

  const handleAddProject = async (): Promise<void> => {
    const selected = await invoke<Project | null>('project:select')
    if (!selected) return

    setProject(selected)
    setExpandedProjects((prev) => ({ ...prev, [selected.id]: true }))
    setRecentProjects(await invoke<Project[]>('project:list'))
    await loadAllThreads()
    setActiveThread(null)
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
                    <SidebarMenuButton
                      isActive={activeView === 'skills'}
                      onClick={() => {
                        navigate({ to: '/' })
                        setActiveView(activeView === 'skills' ? 'chat' : 'skills')
                      }}
                    >
                      <Package className="h-4 w-4" />
                      <span>Skills</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            <ScrollArea className="flex-1 px-2">
              <SidebarGroup>
                <SidebarGroupContent className="pt-2">
                  <SidebarMenu className="gap-2">
                    {projects.map((project) => {
                      const projectThreads = activeThreadsByProject.get(project.id) ?? []
                      const isExpanded = projectExpansionState[project.id]

                      return (
                        <SidebarMenuItem key={project.id} className="group/project">
                          <ContextMenu>
                            <ContextMenuTrigger render={<div className="contents" />}>
                              <div className="relative flex items-center">
                                <SidebarMenuButton
                                  variant="ghost"
                                  className="min-h-7 min-w-0 flex-1 rounded-md px-1.5 py-1"
                                  onClick={() => handleProjectClick(project)}
                                  tooltip={project.path}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/45" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/45" />
                                  )}
                                  <span className="truncate font-semibold tracking-[-0.02em] text-white/92">
                                    {project.name}
                                  </span>
                                  {projectThreads.length > 0 ? (
                                    <span className="ml-auto shrink-0 text-xs text-white/35 transition-opacity group-hover/project:opacity-0">
                                      {projectThreads.length}
                                    </span>
                                  ) : null}
                                </SidebarMenuButton>

                                <SidebarMenuAction
                                  className="absolute right-1 top-1/2 size-6 -translate-y-1/2 text-white/55 opacity-0 transition-opacity hover:bg-transparent hover:text-white group-hover/project:opacity-100"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handleCreateThread(project)
                                  }}
                                  aria-label={`New thread in ${project.name}`}
                                  title="New thread"
                                >
                                  <SquarePen className="h-3.5 w-3.5" />
                                </SidebarMenuAction>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-44 border-white/10 bg-[#1f1f1d] text-white shadow-lg ring-white/10">
                              <ContextMenuItem
                                onClick={() => void handleCopyProjectPath(project)}
                              >
                                <ClipboardCopy className="h-3.5 w-3.5" />
                                Copy path
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                variant="destructive"
                                onClick={() => setProjectToDelete(project)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete project
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {isExpanded && (
                            <SidebarMenuSub className="mt-1">
                              <ThreadGroup threads={projectThreads} />
                            </SidebarMenuSub>
                          )}
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>

                  <ArchivedThreadsSection />
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
                const projectThreads = activeThreadsByProject.get(project.id) ?? []

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
