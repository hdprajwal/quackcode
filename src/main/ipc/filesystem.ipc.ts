import { ipcMain } from 'electron'
import { filesystemService } from '../services/filesystem.service'

export function registerFilesystemIpc(): void {
  ipcMain.handle('fs:read', (_event, params: { path: string; projectPath: string }) => {
    return filesystemService.readFile(params.path, params.projectPath)
  })

  ipcMain.handle('fs:write', (_event, params: { path: string; content: string; projectPath: string }) => {
    filesystemService.writeFile(params.path, params.content, params.projectPath)
  })

  ipcMain.handle('fs:edit', (_event, params: { path: string; oldString: string; newString: string; projectPath: string }) => {
    filesystemService.editFile(params.path, params.oldString, params.newString, params.projectPath)
  })

  ipcMain.handle('fs:list', (_event, params: { path: string; projectPath: string; recursive?: boolean; maxDepth?: number }) => {
    return filesystemService.listDirectory(params.path, params.projectPath, params.recursive, params.maxDepth)
  })

  ipcMain.handle('fs:search', (_event, params: { pattern: string; path: string; projectPath: string; maxResults?: number }) => {
    return filesystemService.searchFiles(params.pattern, params.path, params.projectPath, params.maxResults)
  })
}
