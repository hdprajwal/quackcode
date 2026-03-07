import { ipcMain } from 'electron'
import { agentService } from '../services/agent.service'
import { aiService } from '../services/ai/ai.service'
import type { AIProvider, SendMessageParams } from '@shared/types'

export function registerAiIpc(): void {
  ipcMain.handle('ai:send', async (_event, params: SendMessageParams) => {
    // Run async - don't await, streaming sends chunks
    agentService.handleMessage(params).catch((err) => {
      console.error('Agent error:', err)
    })
  })

  ipcMain.handle('ai:cancel', (_event, threadId: string) => {
    agentService.cancel(threadId)
  })

  ipcMain.handle('ai:models', () => {
    return aiService.listAllModels()
  })

  ipcMain.handle(
    'ai:verifyKey',
    async (_event, params: { provider: AIProvider; apiKey: string }) => {
      return aiService.verifyApiKey(params.provider, params.apiKey)
    }
  )
}
