import Anthropic from '@anthropic-ai/sdk'
import type { AIModel, ToolDefinition } from '@shared/types'
import type { AIProviderInterface, ChatMessage, StreamCallbacks } from './provider.interface'

export class AnthropicProvider implements AIProviderInterface {
  readonly provider = 'anthropic'
  private client: Anthropic | null = null

  private getClient(apiKey: string): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey })
    }
    return this.client
  }

  setApiKey(apiKey: string): void {
    this.client = new Anthropic({ apiKey })
  }

  setAuthToken(token: string): void {
    this.client = new Anthropic({
      authToken: token,
      defaultHeaders: {
        'anthropic-beta': 'oauth-2025-04-20'
      }
    })
  }

  listModels(): AIModel[] {
    return [
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', provider: 'anthropic' },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'anthropic' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic' }
    ]
  }

  async sendMessage(
    messages: ChatMessage[],
    model: string,
    tools: ToolDefinition[],
    systemPrompt: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<ChatMessage | null> {
    const client = this.client
    if (!client) throw new Error('Anthropic API key not configured')

    const anthropicMessages = this.convertMessages(messages)
    const anthropicTools = this.convertTools(tools)

    try {
      const stream = client.messages.stream(
        {
          model,
          max_tokens: 8192,
          system: systemPrompt,
          messages: anthropicMessages,
          tools: anthropicTools.length > 0 ? anthropicTools : undefined
        },
        { signal }
      )

      let fullText = ''
      const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = []
      let currentToolId = ''

      stream.on('text', (text) => {
        fullText += text
        callbacks.onText(text)
      })

      stream.on('inputJson', (json) => {
        if (currentToolId) {
          callbacks.onToolCallDelta(currentToolId, json as string)
        }
      })

      stream.on('contentBlock', (block) => {
        if (block.type === 'tool_use') {
          currentToolId = block.id
          callbacks.onToolCall(block.id, block.name, block.input as Record<string, unknown>)
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input as Record<string, unknown>
          })
        }
      })

      const finalMessage = await stream.finalMessage()

      // Parse any tool use blocks from the final message
      for (const block of finalMessage.content) {
        if (block.type === 'tool_use') {
          const existing = toolCalls.find((tc) => tc.id === block.id)
          if (!existing) {
            toolCalls.push({
              id: block.id,
              name: block.name,
              arguments: block.input as Record<string, unknown>
            })
          } else {
            existing.arguments = block.input as Record<string, unknown>
          }
        }
      }

      callbacks.onDone()

      if (toolCalls.length > 0) {
        return { role: 'assistant', content: fullText, toolCalls }
      }
      return { role: 'assistant', content: fullText }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null
      }
      const msg = error instanceof Error ? error.message : 'Unknown error'
      callbacks.onError(msg)
      return null
    }
  }

  async verifyApiKey(apiKey: string): Promise<boolean> {
    try {
      const client = apiKey ? this.getClient(apiKey) : this.client
      if (!client) return false
      await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }]
      })
      return true
    } catch {
      return false
    }
  }

  private convertMessages(
    messages: ChatMessage[]
  ): Anthropic.Messages.MessageParam[] {
    const result: Anthropic.Messages.MessageParam[] = []

    for (const msg of messages) {
      if (msg.role === 'user') {
        result.push({ role: 'user', content: msg.content })
      } else if (msg.role === 'assistant') {
        const content: Anthropic.Messages.ContentBlockParam[] = []
        if (msg.content) {
          content.push({ type: 'text', text: msg.content })
        }
        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            content.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments
            })
          }
        }
        result.push({ role: 'assistant', content })
      } else if (msg.role === 'tool') {
        result.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.toolCallId!,
              content: msg.content
            }
          ]
        })
      }
    }

    return result
  }

  private convertTools(tools: ToolDefinition[]): Anthropic.Messages.Tool[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Messages.Tool['input_schema']
    }))
  }
}

export const anthropicProvider = new AnthropicProvider()
