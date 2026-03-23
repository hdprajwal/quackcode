import OpenAI from 'openai'
import type { AIModel, ToolDefinition } from '@shared/types'
import type { AIProviderInterface, ChatMessage, StreamCallbacks } from './provider.interface'

export class OpenAIProvider implements AIProviderInterface {
  readonly provider = 'openai'
  private client: OpenAI | null = null

  setApiKey(apiKey: string): void {
    const trimmed = apiKey.trim()
    this.client = trimmed ? new OpenAI({ apiKey: trimmed }) : null
  }

  async listModels(): Promise<AIModel[]> {
    return [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
      { id: 'o3-mini', name: 'o3-mini', provider: 'openai' }
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
    if (!this.client) throw new Error('OpenAI API key not configured')

    const openaiMessages = this.convertMessages(messages, systemPrompt)
    const openaiTools = this.convertTools(tools)

    try {
      const stream = await this.client.chat.completions.create(
        {
          model,
          messages: openaiMessages,
          tools: openaiTools.length > 0 ? openaiTools : undefined,
          stream: true
        },
        { signal }
      )

      let fullText = ''
      const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = []
      const toolCallBuffers: Record<string, { name: string; args: string }> = {}

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        if (!delta) continue

        if (delta.content) {
          fullText += delta.content
          callbacks.onText(delta.content)
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index
            const key = String(idx)

            if (tc.id) {
              toolCallBuffers[key] = { name: tc.function?.name || '', args: '' }
              if (tc.function?.name) {
                callbacks.onToolCall(tc.id, tc.function.name, {})
              }
            }

            if (tc.function?.arguments) {
              if (toolCallBuffers[key]) {
                toolCallBuffers[key].args += tc.function.arguments
                callbacks.onToolCallDelta(tc.id || key, tc.function.arguments)
              }
            }

            if (tc.id && toolCallBuffers[key]) {
              const buf = toolCallBuffers[key]
              try {
                const args = buf.args ? JSON.parse(buf.args) : {}
                toolCalls.push({ id: tc.id, name: buf.name, arguments: args })
              } catch {
                // Args still streaming
              }
            }
          }
        }
      }

      // Finalize any incomplete tool calls
      for (const [, buf] of Object.entries(toolCallBuffers)) {
        const existingIdx = toolCalls.findIndex((tc) => tc.name === buf.name)
        if (existingIdx === -1 && buf.args) {
          try {
            toolCalls.push({
              id: `call_${Date.now()}`,
              name: buf.name,
              arguments: JSON.parse(buf.args)
            })
          } catch {
            // Invalid JSON
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
      const client = new OpenAI({ apiKey })
      await client.models.list()
      return true
    } catch {
      return false
    }
  }

  private convertMessages(
    messages: ChatMessage[],
    systemPrompt: string
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt }
    ]

    for (const msg of messages) {
      if (msg.role === 'user') {
        result.push({ role: 'user', content: msg.content })
      } else if (msg.role === 'assistant') {
        const toolCalls = msg.toolCalls?.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
        }))
        result.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: toolCalls
        })
      } else if (msg.role === 'tool') {
        result.push({
          role: 'tool',
          tool_call_id: msg.toolCallId!,
          content: msg.content
        })
      }
    }

    return result
  }

  private convertTools(tools: ToolDefinition[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }))
  }
}

export const openaiProvider = new OpenAIProvider()
