import { BrowserWindow } from 'electron'
import type { SendMessageParams, StreamChunk } from '@shared/types'
import { aiService } from './ai/ai.service'
import { threadService } from './thread.service'
import { threadEventService } from './thread-event.service'
import { toolDefinitions, toolExecutors, type ToolContext } from '../tools'
import type { ChatMessage, StreamCallbacks } from './ai/provider.interface'
import { v4 as uuidv4 } from 'uuid'

const MAX_ITERATIONS = 25
const activeRequests = new Map<string, AbortController>()

export class AgentService {
  async handleMessage(params: SendMessageParams): Promise<void> {
    const { threadId, content, provider, model, projectPath, environmentMode, worktreePath } =
      params

    // Determine effective project path
    const effectivePath =
      environmentMode === 'worktree' && worktreePath ? worktreePath : projectPath

    // Save user message
    threadService.createMessage({
      threadId,
      role: 'user',
      content
    })

    // Build message history from DB
    const dbMessages = threadService.getMessages(threadId)

    // Update thread title if this is the first message
    if (dbMessages.length === 1 && dbMessages[0].role === 'user') {
      const title = content.slice(0, 50) + (content.length > 50 ? '...' : '')
      threadService.updateTitle(threadId, title)

      const updatedThread = threadService.getThread(threadId)
      if (updatedThread) {
        const windows = BrowserWindow.getAllWindows()
        for (const win of windows) {
          win.webContents.send('thread:update', updatedThread)
        }
      }
    }

    const chatMessages: ChatMessage[] = []

    for (const msg of dbMessages) {
      if (msg.role === 'user') {
        chatMessages.push({ role: 'user', content: msg.content })
      } else if (msg.role === 'assistant') {
        chatMessages.push({
          role: 'assistant',
          content: msg.content,
          toolCalls: msg.toolCalls
        })
      } else if (msg.role === 'tool') {
        if (msg.toolResults) {
          for (const tr of msg.toolResults) {
            chatMessages.push({
              role: 'tool',
              content: tr.content,
              toolCallId: tr.toolCallId
            })
          }
        }
      }
    }

    const systemPrompt = this.buildSystemPrompt(projectPath, environmentMode)
    const abortController = new AbortController()
    activeRequests.set(threadId, abortController)

    const context: ToolContext = { projectPath: effectivePath }
    const turnId = uuidv4()

    threadEventService.append({
      threadId,
      turnId,
      kind: 'turn.started',
      tone: 'info',
      summary: content.length > 80 ? `${content.slice(0, 80)}…` : content,
      payload: { model, provider }
    })

    try {
      const aiProvider = aiService.getProvider(provider)
      let iterations = 0

      while (iterations < MAX_ITERATIONS) {
        iterations++
        const messageId = uuidv4()

        const callbacks = this.createStreamCallbacks(threadId, messageId)

        const result = await aiProvider.sendMessage(
          chatMessages,
          model,
          toolDefinitions,
          systemPrompt,
          callbacks,
          abortController.signal,
          { threadId, cwd: effectivePath }
        )

        if (!result) break // Cancelled or error

        // Provider-executed path: the SDK (e.g. Claude Agent SDK) ran tools internally
        // and handed us back both toolCalls and toolResults. Persist both messages and stop.
        if (
          result.toolCalls &&
          result.toolCalls.length > 0 &&
          result.toolResults &&
          result.toolResults.length > 0
        ) {
          threadService.createMessage({
            threadId,
            role: 'assistant',
            content: result.content || '',
            toolCalls: result.toolCalls
          })
          threadService.createMessage({
            threadId,
            role: 'tool',
            content: '',
            toolResults: result.toolResults
          })

          // Mirror the tool activity onto the event log so the timeline can replay it.
          const resultsById = new Map(result.toolResults.map((r) => [r.toolCallId, r]))
          for (const tc of result.toolCalls) {
            threadEventService.append({
              threadId,
              turnId,
              kind: 'tool.started',
              tone: 'tool',
              summary: tc.name,
              payload: { toolCallId: tc.id, arguments: tc.arguments }
            })
            const tr = resultsById.get(tc.id)
            if (tr) {
              threadEventService.append({
                threadId,
                turnId,
                kind: tr.isError ? 'tool.failed' : 'tool.completed',
                tone: tr.isError ? 'error' : 'tool',
                summary: tr.isError ? `${tc.name} failed` : `${tc.name} completed`,
                payload: {
                  toolCallId: tc.id,
                  detail:
                    tr.content.length > 500 ? `${tr.content.slice(0, 500)}…` : tr.content
                }
              })
            }
          }

          break
        }

        if (result.toolCalls && result.toolCalls.length > 0) {
          // Save assistant message with tool calls
          threadService.createMessage({
            threadId,
            role: 'assistant',
            content: result.content || '',
            toolCalls: result.toolCalls
          })

          chatMessages.push(result)

          // Execute tools sequentially
          const toolResults: Array<{ toolCallId: string; content: string; isError?: boolean }> = []

          for (const tc of result.toolCalls) {
            threadEventService.append({
              threadId,
              turnId,
              kind: 'tool.started',
              tone: 'tool',
              summary: `${tc.name}`,
              payload: { toolCallId: tc.id, arguments: tc.arguments }
            })

            const executor = toolExecutors[tc.name]
            let resultContent: string
            let isError = false

            try {
              if (!executor) {
                throw new Error(`Unknown tool: ${tc.name}`)
              }
              resultContent = await executor(tc.arguments, context)
            } catch (error: unknown) {
              resultContent = error instanceof Error ? error.message : 'Tool execution failed'
              isError = true
            }

            toolResults.push({ toolCallId: tc.id, content: resultContent, isError })

            threadEventService.append({
              threadId,
              turnId,
              kind: isError ? 'tool.failed' : 'tool.completed',
              tone: isError ? 'error' : 'tool',
              summary: isError ? `${tc.name} failed` : `${tc.name} completed`,
              payload: {
                toolCallId: tc.id,
                detail: resultContent.length > 500 ? `${resultContent.slice(0, 500)}…` : resultContent
              }
            })

            // Send tool result to renderer
            this.sendChunk(threadId, {
              threadId,
              messageId: uuidv4(),
              type: 'tool_result',
              toolResult: { toolCallId: tc.id, content: resultContent, isError }
            })

            chatMessages.push({
              role: 'tool',
              content: resultContent,
              toolCallId: tc.id
            })
          }

          // Save tool results as a message
          threadService.createMessage({
            threadId,
            role: 'tool',
            content: '',
            toolResults
          })

          // Loop back for next AI call
          continue
        }

        // Text response (no tool calls) - save and done
        threadService.createMessage({
          threadId,
          role: 'assistant',
          content: result.content || ''
        })

        break
      }

      threadEventService.append({
        threadId,
        turnId,
        kind: 'turn.completed',
        tone: 'info',
        summary: 'Turn completed'
      })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      threadEventService.append({
        threadId,
        turnId,
        kind: 'turn.error',
        tone: 'error',
        summary: msg.length > 120 ? `${msg.slice(0, 120)}…` : msg
      })
      this.sendChunk(threadId, {
        threadId,
        messageId: uuidv4(),
        type: 'error',
        error: msg
      })
    } finally {
      activeRequests.delete(threadId)
      this.sendChunk(threadId, {
        threadId,
        messageId: '',
        type: 'done'
      })
    }
  }

  cancel(threadId: string): void {
    const controller = activeRequests.get(threadId)
    if (controller) {
      controller.abort()
      activeRequests.delete(threadId)
    }
  }

  private buildSystemPrompt(projectPath: string, environmentMode: string): string {
    return `You are QuackCode, an AI agentic coding tool. When given a task, you autonomously plan and execute it end-to-end using your tools — reading files, writing code, searching the codebase, and committing changes — without waiting for step-by-step instructions.

<environment>
Project: ${projectPath}
Mode: ${environmentMode}
</environment>

<tools>
- read_file: Read a file's contents before editing or referencing it
- write_file: Create a new file or fully overwrite an existing one
- edit_file: Make targeted, surgical edits by replacing an exact string in a file
- list_directory: Explore the project structure (use recursive=true for a full overview)
- search_files: Search for patterns across the codebase using regex
- git_status: Check current branch, staged and unstaged changes
- git_diff: View a summary of what has changed
- git_commit: Stage all changes and create a commit
</tools>

<how_to_work>
1. EXPLORE first — use list_directory and search_files to understand the codebase structure before making changes
2. READ before editing — always read_file before using edit_file or write_file on an existing file
3. PLAN — break the task into logical steps and work through them methodically
4. ACT — use tools to implement changes; prefer edit_file for targeted changes, write_file for new files or full rewrites
5. VERIFY — after making changes, re-read affected files to confirm correctness
6. COMMIT — when the task is complete and changes are correct, use git_commit with a clear, descriptive commit message
</how_to_work>

<principles>
- Be autonomous: complete the full task without asking clarifying questions unless truly blocked
- Be precise: use edit_file with exact string matches to avoid unintended changes
- Be minimal: only change what is necessary to accomplish the task
- Be correct: validate your changes by reading the file after editing
- Stay in scope: all file paths must be within the project directory
- Write clean code: follow existing code style, naming conventions, and patterns in the project
- Explain key decisions: briefly describe what you did and why at the end of your response
</principles>`
  }

  private createStreamCallbacks(threadId: string, messageId: string): StreamCallbacks {
    return {
      onText: (text) => {
        this.sendChunk(threadId, {
          threadId,
          messageId,
          type: 'text_delta',
          content: text
        })
      },
      onToolCall: (id, name, args) => {
        this.sendChunk(threadId, {
          threadId,
          messageId,
          type: 'tool_call_start',
          toolCall: { id, name, arguments: args }
        })
      },
      onToolCallDelta: (id, argsDelta) => {
        this.sendChunk(threadId, {
          threadId,
          messageId,
          type: 'tool_call_delta',
          toolCall: { id },
          content: argsDelta
        })
      },
      onError: (error) => {
        this.sendChunk(threadId, {
          threadId,
          messageId,
          type: 'error',
          error
        })
      },
      onDone: () => {
        // Individual stream done - don't send final done yet, agent loop handles that
      }
    }
  }

  private sendChunk(_threadId: string, chunk: StreamChunk): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('ai:stream', chunk)
    }
  }
}

export const agentService = new AgentService()
