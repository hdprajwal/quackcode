import { ipcMain } from 'electron'
import { skillsService } from '../services/skills.service'
import type { SkillInstallParams, SkillSearchParams, SkillUninstallParams } from '@shared/types'

export function registerSkillsIpc(): void {
  ipcMain.handle('skills:listInstalled', () => {
    return skillsService.listInstalled()
  })

  ipcMain.handle('skills:search', (_event, params: SkillSearchParams) => {
    return skillsService.search(params)
  })

  ipcMain.handle('skills:details', (_event, params: { source: string; skillId: string }) => {
    return skillsService.getDetails(params)
  })

  ipcMain.handle('skills:localDetails', (_event, params: { path: string; skillId: string }) => {
    return skillsService.getLocalDetails(params)
  })

  ipcMain.handle('skills:install', (_event, params: SkillInstallParams) => {
    return skillsService.install(params)
  })

  ipcMain.handle('skills:uninstall', (_event, params: SkillUninstallParams) => {
    return skillsService.uninstall(params)
  })
}
