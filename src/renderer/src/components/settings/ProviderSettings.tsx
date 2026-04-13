import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Terminal,
  XCircle
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ModelSelectorLogo } from '@renderer/components/ai-elements/model-selector'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useSettings } from '@renderer/hooks/useSettings'
import { invoke } from '@renderer/lib/ipc'
import type { AIProvider } from '@shared/types'

interface ProviderSettingsProps {
  provider: AIProvider
  label: string
}

interface ClaudeCliStatus {
  installed: boolean
  executablePath: string | null
  version: string | null
  auth: 'ready' | 'unauthenticated' | 'unknown'
  subscriptionType: string | null
  message: string
}

function ClaudeCliPanel({ label }: { label: string }): React.JSX.Element {
  const [status, setStatus] = useState<ClaudeCliStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async (): Promise<void> => {
    setLoading(true)
    try {
      const next = await invoke<ClaudeCliStatus>('auth:claudeCli:status')
      setStatus(next)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const statusKind: 'ok' | 'warn' | 'error' | 'loading' = loading
    ? 'loading'
    : !status
      ? 'error'
      : !status.installed
        ? 'error'
        : status.auth === 'ready'
          ? 'ok'
          : 'warn'

  const Icon =
    statusKind === 'ok'
      ? CheckCircle
      : statusKind === 'warn'
        ? AlertTriangle
        : statusKind === 'error'
          ? XCircle
          : Loader2

  const iconClass =
    statusKind === 'ok'
      ? 'text-green-500'
      : statusKind === 'warn'
        ? 'text-amber-400'
        : statusKind === 'error'
          ? 'text-destructive'
          : 'text-muted-foreground animate-spin'

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <ModelSelectorLogo provider="anthropic" className="size-4" />
        <span>{label}</span>
      </label>

      <div className="rounded-md border border-border">
        <div className="flex items-start justify-between gap-3 px-3 py-2.5">
          <div className="flex min-w-0 items-start gap-2">
            <Icon className={`mt-0.5 size-4 shrink-0 ${iconClass}`} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">
                {loading
                  ? 'Checking Claude Code CLI…'
                  : !status?.installed
                    ? 'Claude Code CLI not detected'
                    : status.auth === 'ready'
                      ? status.subscriptionType
                        ? `Signed in to Claude Code (${status.subscriptionType})`
                        : 'Signed in to Claude Code'
                      : 'Claude Code CLI is not logged in'}
              </div>
              {status?.version ? (
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Terminal className="size-3" />
                    {status.version}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => void refresh()}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Recheck Claude CLI status"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {status && !loading ? (
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            {status.auth === 'ready' ? (
              <>Claude models are available — quackcode uses your local CLI session.</>
            ) : (
              status.message
            )}
          </div>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        quackcode talks to Claude through the locally-installed{' '}
        <code className="font-mono">claude</code> CLI. No API key is stored in this app.
      </p>
    </div>
  )
}

export function ProviderSettings({ provider, label }: ProviderSettingsProps): React.JSX.Element {
  if (provider === 'anthropic') {
    return <ClaudeCliPanel label={label} />
  }
  return <ApiKeyPanel provider={provider} label={label} />
}

function ApiKeyPanel({ provider, label }: ProviderSettingsProps): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const config = settings.providers[provider]
  const { updateProvider, verifyApiKey } = useSettings()

  const [apiKey, setApiKey] = useState(config?.apiKey || '')
  const [showKey, setShowKey] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState<boolean | null>(null)

  const logoProvider = provider === 'gemini' ? 'google' : provider
  const isCliProvider = provider === 'opencode' || provider === 'cursor'
  const cliCommand = provider === 'cursor' ? 'agent acp' : 'opencode acp'
  const cliAuthEnv = provider === 'cursor' ? 'CURSOR_API_KEY' : 'OPENCODE_API_KEY'

  const handleSave = async (): Promise<void> => {
    await updateProvider(provider, { apiKey, enabled: isCliProvider || !!apiKey })
  }

  const handleVerify = async (): Promise<void> => {
    setVerifying(true)
    setVerified(null)
    try {
      const ok = await verifyApiKey(provider, apiKey)
      setVerified(ok)
      if (ok) await handleSave()
    } catch {
      setVerified(false)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <ModelSelectorLogo provider={logoProvider} className="size-4" />
        <span>{label}</span>
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              setVerified(null)
            }}
            placeholder={isCliProvider ? `Optional ${cliAuthEnv}` : 'API Key'}
            className="pr-8"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button
          size="sm"
          onClick={handleVerify}
          disabled={(!apiKey && !isCliProvider) || verifying}
        >
          {verifying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : verified === true ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : verified === false ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            'Verify'
          )}
        </Button>
      </div>
      {isCliProvider && (
        <p className="text-xs text-muted-foreground">
          Uses your local <code className="font-mono">{cliCommand}</code> install. The API key is
          optional when the CLI is already authenticated.
        </p>
      )}
      {verified === false && <p className="text-xs text-destructive">Invalid API key</p>}
      {verified === true && <p className="text-xs text-green-500">API key verified and saved</p>}
    </div>
  )
}
