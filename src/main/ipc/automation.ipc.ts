import { ipcMain } from 'electron'
import { automationService } from '../services/automation.service'
import type { CreateAutomationParams, UpdateAutomationParams } from '@shared/types'

export function registerAutomationIpc(): void {
  ipcMain.handle('automation:list', (_event, projectId: string) => {
    return automationService.list(projectId)
  })

  ipcMain.handle('automation:listAll', () => {
    return automationService.listAll()
  })

  ipcMain.handle('automation:get', (_event, automationId: string) => {
    return automationService.get(automationId)
  })

  ipcMain.handle('automation:create', (_event, params: CreateAutomationParams) => {
    return automationService.create(params)
  })

  ipcMain.handle('automation:update', (_event, params: UpdateAutomationParams) => {
    return automationService.update(params)
  })

  ipcMain.handle('automation:delete', (_event, automationId: string) => {
    return automationService.delete(automationId)
  })

  ipcMain.handle('automation:execute', async (_event, automationId: string) => {
    return automationService.execute(automationId)
  })

  ipcMain.handle('automation:executions', (_event, automationId: string) => {
    return automationService.getExecutions(automationId)
  })
}
