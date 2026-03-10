import { ipcMain } from 'electron'
import { threadService } from '../services/thread.service'
import { aiService } from '../services/ai/ai.service'
import type { CreateThreadParams } from '@shared/types'

export function registerThreadIpc(): void {
  ipcMain.handle('thread:create', (_event, params: CreateThreadParams) => {
    return threadService.createThread(params)
  })

  ipcMain.handle('thread:list', (_event, projectId: string) => {
    return threadService.listThreads(projectId)
  })

  ipcMain.handle('thread:listAll', (_event) => {
    return threadService.listAllThreads()
  })

  ipcMain.handle('thread:get', (_event, threadId: string) => {
    return threadService.getThread(threadId)
  })

  ipcMain.handle('thread:delete', (_event, threadId: string) => {
    aiService.disposeThread(threadId)
    threadService.deleteThread(threadId)
  })

  ipcMain.handle('thread:updateTitle', (_event, params: { threadId: string; title: string }) => {
    threadService.updateTitle(params.threadId, params.title)
  })

  ipcMain.handle('message:list', (_event, threadId: string) => {
    return threadService.getMessages(threadId)
  })
}
