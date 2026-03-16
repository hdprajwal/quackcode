import { create } from 'zustand'
import type { Project, EnvironmentMode } from '@shared/types'

interface ProjectStore {
  project: Project | null
  recentProjects: Project[]
  environmentMode: EnvironmentMode
  worktreePath: string | null

  setProject: (project: Project | null) => void
  setRecentProjects: (projects: Project[]) => void
  removeProject: (projectId: string) => void
  setEnvironmentMode: (mode: EnvironmentMode) => void
  setWorktreePath: (path: string | null) => void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: null,
  recentProjects: [],
  environmentMode: 'local',
  worktreePath: null,

  setProject: (project) => set({ project }),
  setRecentProjects: (projects) => set({ recentProjects: projects }),
  removeProject: (projectId) =>
    set((state) => {
      const removingActiveProject = state.project?.id === projectId

      return {
        recentProjects: state.recentProjects.filter((project) => project.id !== projectId),
        project: removingActiveProject ? null : state.project,
        environmentMode: removingActiveProject ? 'local' : state.environmentMode,
        worktreePath: removingActiveProject ? null : state.worktreePath
      }
    }),
  setEnvironmentMode: (mode) => set({ environmentMode: mode }),
  setWorktreePath: (path) => set({ worktreePath: path })
}))
