import { ipcMain } from 'electron'
import { threadService } from '../services/thread.service'
import { threadEventService } from '../services/thread-event.service'
import { aiService } from '../services/ai/ai.service'
import type { CreateThreadParams, ThreadReorderEntry } from '@shared/types'

export function registerThreadIpc(): void {
  ipcMain.handle('thread:create', (_event, params: CreateThreadParams) => {
    return threadService.createThread(params)
  })

  ipcMain.handle('thread:list', (_event, projectId: string) => {
    return threadService.listThreads(projectId)
  })

  ipcMain.handle('thread:listAll', () => {
    return threadService.listAllThreads()
  })

  ipcMain.handle('thread:get', (_event, threadId: string) => {
    return threadService.getThread(threadId)
  })

  ipcMain.handle('thread:delete', (_event, threadId: string) => {
    aiService.disposeThread(threadId)
    threadService.deleteThread(threadId)
  })

  ipcMain.handle('thread:deleteMany', (_event, threadIds: string[]) => {
    for (const id of threadIds) aiService.disposeThread(id)
    threadService.deleteThreads(threadIds)
  })

  ipcMain.handle('thread:updateTitle', (_event, params: { threadId: string; title: string }) => {
    threadService.updateTitle(params.threadId, params.title)
  })

  ipcMain.handle('thread:archive', (_event, threadId: string) => {
    threadService.archiveThread(threadId)
  })

  ipcMain.handle('thread:unarchive', (_event, threadId: string) => {
    threadService.unarchiveThread(threadId)
  })

  ipcMain.handle('thread:archiveMany', (_event, threadIds: string[]) => {
    threadService.archiveThreads(threadIds)
  })

  ipcMain.handle('thread:reorder', (_event, entries: ThreadReorderEntry[]) => {
    threadService.reorderThreads(entries)
  })

  ipcMain.handle('thread-event:list', (_event, threadId: string) => {
    return threadEventService.list(threadId)
  })

  ipcMain.handle('message:list', (_event, threadId: string) => {
    return threadService.getMessages(threadId)
  })
}
