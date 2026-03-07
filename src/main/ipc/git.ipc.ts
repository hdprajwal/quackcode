import { ipcMain } from 'electron'
import { gitService } from '../services/git.service'

export function registerGitIpc(): void {
  ipcMain.handle('git:status', (_event, projectPath: string) => {
    return gitService.getStatus(projectPath)
  })

  ipcMain.handle('git:diff', (_event, projectPath: string) => {
    return gitService.getDiff(projectPath)
  })

  ipcMain.handle('git:commit', (_event, params: { message: string; projectPath: string }) => {
    return gitService.commit(params.message, params.projectPath)
  })

  ipcMain.handle('git:worktree:create', (_event, params: { projectPath: string; branch?: string }) => {
    return gitService.createWorktree(params.projectPath, params.branch)
  })

  ipcMain.handle('git:worktree:remove', (_event, worktreePath: string) => {
    return gitService.removeWorktree(worktreePath)
  })

  ipcMain.handle('git:worktree:list', (_event, projectPath: string) => {
    return gitService.listWorktrees(projectPath)
  })
}
