import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { EOL, homedir } from 'node:os'
import { delimiter, dirname } from 'node:path'
import type { AIModel, ToolDefinition } from '@shared/types'
import type { AIProviderInterface, ChatMessage, StreamCallbacks } from './provider.interface'

type JsonRpcMessage = {
  id?: number | string
  method?: string
  params?: Record<string, unknown>
  result?: Record<string, unknown>
  error?: { message?: string; data?: { message?: string } }
}

type PendingRequest = {
  resolve: (value: Record<string, unknown>) => void
  reject: (error: Error) => void
}

type ActivePrompt = {
  callbacks: StreamCallbacks
  fullText: string
}

type ConfigOption = {
  id: string
  currentValue: string | null
  options: Array<{ value: string; name: string }>
}

type LegacyModeInfo = {
  currentModeId: string | null
}

type LegacyModelInfo = {
  currentModelId: string | null
  availableModels: AIModel[]
}

type SessionState = {
  threadId: string
  cwd: string
  process: ChildProcessWithoutNullStreams
  readyPromise: Promise<void>
  pending: Map<number, PendingRequest>
  nextId: number
  stdoutBuffer: string
  stderrBuffer: string
  sessionId: string
  currentModel: string | null
  currentMode: string | null
  modelOptions: AIModel[]
  syncedMessageCount: number
  activePrompt: ActivePrompt | null
  disposed: boolean
  exitPromise: Promise<never>
}

const FALLBACK_MODELS: AIModel[] = [{ id: 'default[]', name: 'Auto', provider: 'cursor' }]
const MODEL_DISCOVERY_THREAD_ID = '__cursor_model_discovery__'

export class CursorProvider implements AIProviderInterface {
  readonly provider = 'cursor' as const
  private apiKey: string | null = null
  private modelsCache: AIModel[] | null = null
  private sessions = new Map<string, SessionState>()
  private agentBinary: string | null = null

  setApiKey(apiKey: string): void {
    const nextApiKey = apiKey.trim() || null
    if (this.apiKey === nextApiKey) {
      return
    }

    this.apiKey = nextApiKey
    this.modelsCache = null
  }

  async listModels(): Promise<AIModel[]> {
    if (this.modelsCache) {
      return this.modelsCache
    }

    try {
      const session = await this.getOrCreateSession(MODEL_DISCOVERY_THREAD_ID, process.cwd())
      this.modelsCache = session.modelOptions.length > 0 ? session.modelOptions : FALLBACK_MODELS
    } catch {
      this.modelsCache = FALLBACK_MODELS
    } finally {
      await this.disposeThread(MODEL_DISCOVERY_THREAD_ID)
    }

    return this.modelsCache
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
      callbacks.onError('Cursor requires a thread ID and working directory')
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
        await this.ensureSessionMode(session, 'agent')
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

  async verifyApiKey(apiKey: string): Promise<boolean> {
    const previousApiKey = this.apiKey

    try {
      this.apiKey = apiKey.trim() || null
      const session = await this.getOrCreateSession(MODEL_DISCOVERY_THREAD_ID, process.cwd())
      return session.sessionId.length > 0
    } catch {
      return false
    } finally {
      await this.disposeThread(MODEL_DISCOVERY_THREAD_ID)
      this.apiKey = previousApiKey
      this.modelsCache = null
    }
  }

  async disposeThread(threadId: string): Promise<void> {
    const session = this.sessions.get(threadId)
    if (!session) return

    this.sessions.delete(threadId)
    session.disposed = true
    session.activePrompt = null
    this.failPending(session, new Error('Cursor session closed'))
    session.process.stdout.removeAllListeners('data')
    session.process.stderr.removeAllListeners('data')
    session.process.removeAllListeners('error')
    session.process.removeAllListeners('exit')
    if (!session.process.killed) {
      session.process.kill()
    }
  }

  async disposeAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((threadId) => this.disposeThread(threadId)))
    this.agentBinary = null
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

  private getBaseEnv(apiKey = this.apiKey): NodeJS.ProcessEnv {
    const pathEntries = [
      process.env.PATH || '',
      `${homedir()}/.local/bin`,
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin'
    ].filter(Boolean)

    return {
      ...process.env,
      PATH: pathEntries.join(delimiter),
      ...(apiKey ? { CURSOR_API_KEY: apiKey } : {})
    }
  }

  private getAgentBinary(): string {
    if (this.agentBinary) {
      return this.agentBinary
    }

    const env = this.getBaseEnv()
    const candidates = [
      'agent',
      `${homedir()}/.local/bin/agent`,
      '/usr/local/bin/agent',
      '/opt/homebrew/bin/agent'
    ]

    for (const candidate of candidates) {
      const result = spawnSync(candidate, ['--version'], {
        env,
        encoding: 'utf8',
        timeout: 5000,
        stdio: 'ignore'
      })
      if (!result.error && result.status === 0) {
        this.agentBinary = candidate
        return candidate
      }
    }

    this.agentBinary = 'agent'
    return this.agentBinary
  }

  private getEnv(apiKey = this.apiKey): NodeJS.ProcessEnv {
    const env = this.getBaseEnv(apiKey)
    const binary = this.getAgentBinary()

    if (binary.includes('/')) {
      const binDir = dirname(binary)
      const pathEntries = [binDir, env.PATH || '']
      env.PATH = pathEntries.filter(Boolean).join(delimiter)
    }

    return env
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
      await existing.readyPromise
      return existing
    }

    if (existing) {
      await this.disposeThread(threadId)
    }

    const agentBinary = this.getAgentBinary()
    const process = spawn(agentBinary, ['acp'], {
      cwd,
      env: this.getEnv(),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let resolveReady!: () => void
    let rejectReady!: (error: Error) => void
    const readyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })

    const session: SessionState = {
      threadId,
      cwd,
      process,
      readyPromise,
      pending: new Map<number, PendingRequest>(),
      nextId: 1,
      stdoutBuffer: '',
      stderrBuffer: '',
      sessionId: '',
      currentModel: null,
      currentMode: null,
      modelOptions: [],
      syncedMessageCount: 0,
      activePrompt: null,
      disposed: false,
      exitPromise: new Promise<never>(() => {})
    }

    session.exitPromise = new Promise<never>((_, reject) => {
      process.once('error', (error) => {
        if (session.disposed) return
        this.sessions.delete(threadId)
        rejectReady(error)
        this.failPending(session, error)
        session.activePrompt?.callbacks.onError(error.message)
        reject(error)
      })

      process.once('exit', (code) => {
        if (session.disposed) return
        this.sessions.delete(threadId)
        const error = new Error(
          session.stderrBuffer.trim() || `Cursor agent exited with code ${code ?? 'unknown'}`
        )
        rejectReady(error)
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

    try {
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

      await this.sendRequest(session, 'authenticate', { methodId: 'cursor_login' })

      const response = await this.sendRequest(session, 'session/new', { cwd, mcpServers: [] })
      session.sessionId = typeof response.sessionId === 'string' ? response.sessionId : ''
      if (!session.sessionId) {
        throw new Error('Cursor agent did not return a session ID')
      }

      this.updateSessionConfig(session, response)
      resolveReady()
      return session
    } catch (error) {
      const resolvedError = error instanceof Error ? error : new Error(String(error))
      rejectReady(resolvedError)
      await this.disposeThread(threadId)
      throw resolvedError
    }
  }

  private async ensureSessionMode(session: SessionState, mode: string): Promise<void> {
    if (session.currentMode === mode) {
      return
    }

    try {
      const response = await this.sendRequest(session, 'session/set_config_option', {
        sessionId: session.sessionId,
        configId: 'mode',
        value: mode
      })
      this.updateSessionConfig(session, response)
    } catch (error) {
      console.debug('Cursor ACP mode config fallback', {
        sessionId: session.sessionId,
        mode,
        error
      })
      const response = await this.sendRequest(session, 'session/set_mode', {
        sessionId: session.sessionId,
        modeId: mode
      })
      this.updateSessionConfig(session, response)
      session.currentMode = mode
    }
  }

  private async ensureSessionModel(session: SessionState, model: string): Promise<void> {
    if (session.currentModel === model) {
      return
    }

    try {
      const response = await this.sendRequest(session, 'session/set_config_option', {
        sessionId: session.sessionId,
        configId: 'model',
        value: model
      })
      this.updateSessionConfig(session, response)
    } catch (error) {
      console.debug('Cursor ACP model config fallback', {
        sessionId: session.sessionId,
        model,
        error
      })
      const response = await this.sendRequest(session, 'session/set_model', {
        sessionId: session.sessionId,
        modelId: model
      })
      this.updateSessionConfig(session, response)
      session.currentModel = model
    }
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
        request.reject(new Error(message.error.data?.message || message.error.message))
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
    if (sessionUpdate === 'config_option_update') {
      this.updateSessionConfig(session, update as Record<string, unknown>)
      return
    }

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
          typeof title === 'string' && title ? title : 'Cursor tool',
          rawInput && typeof rawInput === 'object' ? (rawInput as Record<string, unknown>) : {}
        )
      }
      return
    }

    if (sessionUpdate === 'tool_call_update') {
      const toolCallId = 'toolCallId' in update ? update.toolCallId : undefined
      if (typeof toolCallId !== 'string') return

      const rawInput = 'rawInput' in update ? update.rawInput : undefined
      if (rawInput && typeof rawInput === 'object') {
        activePrompt.callbacks.onToolCallDelta(toolCallId, JSON.stringify(rawInput))
        return
      }

      const status = 'status' in update ? update.status : undefined
      if (typeof status === 'string' && status) {
        activePrompt.callbacks.onToolCallDelta(toolCallId, status)
      }
    }
  }

  private handleServerRequest(session: SessionState, message: JsonRpcMessage): void {
    if (!message.method || message.id === undefined) return

    if (message.method === 'session/request_permission') {
      const params = message.params ?? {}
      const options = Array.isArray(params.options) ? params.options : []
      const selected = options.find((option) => {
        if (!option || typeof option !== 'object') return false
        const kind = 'kind' in option && typeof option.kind === 'string' ? option.kind : ''
        const optionId = this.getPermissionOptionId(option)
        return [kind, optionId].some((value) =>
          ['allow_once', 'allow-once', 'allow_always', 'allow-always'].includes(value)
        )
      })

      const optionId = selected ? this.getPermissionOptionId(selected) : null

      if (optionId) {
        console.warn('Auto-approving Cursor ACP permission request', {
          sessionId: session.sessionId,
          optionId,
          kind:
            selected && typeof selected === 'object' && 'kind' in selected ? selected.kind : null
        })
      }

      this.writeMessage(session.process, {
        jsonrpc: '2.0',
        id: message.id,
        result: optionId
          ? { outcome: { outcome: 'selected', optionId } }
          : { outcome: { outcome: 'cancelled' } }
      })
    }
  }

  private getPermissionOptionId(option: object): string {
    if ('optionId' in option && typeof option.optionId === 'string') {
      return option.optionId
    }
    if ('id' in option && typeof option.id === 'string') {
      return option.id
    }
    return ''
  }

  private updateSessionConfig(session: SessionState, payload: Record<string, unknown>): void {
    const configOptions = this.extractConfigOptions(payload)
    const modelOption = configOptions.find((option) => option.id === 'model')
    const modeOption = configOptions.find((option) => option.id === 'mode')
    const legacyModels = this.extractLegacyModels(payload)
    const legacyModes = this.extractLegacyModes(payload)

    if (modelOption) {
      session.currentModel = modelOption.currentValue
      session.modelOptions = modelOption.options.map((option) => ({
        id: option.value,
        name: option.name,
        provider: 'cursor' as const
      }))
    } else if (legacyModels.availableModels.length > 0) {
      session.currentModel = legacyModels.currentModelId
      session.modelOptions = legacyModels.availableModels
    }

    if (modeOption) {
      session.currentMode = modeOption.currentValue
    } else if (legacyModes.currentModeId) {
      session.currentMode = legacyModes.currentModeId
    }

    if (session.modelOptions.length === 0) {
      session.modelOptions = FALLBACK_MODELS
    }
  }

  private extractConfigOptions(payload: Record<string, unknown>): ConfigOption[] {
    const rawOptions = Array.isArray(payload.configOptions) ? payload.configOptions : []

    return rawOptions.flatMap((option): ConfigOption[] => {
      if (
        !option ||
        typeof option !== 'object' ||
        !('id' in option) ||
        typeof option.id !== 'string'
      ) {
        return []
      }

      const options = Array.isArray(option.options)
        ? option.options.flatMap((value) => {
            if (
              !value ||
              typeof value !== 'object' ||
              !('value' in value) ||
              typeof value.value !== 'string'
            ) {
              return []
            }

            return [
              {
                value: value.value,
                name:
                  'name' in value && typeof value.name === 'string' && value.name
                    ? value.name
                    : value.value
              }
            ]
          })
        : []

      return [
        {
          id: option.id,
          currentValue:
            'currentValue' in option && typeof option.currentValue === 'string'
              ? option.currentValue
              : null,
          options
        }
      ]
    })
  }

  private extractLegacyModes(payload: Record<string, unknown>): LegacyModeInfo {
    const modes = payload.modes
    if (!modes || typeof modes !== 'object') {
      return { currentModeId: null }
    }

    return {
      currentModeId:
        'currentModeId' in modes && typeof modes.currentModeId === 'string'
          ? modes.currentModeId
          : null
    }
  }

  private extractLegacyModels(payload: Record<string, unknown>): LegacyModelInfo {
    const models = payload.models
    if (!models || typeof models !== 'object') {
      return { currentModelId: null, availableModels: [] }
    }

    const typedModels = models as {
      availableModels?: unknown
      currentModelId?: unknown
    }

    const availableModels = Array.isArray(typedModels.availableModels)
      ? typedModels.availableModels.flatMap((model): AIModel[] => {
          if (!model || typeof model !== 'object') {
            return []
          }

          const id = 'modelId' in model && typeof model.modelId === 'string' ? model.modelId : null
          if (!id) {
            return []
          }

          const name = 'name' in model && typeof model.name === 'string' ? model.name : id
          return [{ id, name, provider: 'cursor' }]
        })
      : []

    return {
      currentModelId:
        typeof typedModels.currentModelId === 'string' ? typedModels.currentModelId : null,
      availableModels
    }
  }

  private failPending(session: SessionState, error: Error): void {
    for (const request of session.pending.values()) {
      request.reject(error)
    }
    session.pending.clear()
  }
}

export const cursorProvider = new CursorProvider()
