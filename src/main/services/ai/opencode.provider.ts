import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { EOL } from 'node:os'
import type { AIModel, ToolDefinition } from '@shared/types'
import type { AIProviderInterface, ChatMessage, StreamCallbacks } from './provider.interface'

type JsonRpcMessage = {
  id?: number | string
  method?: string
  params?: Record<string, unknown>
  result?: Record<string, unknown>
  error?: { message?: string }
}

type PendingRequest = {
  resolve: (value: Record<string, unknown>) => void
  reject: (error: Error) => void
}

type ActivePrompt = {
  callbacks: StreamCallbacks
  fullText: string
}

type SessionState = {
  threadId: string
  cwd: string
  process: ChildProcessWithoutNullStreams
  pending: Map<number, PendingRequest>
  nextId: number
  stdoutBuffer: string
  stderrBuffer: string
  sessionId: string
  currentModel: string | null
  syncedMessageCount: number
  activePrompt: ActivePrompt | null
  disposed: boolean
  exitPromise: Promise<never>
}

const FALLBACK_MODELS: AIModel[] = [
  { id: 'opencode/big-pickle', name: 'OpenCode Zen/Big Pickle', provider: 'opencode' },
  { id: 'openai/gpt-5.1-codex', name: 'OpenAI/GPT-5.1 Codex', provider: 'opencode' },
  {
    id: 'anthropic/claude-sonnet-4-5-20250929',
    name: 'Anthropic/Claude Sonnet 4.5',
    provider: 'opencode'
  }
]

export class OpencodeProvider implements AIProviderInterface {
  readonly provider = 'opencode' as const
  private apiKey: string | null = null
  private modelsCache: AIModel[] | null = null
  private sessions = new Map<string, SessionState>()

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey.trim() || null
    this.modelsCache = null
  }

  listModels(): AIModel[] {
    if (this.modelsCache) {
      return this.modelsCache
    }

    try {
      const models = this.loadModelsFromCli()
      this.modelsCache = models.length > 0 ? models : FALLBACK_MODELS
    } catch {
      this.modelsCache = FALLBACK_MODELS
    }

    return this.modelsCache
  }

  private loadModelsFromCli(): AIModel[] {
    const result = spawnSync('opencode', ['models'], {
      env: this.getEnv(),
      encoding: 'utf8',
      timeout: 10000
    })

    if (result.error) {
      throw result.error
    }

    const output = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (output.length === 0) {
      throw new Error(result.stderr || 'OpenCode models command returned no models')
    }

    return output.map((modelId) => ({
      id: modelId,
      name: this.formatModelName(modelId),
      provider: 'opencode' as const
    }))
  }

  async sendMessage(
    messages: ChatMessage[],
    model: string,
    _tools: ToolDefinition[],
    systemPrompt: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
    context?: { threadId?: string; cwd?: string }
  ): Promise<ChatMessage | null> {
    const threadId = context?.threadId
    const cwd = context?.cwd
    if (!threadId || !cwd) {
      callbacks.onError('OpenCode requires a thread ID and working directory')
      return null
    }

    try {
      const session = await this.getOrCreateSession(threadId, cwd)
      const promptText = this.buildPrompt(messages, systemPrompt, session.syncedMessageCount)
      if (!promptText) {
        callbacks.onDone()
        return { role: 'assistant', content: '' }
      }

      session.activePrompt = { callbacks, fullText: '' }
      const onAbort = (): void => {
        void this.cancelSessionPrompt(session)
      }
      signal?.addEventListener('abort', onAbort)

      try {
        await this.ensureSessionModel(session, model)
        const promptResponse = await this.sendRequest(session, 'session/prompt', {
          sessionId: session.sessionId,
          prompt: [{ type: 'text', text: promptText }]
        })

        if (signal?.aborted || promptResponse.stopReason === 'cancelled') {
          await this.disposeThread(threadId)
          return null
        }

        session.syncedMessageCount = messages.length
        callbacks.onDone()
        return { role: 'assistant', content: session.activePrompt.fullText }
      } finally {
        signal?.removeEventListener('abort', onAbort)
        session.activePrompt = null
      }
    } catch (error: unknown) {
      if (signal?.aborted) {
        return null
      }

      const message = error instanceof Error ? error.message : 'Unknown error'
      callbacks.onError(message)
      await this.disposeThread(threadId)
      return null
    }
  }

  async disposeThread(threadId: string): Promise<void> {
    const session = this.sessions.get(threadId)
    if (!session) return

    this.sessions.delete(threadId)
    session.disposed = true
    session.activePrompt = null
    this.failPending(session, new Error('OpenCode session closed'))
    session.process.stdout.removeAllListeners('data')
    session.process.stderr.removeAllListeners('data')
    session.process.removeAllListeners('error')
    session.process.removeAllListeners('exit')
    if (!session.process.killed) {
      session.process.kill()
    }
  }

  async verifyApiKey(apiKey: string): Promise<boolean> {
    try {
      const process = spawn('opencode', ['acp'], {
        env: this.getEnv(apiKey),
        stdio: ['pipe', 'pipe', 'pipe']
      })

      const initRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: 1,
          clientCapabilities: {
            fs: { readTextFile: false, writeTextFile: false },
            terminal: false
          },
          clientInfo: {
            name: 'quackcode',
            title: 'QuackCode',
            version: '1.0.0'
          }
        }
      })

      process.stdin.write(`${initRequest}${EOL}`)
      process.stdin.end()

      const stdout = await new Promise<string>((resolve, reject) => {
        let output = ''
        let errorOutput = ''

        process.stdout.on('data', (chunk: Buffer | string) => {
          output += chunk.toString()
        })

        process.stderr.on('data', (chunk: Buffer | string) => {
          errorOutput += chunk.toString()
        })

        process.once('error', reject)
        process.once('exit', () => {
          if (output) {
            resolve(output)
            return
          }
          reject(new Error(errorOutput || 'OpenCode initialization failed'))
        })
      })

      return stdout.split(/\r?\n/).some((line) => {
        try {
          const message = JSON.parse(line) as JsonRpcMessage
          return message.id === 1 && !!message.result
        } catch {
          return false
        }
      })
    } catch {
      return false
    }
  }

  private buildPrompt(
    messages: ChatMessage[],
    systemPrompt: string,
    syncedMessageCount: number
  ): string {
    if (syncedMessageCount === 0 && messages.length === 1 && messages[0].role === 'user') {
      return `${systemPrompt}${EOL}${EOL}${messages[0].content}`
    }

    if (syncedMessageCount > 0) {
      const unsyncedMessages = messages
        .slice(syncedMessageCount)
        .filter((message) => message.role !== 'assistant')
      if (unsyncedMessages.length === 0) {
        return ''
      }
      return this.formatMessages(unsyncedMessages)
    }

    return [
      systemPrompt,
      'Conversation history follows. Continue from the latest user request without repeating earlier answers.',
      this.formatMessages(messages)
    ].join(`${EOL}${EOL}`)
  }

  private formatMessages(messages: ChatMessage[]): string {
    return messages
      .map((message) => {
        if (message.role === 'tool') {
          const prefix = message.toolCallId ? `Tool (${message.toolCallId})` : 'Tool'
          return `${prefix}: ${message.content}`
        }

        const label = message.role === 'assistant' ? 'Assistant' : 'User'
        return `${label}: ${message.content}`
      })
      .join(`${EOL}${EOL}`)
  }

  private formatModelName(modelId: string): string {
    const [, provider, rawName] = modelId.match(/^([^/]+)\/(.+)$/) ?? []
    if (!provider || !rawName) {
      return modelId
    }

    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1)
    const modelName = rawName
      .split(/[-_]+/)
      .map((segment) => {
        if (/^\d+(?:\.\d+)?$/.test(segment)) return segment
        if (segment.length <= 3) return segment.toUpperCase()
        return segment.charAt(0).toUpperCase() + segment.slice(1)
      })
      .join(' ')

    return `${providerName}/${modelName}`
  }

  private getEnv(apiKey = this.apiKey): NodeJS.ProcessEnv {
    return {
      ...process.env,
      ...(apiKey ? { OPENCODE_API_KEY: apiKey } : {})
    }
  }

  private writeMessage(
    process: ChildProcessWithoutNullStreams,
    message: Record<string, unknown>
  ): void {
    process.stdin.write(`${JSON.stringify(message)}${EOL}`)
  }

  private async getOrCreateSession(threadId: string, cwd: string): Promise<SessionState> {
    const existing = this.sessions.get(threadId)
    if (existing && existing.cwd === cwd && !existing.disposed) {
      return existing
    }

    if (existing) {
      await this.disposeThread(threadId)
    }

    const process = spawn('opencode', ['acp', '--cwd', cwd], {
      env: this.getEnv(),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const session: SessionState = {
      threadId,
      cwd,
      process,
      pending: new Map<number, PendingRequest>(),
      nextId: 1,
      stdoutBuffer: '',
      stderrBuffer: '',
      sessionId: '',
      currentModel: null,
      syncedMessageCount: 0,
      activePrompt: null,
      disposed: false,
      exitPromise: Promise.reject(new Error('OpenCode session not initialized'))
    }

    session.exitPromise = new Promise<never>((_, reject) => {
      process.once('error', (error) => {
        if (session.disposed) return
        this.sessions.delete(threadId)
        this.failPending(session, error)
        session.activePrompt?.callbacks.onError(error.message)
        reject(error)
      })

      process.once('exit', (code) => {
        if (session.disposed) return
        this.sessions.delete(threadId)
        const error = new Error(
          session.stderrBuffer.trim() || `OpenCode exited with code ${code ?? 'unknown'}`
        )
        this.failPending(session, error)
        session.activePrompt?.callbacks.onError(error.message)
        reject(error)
      })
    })

    process.stdout.on('data', (chunk: Buffer | string) => {
      session.stdoutBuffer += chunk.toString()
      const lines = session.stdoutBuffer.split(/\r?\n/)
      session.stdoutBuffer = lines.pop() ?? ''
      for (const line of lines) {
        this.handleMessage(session, line)
      }
    })

    process.stderr.on('data', (chunk: Buffer | string) => {
      session.stderrBuffer += chunk.toString()
    })

    this.sessions.set(threadId, session)

    await this.sendRequest(session, 'initialize', {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false
      },
      clientInfo: {
        name: 'quackcode',
        title: 'QuackCode',
        version: '1.0.0'
      }
    })

    const response = await this.sendRequest(session, 'session/new', { cwd, mcpServers: [] })
    session.sessionId = typeof response.sessionId === 'string' ? response.sessionId : ''
    if (!session.sessionId) {
      throw new Error('OpenCode did not return a session ID')
    }

    const modes = response.modes
    if (
      modes &&
      typeof modes === 'object' &&
      'currentModeId' in modes &&
      modes.currentModeId !== 'build'
    ) {
      await this.sendRequest(session, 'session/set_mode', {
        sessionId: session.sessionId,
        modeId: 'build'
      })
    }

    return session
  }

  private async ensureSessionModel(session: SessionState, model: string): Promise<void> {
    if (session.currentModel === model) {
      return
    }

    await this.sendRequest(session, 'session/set_model', {
      sessionId: session.sessionId,
      modelId: model
    })
    session.currentModel = model
  }

  private async cancelSessionPrompt(session: SessionState): Promise<void> {
    if (!session.sessionId || session.disposed) return

    try {
      this.writeMessage(session.process, {
        jsonrpc: '2.0',
        method: 'session/cancel',
        params: { sessionId: session.sessionId }
      })
    } catch {
      await this.disposeThread(session.threadId)
    }
  }

  private sendRequest(
    session: SessionState,
    method: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const id = session.nextId++
    const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
      session.pending.set(id, { resolve, reject })
    })

    this.writeMessage(session.process, {
      jsonrpc: '2.0',
      id,
      method,
      params
    })

    return Promise.race([promise, session.exitPromise])
  }

  private handleMessage(session: SessionState, line: string): void {
    if (!line.trim()) return

    let message: JsonRpcMessage
    try {
      message = JSON.parse(line) as JsonRpcMessage
    } catch {
      return
    }

    if (typeof message.id === 'number' && session.pending.has(message.id)) {
      const request = session.pending.get(message.id)
      if (!request) return
      session.pending.delete(message.id)

      if (message.error?.message) {
        request.reject(new Error(message.error.message))
      } else {
        request.resolve((message.result as Record<string, unknown>) ?? {})
      }
      return
    }

    if (message.method === 'session/update' && message.params) {
      this.handleSessionUpdate(session, message.params)
      return
    }

    void this.handleServerRequest(session, message)
  }

  private handleSessionUpdate(session: SessionState, params: Record<string, unknown>): void {
    const update = params.update
    if (!update || typeof update !== 'object') return

    const sessionUpdate = 'sessionUpdate' in update ? update.sessionUpdate : undefined
    const activePrompt = session.activePrompt
    if (!activePrompt) return

    if (sessionUpdate === 'agent_message_chunk') {
      const content = 'content' in update ? update.content : undefined
      if (content && typeof content === 'object' && 'type' in content && content.type === 'text') {
        const text = 'text' in content && typeof content.text === 'string' ? content.text : ''
        if (text) {
          activePrompt.fullText += text
          activePrompt.callbacks.onText(text)
        }
      }
      return
    }

    if (sessionUpdate === 'tool_call') {
      const toolCallId = 'toolCallId' in update ? update.toolCallId : undefined
      const title = 'title' in update ? update.title : undefined
      const rawInput = 'rawInput' in update ? update.rawInput : undefined
      if (typeof toolCallId === 'string') {
        activePrompt.callbacks.onToolCall(
          toolCallId,
          typeof title === 'string' && title ? title : 'OpenCode tool',
          rawInput && typeof rawInput === 'object' ? (rawInput as Record<string, unknown>) : {}
        )
      }
      return
    }

    if (sessionUpdate === 'tool_call_update') {
      const toolCallId = 'toolCallId' in update ? update.toolCallId : undefined
      const rawInput = 'rawInput' in update ? update.rawInput : undefined
      if (typeof toolCallId === 'string' && rawInput && typeof rawInput === 'object') {
        activePrompt.callbacks.onToolCallDelta(toolCallId, JSON.stringify(rawInput))
      }
    }
  }

  private handleServerRequest(session: SessionState, message: JsonRpcMessage): void {
    if (!message.method || message.id === undefined) return

    if (message.method === 'session/request_permission') {
      const params = message.params ?? {}
      const options = Array.isArray(params.options) ? params.options : []
      const selected = options.find(
        (option) =>
          option &&
          typeof option === 'object' &&
          'kind' in option &&
          (option.kind === 'allow_once' || option.kind === 'allow_always')
      )
      const optionId =
        selected && typeof selected === 'object' && 'optionId' in selected
          ? selected.optionId
          : options[0] && typeof options[0] === 'object' && 'optionId' in options[0]
            ? options[0].optionId
            : null

      this.writeMessage(session.process, {
        jsonrpc: '2.0',
        id: message.id,
        result: optionId
          ? { outcome: { outcome: 'selected', optionId } }
          : { outcome: { outcome: 'cancelled' } }
      })
    }
  }

  private failPending(session: SessionState, error: Error): void {
    for (const request of session.pending.values()) {
      request.reject(error)
    }
    session.pending.clear()
  }
}

export const opencodeProvider = new OpencodeProvider()
