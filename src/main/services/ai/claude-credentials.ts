import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

interface ClaudeCodeCredentials {
  claudeAiOauth: {
    accessToken: string
    refreshToken: string
    expiresAt: number
    subscriptionType: string
    scopes: string[]
    rateLimitTier: string
  }
}

export interface ClaudeProToken {
  accessToken: string
  refreshToken: string
  expiresAt: number
  subscriptionType: string
}

const CREDENTIALS_PATH = join(homedir(), '.claude', '.credentials.json')

export function readClaudeCodeToken(): ClaudeProToken | null {
  try {
    const raw = readFileSync(CREDENTIALS_PATH, 'utf-8')
    const data = JSON.parse(raw) as ClaudeCodeCredentials
    const oauth = data?.claudeAiOauth
    if (!oauth?.accessToken) return null
    return {
      accessToken: oauth.accessToken,
      refreshToken: oauth.refreshToken,
      expiresAt: oauth.expiresAt,
      subscriptionType: oauth.subscriptionType
    }
  } catch {
    return null
  }
}

export function isTokenExpired(expiresAt: number): boolean {
  // 60 second buffer
  return Date.now() >= expiresAt - 60_000
}
