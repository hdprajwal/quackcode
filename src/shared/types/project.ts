import type { EnvironmentMode } from './ai'

export interface Project {
  id: string
  name: string
  path: string
  lastOpenedAt: string
}

export interface ProjectState {
  project: Project | null
  environmentMode: EnvironmentMode
  worktreePath?: string
}
