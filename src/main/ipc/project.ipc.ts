import { ipcMain, dialog, BrowserWindow } from 'electron'
import { projectService } from '../services/project.service'

export function registerProjectIpc(): void {
  ipcMain.handle('project:select', async () => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return null

    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
      title: 'Select Project Folder'
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return projectService.openProject(result.filePaths[0])
  })

  ipcMain.handle('project:list', () => {
    return projectService.listProjects()
  })

  ipcMain.handle('project:open', (_event, projectId: string) => {
    return projectService.getProject(projectId)
  })
}
