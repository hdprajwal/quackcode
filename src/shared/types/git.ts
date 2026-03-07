export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  isClean: boolean
}

export interface GitDiff {
  files: GitDiffFile[]
  summary: { insertions: number; deletions: number; changed: number }
}

export interface GitDiffFile {
  file: string
  insertions: number
  deletions: number
  binary: boolean
}

export interface GitCommitParams {
  message: string
  projectPath: string
}

export interface GitWorktreeParams {
  projectPath: string
  branch?: string
}

export interface GitWorktreeInfo {
  path: string
  branch: string
}
