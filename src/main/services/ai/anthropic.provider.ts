import { query } from '@anthropic-ai/claude-agent-sdk'
import type {
  SDKAssistantMessage,
  SDKPartialAssistantMessage,
  SDKResultMessage,
  SDKToolProgressMessage
} from '@anthropic-ai/claude-agent-sdk'
import type {
  BetaRawMessageStreamEvent,
  BetaRawContentBlockStartEvent,
  BetaRawContentBlockDeltaEvent
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type { AIModel, ToolDefinition } from '@shared/types'
import type { AIProviderInterface, ChatMessage, StreamCallbacks } from './provider.interface'

export class AnthropicProvider implements AIProviderInterface {
  readonly provider = 'anthropic'
  private apiKey: string | null = null
  private authToken: string | null = null

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey.trim() || null
    this.authToken = null
  }

  setAuthToken(token: string): void {
    this.authToken = token.trim() || null
    this.apiKey = null
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
    const env: Record<string, string | undefined> = { ...process.env }
    if (this.apiKey) {
      env['ANTHROPIC_API_KEY'] = this.apiKey
    } else if (this.authToken) {
      env['ANTHROPIC_API_KEY'] = this.authToken
    } else {
      callbacks.onError('Anthropic API key not configured')
      return null
    }

    const prompt = this.buildPromptFromHistory(messages)
    const abortController = new AbortController()
    if (signal) {
      signal.addEventListener('abort', () => abortController.abort())
    }

    try {
      const agentQuery = query({
        prompt,
        options: {
          model,
          systemPrompt,
          env,
          // Use the Agent SDK's built-in toolset (Bash, Read, Edit, Glob, Grep, WebSearch, etc.)
          // The agent SDK executes these internally — we never return toolCalls to the app loop
          allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
          permissionMode: 'dontAsk',
          includePartialMessages: true,
          persistSession: false,
          abortController
        }
      })

      // Accumulate text across all assistant turns (the agent may do multiple turns)
      let fullText = ''
      let currentToolId = ''
      // UUIDs of turns whose text/tool-calls already arrived via stream_events.
      // stream_event and assistant messages for the same turn share the same uuid,
      // so we use it to avoid double-emitting in the assistant-message fallback.
      const streamedTurnIds = new Set<string>()

      for await (const message of agentQuery) {
        if (signal?.aborted) break

        if (message.type === 'stream_event') {
          // Streaming deltas — text and tool input JSON (only when includePartialMessages: true)
          const partialMsg = message as SDKPartialAssistantMessage
          const event = partialMsg.event as BetaRawMessageStreamEvent

          if (event.type === 'message_start') {
            // New assistant turn — clear stale tool id
            currentToolId = ''
          } else if (event.type === 'content_block_start') {
            const startEvent = event as BetaRawContentBlockStartEvent
            if (startEvent.content_block.type === 'tool_use') {
              currentToolId = startEvent.content_block.id
              // Notify UI that a tool call is starting (display-only; app doesn't execute it)
              callbacks.onToolCall(currentToolId, startEvent.content_block.name, {})
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
              // Stream the tool input JSON to the UI for display
              callbacks.onToolCallDelta(currentToolId, delta.partial_json)
            }
          } else if (event.type === 'content_block_stop') {
            currentToolId = ''
          }
        } else if (message.type === 'tool_progress') {
          // Tool execution in progress — notify UI with elapsed time context
          const prog = message as SDKToolProgressMessage
          callbacks.onToolCall(prog.tool_use_id, prog.tool_name, {
            elapsed_seconds: prog.elapsed_time_seconds
          })
        } else if (message.type === 'assistant') {
          // Complete assistant turn — emit anything not already sent via stream_events
          const assistantMsg = message as SDKAssistantMessage
          if (assistantMsg.error) {
            callbacks.onError(`Anthropic error: ${assistantMsg.error}`)
            return null
          }
          // Only use the assistant message as a fallback when no stream_events arrived for this turn
          if (!streamedTurnIds.has(assistantMsg.uuid)) {
            for (const block of assistantMsg.message.content) {
              if (block.type === 'text' && block.text) {
                fullText += block.text
                callbacks.onText(block.text)
              } else if (block.type === 'tool_use') {
                callbacks.onToolCall(block.id, block.name, block.input as Record<string, unknown>)
              }
            }
          }
        } else if (message.type === 'result') {
          // Agent loop complete — use result.result as the canonical final text if available
          const result = message as SDKResultMessage
          if (result.subtype !== 'success') {
            callbacks.onError(`Agent query failed: ${result.subtype}`)
            return null
          }
          // result.result is the final text summary from the agent
          if (result.result && !fullText) {
            fullText = result.result
            callbacks.onText(result.result)
          }
          break
        }
      }

      callbacks.onDone()

      // IMPORTANT: Never return toolCalls — the Agent SDK executed all tools internally.
      // Returning toolCalls would cause the AgentService loop to try executing them
      // with the app's own executors, which don't know about Claude Code's built-in tools.
      return { role: 'assistant', content: fullText }
    } catch (error: unknown) {
      if (error instanceof Error && (error.name === 'AbortError' || signal?.aborted)) {
        return null
      }
      const msg = error instanceof Error ? error.message : 'Unknown error'
      callbacks.onError(msg)
      return null
    }
  }

  async verifyApiKey(apiKey: string): Promise<boolean> {
    try {
      const env: Record<string, string | undefined> = { ...process.env, ANTHROPIC_API_KEY: apiKey }
      const agentQuery = query({
        prompt: 'hi',
        options: {
          model: 'claude-haiku-4-5',
          env,
          allowedTools: [],
          maxTurns: 1
        }
      })

      for await (const message of agentQuery) {
        if (message.type === 'result') {
          const result = message as SDKResultMessage
          return result.subtype === 'success'
        }
        if (message.type === 'assistant') {
          const assistantMsg = message as SDKAssistantMessage
          return !assistantMsg.error
        }
      }
      return false
    } catch {
      return false
    }
  }

  /**
   * Reconstructs the full conversation as a formatted prompt string for the agent.
   * Since the Agent SDK starts a fresh session each call, conversation history
   * is embedded directly in the prompt.
   */
  private buildPromptFromHistory(messages: ChatMessage[]): string {
    if (messages.length === 0) return ''

    // Single user message — return directly
    if (messages.length === 1 && messages[0].role === 'user') {
      return messages[0].content
    }

    // Multi-turn: encode prior history, ending with the latest user message
    const lines: string[] = []
    for (const msg of messages) {
      if (msg.role === 'user') {
        lines.push(`Human: ${msg.content}`)
      } else if (msg.role === 'assistant') {
        lines.push(`Assistant: ${msg.content}`)
      }
      // tool results are internal to the agent SDK — omit them from the prompt
    }

    return lines.join('\n\n')
  }
}

export const anthropicProvider = new AnthropicProvider()
