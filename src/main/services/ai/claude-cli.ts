import { spawn } from 'child_process'

export type ClaudeCliAuthStatus = 'ready' | 'unauthenticated' | 'unknown'

export interface ClaudeCliStatus {
  installed: boolean
  executablePath: string | null
  version: string | null
  auth: ClaudeCliAuthStatus
  subscriptionType: string | null
  message: string
}

interface SpawnResult {
  code: number | null
  stdout: string
  stderr: string
  error: NodeJS.ErrnoException | null
}

function runClaude(args: string[], timeoutMs = 8000): Promise<SpawnResult> {
  return new Promise((resolve) => {
    let settled = false
    const child = spawn('claude', args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      resolve({ code: null, stdout, stderr, error: new Error('timeout') as NodeJS.ErrnoException })
    }, timeoutMs)

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error: NodeJS.ErrnoException) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code: null, stdout, stderr, error })
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code, stdout, stderr, error: null })
    })
  })
}

function parseSubscriptionType(text: string): string | null {
  const lower = text.toLowerCase()
  if (lower.includes('enterprise')) return 'Enterprise'
  if (lower.includes('team')) return 'Team'
  if (lower.includes('max')) return 'Max'
  if (lower.includes('pro')) return 'Pro'
  return null
}

export async function getClaudeCliStatus(): Promise<ClaudeCliStatus> {
  const version = await runClaude(['--version'])

  if (version.error && (version.error as NodeJS.ErrnoException).code === 'ENOENT') {
    return {
      installed: false,
      executablePath: null,
      version: null,
      auth: 'unknown',
      subscriptionType: null,
      message:
        'The Claude Code CLI is not installed or not on PATH. Install it from https://docs.claude.com/claude-code and run `claude login`.'
    }
  }

  if (version.code !== 0) {
    return {
      installed: false,
      executablePath: null,
      version: null,
      auth: 'unknown',
      subscriptionType: null,
      message: version.stderr.trim() || 'Failed to run `claude --version`.'
    }
  }

  const versionString = version.stdout.trim().split(/\s+/).slice(-1)[0] || version.stdout.trim()

  const auth = await runClaude(['auth', 'status'])
  const combinedOutput = `${auth.stdout}\n${auth.stderr}`.toLowerCase()

  if (auth.code === 0 && !combinedOutput.includes('not logged in')) {
    const subscription = parseSubscriptionType(combinedOutput)
    return {
      installed: true,
      executablePath: 'claude',
      version: versionString,
      auth: 'ready',
      subscriptionType: subscription,
      message: subscription
        ? `Signed in to Claude Code (${subscription}).`
        : 'Signed in to Claude Code.'
    }
  }

  if (combinedOutput.includes('not logged in') || combinedOutput.includes('login required')) {
    return {
      installed: true,
      executablePath: 'claude',
      version: versionString,
      auth: 'unauthenticated',
      subscriptionType: null,
      message: 'Run `claude login` in a terminal to authenticate.'
    }
  }

  return {
    installed: true,
    executablePath: 'claude',
    version: versionString,
    auth: 'unknown',
    subscriptionType: null,
    message: auth.stderr.trim() || auth.stdout.trim() || 'Could not determine Claude CLI auth status.'
  }
}
