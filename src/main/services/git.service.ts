import simpleGit, { type SimpleGit } from 'simple-git'
import type { GitStatus, GitDiff, GitWorktreeInfo } from '@shared/types'

export class GitService {
  private getGit(projectPath: string): SimpleGit {
    return simpleGit(projectPath)
  }

  async getStatus(projectPath: string): Promise<GitStatus> {
    const git = this.getGit(projectPath)
    const status = await git.status()
    return {
      branch: status.current || 'HEAD',
      ahead: status.ahead,
      behind: status.behind,
      staged: status.staged,
      modified: status.modified,
      untracked: status.not_added,
      isClean: status.isClean()
    }
  }

  async getDiff(projectPath: string): Promise<GitDiff> {
    const git = this.getGit(projectPath)
    const diffSummary = await git.diffSummary()
    return {
      files: diffSummary.files.map((f) => ({
        file: f.file,
        insertions: 'insertions' in f ? f.insertions : 0,
        deletions: 'deletions' in f ? f.deletions : 0,
        binary: f.binary
      })),
      summary: {
        insertions: diffSummary.insertions,
        deletions: diffSummary.deletions,
        changed: diffSummary.changed
      }
    }
  }

  async commit(message: string, projectPath: string): Promise<string> {
    const git = this.getGit(projectPath)
    await git.add('.')
    const result = await git.commit(message)
    return result.commit
  }

  async createWorktree(projectPath: string, branch?: string): Promise<GitWorktreeInfo> {
    const git = this.getGit(projectPath)
    const branchName = branch || `worktree-${Date.now()}`
    const worktreePath = `${projectPath}/.quackcode-worktrees/${branchName}`

    await git.raw(['worktree', 'add', '-b', branchName, worktreePath])
    return { path: worktreePath, branch: branchName }
  }

  async removeWorktree(worktreePath: string): Promise<void> {
    // Get parent project path from worktree
    const git = simpleGit(worktreePath)
    const root = await git.raw(['rev-parse', '--git-common-dir'])
    const projectGit = simpleGit(root.trim().replace(/\/.git$/, ''))
    await projectGit.raw(['worktree', 'remove', worktreePath, '--force'])
  }

  async listWorktrees(projectPath: string): Promise<GitWorktreeInfo[]> {
    const git = this.getGit(projectPath)
    const result = await git.raw(['worktree', 'list', '--porcelain'])
    const worktrees: GitWorktreeInfo[] = []
    let current: Partial<GitWorktreeInfo> = {}

    for (const line of result.split('\n')) {
      if (line.startsWith('worktree ')) {
        current.path = line.replace('worktree ', '')
      } else if (line.startsWith('branch ')) {
        current.branch = line.replace('branch refs/heads/', '')
      } else if (line === '') {
        if (current.path && current.branch) {
          worktrees.push(current as GitWorktreeInfo)
        }
        current = {}
      }
    }

    return worktrees
  }
}

export const gitService = new GitService()
