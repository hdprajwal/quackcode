import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type Content,
  type FunctionDeclaration
} from '@google/genai'
import type { AIModel, ToolDefinition } from '@shared/types'
import type { AIProviderInterface, ChatMessage, StreamCallbacks } from './provider.interface'

type GeminiToolCall = {
  id: string
  name: string
  arguments: Record<string, unknown>
  thoughtSignature?: string
}

export class GeminiProvider implements AIProviderInterface {
  readonly provider = 'gemini' as const
  private client: GoogleGenAI | null = null

  setApiKey(apiKey: string): void {
    this.client = new GoogleGenAI({ apiKey })
  }

  listModels(): AIModel[] {
    return [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'gemini' },
      {
        id: 'gemini-2.0-flash-lite-preview-02-05',
        name: 'Gemini 2.0 Flash Lite Preview',
        provider: 'gemini'
      },
      {
        id: 'gemini-3.1-flash-lite-preview',
        name: 'Gemini 3.1 Flash Lite Preview',
        provider: 'gemini'
      }
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
    if (!this.client) throw new Error('Gemini API key not configured')

    try {
      const stream = await this.client.models.generateContentStream({
        model,
        contents: this.convertMessages(messages),
        config: {
          abortSignal: signal,
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingBudget: 8192 },
          tools:
            tools.length > 0 ? [{ functionDeclarations: this.convertTools(tools) }] : undefined,
          toolConfig:
            tools.length > 0
              ? {
                  functionCallingConfig: {
                    mode: FunctionCallingConfigMode.AUTO
                  }
                }
              : undefined
        }
      })

      let fullText = ''
      const toolCalls = new Map<string, GeminiToolCall>()

      for await (const chunk of stream) {
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          if (part.thought) continue // skip thought summary parts

          if (part.text) {
            const delta =
              fullText && part.text.startsWith(fullText)
                ? part.text.slice(fullText.length)
                : part.text
            fullText = fullText && part.text.startsWith(fullText) ? part.text : fullText + part.text
            if (delta) callbacks.onText(delta)
          }

          if (part.functionCall) {
            const call = part.functionCall
            const id = call.id || `call_${toolCalls.size + 1}`
            const existing = toolCalls.get(id)
            const nextCall: GeminiToolCall = {
              id,
              name: call.name || existing?.name || 'unknown_tool',
              arguments: (call.args as Record<string, unknown>) ?? existing?.arguments ?? {},
              thoughtSignature: part.thoughtSignature ?? existing?.thoughtSignature
            }
            if (!existing) {
              callbacks.onToolCall(nextCall.id, nextCall.name, nextCall.arguments)
            }
            toolCalls.set(id, nextCall)
          }
        }
      }

      callbacks.onDone()

      if (toolCalls.size > 0) {
        return {
          role: 'assistant',
          content: fullText,
          toolCalls: Array.from(toolCalls.values()).map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
            thoughtSignature: tc.thoughtSignature
          }))
        }
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
      const client = new GoogleGenAI({ apiKey })
      await client.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: 'hi',
        config: {
          maxOutputTokens: 1
        }
      })
      return true
    } catch {
      return false
    }
  }

  private convertMessages(messages: ChatMessage[]): Content[] {
    const result: Content[] = []
    const toolNamesById = new Map<string, string>()

    for (const msg of messages) {
      if (msg.role === 'user') {
        result.push({
          role: 'user',
          parts: [{ text: msg.content }]
        })
        continue
      }

      if (msg.role === 'assistant') {
        const parts: NonNullable<Content['parts']> = []

        if (msg.content) {
          parts.push({ text: msg.content })
        }

        for (const toolCall of msg.toolCalls ?? []) {
          toolNamesById.set(toolCall.id, toolCall.name)
          parts.push({
            functionCall: {
              id: toolCall.id,
              name: toolCall.name,
              args: toolCall.arguments
            },
            ...(toolCall.thoughtSignature ? { thoughtSignature: toolCall.thoughtSignature } : {})
          })
        }

        if (parts.length > 0) {
          result.push({
            role: 'model',
            parts
          })
        }

        continue
      }

      if (!msg.toolCallId) {
        continue
      }

      result.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              id: msg.toolCallId,
              name: toolNamesById.get(msg.toolCallId) || 'unknown_tool',
              response: {
                output: msg.content
              }
            }
          }
        ]
      })
    }

    return result
  }

  private convertTools(tools: ToolDefinition[]): FunctionDeclaration[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: tool.parameters
    }))
  }
}

export const geminiProvider = new GeminiProvider()
