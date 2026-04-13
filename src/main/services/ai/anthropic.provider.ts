import { query } from '@anthropic-ai/claude-agent-sdk'
import type {
  SDKAssistantMessage,
  SDKPartialAssistantMessage,
  SDKResultMessage,
  SDKToolProgressMessage,
  SDKUserMessage
} from '@anthropic-ai/claude-agent-sdk'
import type {
  BetaRawMessageStreamEvent,
  BetaRawContentBlockStartEvent,
  BetaRawContentBlockDeltaEvent
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type { AIModel, ToolDefinition } from '@shared/types'
import type { AIProviderInterface, ChatMessage, StreamCallbacks } from './provider.interface'
import { getClaudeCliStatus } from './claude-cli'

interface CollectedToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

interface CollectedToolResult {
  toolCallId: string
  content: string
  isError?: boolean
}

function extractToolResultText(block: unknown): { text: string; isError: boolean } {
  // Tool result blocks can have `content` as a string or an array of {type, text} blocks.
  const b = block as {
    tool_use_id?: string
    content?: unknown
    is_error?: boolean
  }
  const isError = Boolean(b.is_error)
  const raw = b.content
  if (typeof raw === 'string') return { text: raw, isError }
  if (Array.isArray(raw)) {
    const parts: string[] = []
    for (const part of raw) {
      const p = part as { type?: string; text?: string }
      if (p?.type === 'text' && typeof p.text === 'string') parts.push(p.text)
    }
    return { text: parts.join('\n'), isError }
  }
  return { text: '', isError }
}

export class AnthropicProvider implements AIProviderInterface {
  readonly provider = 'anthropic'

  setApiKey(_apiKey: string): void {
    // Intentionally empty. Claude access is delegated to the locally-authenticated
    // `claude` CLI that the Agent SDK spawns; quackcode never handles API keys or
    // OAuth tokens for Anthropic.
  }

  async listModels(): Promise<AIModel[]> {
    return [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic' }
    ]
  }

  async sendMessage(
    messages: ChatMessage[],
    model: string,
    _tools: ToolDefinition[], // ignored — Agent SDK uses its own built-in tools
    systemPrompt: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<ChatMessage | null> {
    // Track tool lifecycle so we can persist it on the assistant message after streaming.
    const toolCallsById = new Map<string, CollectedToolCall>()
    const toolResultsById = new Map<string, CollectedToolResult>()
    const toolInputBuffers: Record<string, string> = {}
    const toolOrder: string[] = []
    const prompt = this.buildPromptFromHistory(messages)
    const abortController = new AbortController()
    if (signal) {
      signal.addEventListener('abort', () => abortController.abort())
    }

    // Strip any stale ANTHROPIC_API_KEY / token so the CLI uses its own login.
    const env: Record<string, string | undefined> = { ...process.env }
    delete env.ANTHROPIC_API_KEY
    delete env.ANTHROPIC_AUTH_TOKEN

    try {
      const agentQuery = query({
        prompt,
        options: {
          model,
          systemPrompt,
          env,
          allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
          permissionMode: 'dontAsk',
          includePartialMessages: true,
          persistSession: false,
          abortController
        }
      })

      let fullText = ''
      let currentToolId = ''
      const streamedTurnIds = new Set<string>()

      for await (const message of agentQuery) {
        if (signal?.aborted) break

        if (message.type === 'stream_event') {
          const partialMsg = message as SDKPartialAssistantMessage
          const event = partialMsg.event as BetaRawMessageStreamEvent

          if (event.type === 'message_start') {
            currentToolId = ''
          } else if (event.type === 'content_block_start') {
            const startEvent = event as BetaRawContentBlockStartEvent
            if (startEvent.content_block.type === 'tool_use') {
              currentToolId = startEvent.content_block.id
              const name = startEvent.content_block.name
              if (!toolCallsById.has(currentToolId)) {
                toolCallsById.set(currentToolId, { id: currentToolId, name, arguments: {} })
                toolOrder.push(currentToolId)
              }
              callbacks.onToolCall(currentToolId, name, {})
              streamedTurnIds.add(partialMsg.uuid)
            }
          } else if (event.type === 'content_block_delta') {
            const deltaEvent = event as BetaRawContentBlockDeltaEvent
            const delta = deltaEvent.delta
            if (delta.type === 'text_delta') {
              fullText += delta.text
              streamedTurnIds.add(partialMsg.uuid)
              callbacks.onText(delta.text)
            } else if (delta.type === 'input_json_delta' && currentToolId) {
              toolInputBuffers[currentToolId] =
                (toolInputBuffers[currentToolId] || '') + delta.partial_json
              callbacks.onToolCallDelta(currentToolId, delta.partial_json)
            }
          } else if (event.type === 'content_block_stop') {
            if (currentToolId && toolInputBuffers[currentToolId]) {
              try {
                const parsed = JSON.parse(toolInputBuffers[currentToolId]) as Record<string, unknown>
                const existing = toolCallsById.get(currentToolId)
                if (existing) existing.arguments = parsed
              } catch {
                // leave arguments as-is if JSON isn't complete
              }
            }
            currentToolId = ''
          }
        } else if (message.type === 'tool_progress') {
          const prog = message as SDKToolProgressMessage
          callbacks.onToolCall(prog.tool_use_id, prog.tool_name, {
            elapsed_seconds: prog.elapsed_time_seconds
          })
        } else if (message.type === 'user') {
          // The Agent SDK inserts a user message carrying tool_result blocks after it executes a tool.
          const userMsg = message as SDKUserMessage
          const content = userMsg.message?.content
          if (Array.isArray(content)) {
            for (const block of content) {
              const b = block as { type?: string; tool_use_id?: string }
              if (b?.type === 'tool_result' && b.tool_use_id) {
                const { text, isError } = extractToolResultText(block)
                toolResultsById.set(b.tool_use_id, {
                  toolCallId: b.tool_use_id,
                  content: text,
                  isError: isError || undefined
                })
                callbacks.onToolResult?.({
                  toolCallId: b.tool_use_id,
                  content: text,
                  isError: isError || undefined
                })
              }
            }
          }
        } else if (message.type === 'assistant') {
          const assistantMsg = message as SDKAssistantMessage
          if (assistantMsg.error) {
            callbacks.onError(this.describeError(assistantMsg.error))
            return null
          }
          for (const block of assistantMsg.message.content) {
            if (block.type === 'tool_use') {
              const existing = toolCallsById.get(block.id)
              const input = block.input as Record<string, unknown>
              if (existing) existing.arguments = input
              else {
                toolCallsById.set(block.id, { id: block.id, name: block.name, arguments: input })
                toolOrder.push(block.id)
                callbacks.onToolCall(block.id, block.name, input)
              }
            }
          }
          if (!streamedTurnIds.has(assistantMsg.uuid)) {
            for (const block of assistantMsg.message.content) {
              if (block.type === 'text' && block.text) {
                fullText += block.text
                callbacks.onText(block.text)
              }
            }
          }
        } else if (message.type === 'result') {
          const result = message as SDKResultMessage
          if (result.subtype !== 'success') {
            callbacks.onError(`Agent query failed: ${result.subtype}`)
            return null
          }
          if (result.result && !fullText) {
            fullText = result.result
            callbacks.onText(result.result)
          }
          break
        }
      }

      callbacks.onDone()

      const collectedToolCalls = toolOrder
        .map((id) => toolCallsById.get(id))
        .filter((c): c is CollectedToolCall => Boolean(c))
      const collectedToolResults = toolOrder
        .map((id) => toolResultsById.get(id))
        .filter((r): r is CollectedToolResult => Boolean(r))

      return {
        role: 'assistant',
        content: fullText,
        toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
        toolResults: collectedToolResults.length > 0 ? collectedToolResults : undefined
      }
    } catch (error: unknown) {
      if (error instanceof Error && (error.name === 'AbortError' || signal?.aborted)) {
        return null
      }
      callbacks.onError(this.describeError(error))
      return null
    }
  }

  async verifyApiKey(_apiKey: string): Promise<boolean> {
    const status = await getClaudeCliStatus()
    return status.installed && status.auth === 'ready'
  }

  private describeError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error)
    if (/not logged in|login required|unauthorized|401/i.test(raw)) {
      return 'Claude CLI is not logged in. Run `claude login` in a terminal.'
    }
    if (/ENOENT|command not found|spawn .* ENOENT/i.test(raw)) {
      return 'The Claude Code CLI is not installed or not on PATH. Install it from https://docs.claude.com/claude-code.'
    }
    return raw || 'Unknown error'
  }

  private buildPromptFromHistory(messages: ChatMessage[]): string {
    if (messages.length === 0) return ''
    if (messages.length === 1 && messages[0].role === 'user') {
      return messages[0].content
    }
    const lines: string[] = []
    for (const msg of messages) {
      if (msg.role === 'user') lines.push(`Human: ${msg.content}`)
      else if (msg.role === 'assistant') lines.push(`Assistant: ${msg.content}`)
    }
    return lines.join('\n\n')
  }
}

export const anthropicProvider = new AnthropicProvider()
