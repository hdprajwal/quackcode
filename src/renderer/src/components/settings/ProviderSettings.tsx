import { useState } from 'react'
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, LogOut } from 'lucide-react'
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

export function ProviderSettings({ provider, label }: ProviderSettingsProps): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const config = settings.providers[provider]
  const { updateProvider, verifyApiKey, loadSettings } = useSettings()

  const [apiKey, setApiKey] = useState(config?.apiKey || '')
  const [showKey, setShowKey] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState<boolean | null>(null)
  const [authMode, setAuthMode] = useState<'apiKey' | 'claudePro'>(
    config?.authMode ?? 'apiKey'
  )
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [proVerifying, setProVerifying] = useState(false)
  const [proVerified, setProVerified] = useState<boolean | null>(null)

  const logoProvider = provider === 'gemini' ? 'google' : provider
  const isClaudeProConnected =
    provider === 'anthropic' && config?.authMode === 'claudePro' && !!config?.claudeProToken

  const handleSave = async (): Promise<void> => {
    await updateProvider(provider, { apiKey, enabled: !!apiKey })
  }

  const handleVerify = async (): Promise<void> => {
    setVerifying(true)
    setVerified(null)
    try {
      const ok = await verifyApiKey(provider, apiKey)
      setVerified(ok)
      if (ok) {
        await handleSave()
      }
    } catch {
      setVerified(false)
    } finally {
      setVerifying(false)
    }
  }

  const handleClaudeProConnect = async (): Promise<void> => {
    setConnectLoading(true)
    setConnectError(null)
    try {
      const result = await invoke<{ success: boolean; subscriptionType?: string; error?: string }>(
        'auth:claudePro:connect'
      )
      if (result.success) {
        await loadSettings()
      } else {
        setConnectError(result.error ?? 'Could not connect')
      }
    } catch (err) {
      setConnectError(String(err))
    } finally {
      setConnectLoading(false)
    }
  }

  const handleClaudeProVerify = async (): Promise<void> => {
    setProVerifying(true)
    setProVerified(null)
    try {
      const ok = await invoke<boolean>('auth:claudePro:verify')
      setProVerified(ok)
    } catch {
      setProVerified(false)
    } finally {
      setProVerifying(false)
    }
  }

  const handleClaudeProLogout = async (): Promise<void> => {
    await invoke('auth:claudePro:logout')
    await loadSettings()
    setAuthMode('apiKey')
    setProVerified(null)
  }

  if (provider !== 'anthropic') {
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
              placeholder="API Key"
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
          <Button size="sm" onClick={handleVerify} disabled={!apiKey || verifying}>
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
        {verified === false && <p className="text-xs text-destructive">Invalid API key</p>}
        {verified === true && <p className="text-xs text-green-500">API key verified and saved</p>}
      </div>
    )
  }

  // Anthropic-specific UI with API key / Claude Pro toggle
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <ModelSelectorLogo provider={logoProvider} className="size-4" />
        <span>{label}</span>
      </label>

      {/* Auth mode tabs */}
      <div className="flex rounded-md border border-border text-xs">
        <button
          type="button"
          className={`flex-1 rounded-l-md px-3 py-1.5 transition-colors ${
            authMode === 'apiKey'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setAuthMode('apiKey')}
        >
          API Key
        </button>
        <button
          type="button"
          className={`flex-1 rounded-r-md px-3 py-1.5 transition-colors ${
            authMode === 'claudePro'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setAuthMode('claudePro')}
        >
          Claude Pro
        </button>
      </div>

      {authMode === 'apiKey' ? (
        <div className="space-y-1">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setVerified(null)
                }}
                placeholder="API Key"
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
            <Button size="sm" onClick={handleVerify} disabled={!apiKey || verifying}>
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
          {verified === false && <p className="text-xs text-destructive">Invalid API key</p>}
          {verified === true && (
            <p className="text-xs text-green-500">API key verified and saved</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {isClaudeProConnected ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Using Claude Code session</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClaudeProVerify}
                    disabled={proVerifying}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {proVerifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : proVerified === true ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : proVerified === false ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      'Verify'
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClaudeProLogout}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {proVerified === false && (
                <p className="text-xs text-destructive">
                  Connection failed — session may be expired. Open Claude Code to refresh.
                </p>
              )}
              {proVerified === true && (
                <p className="text-xs text-green-500">Connection verified</p>
              )}
            </div>
          ) : (
            <>
              <Button className="w-full" onClick={handleClaudeProConnect} disabled={connectLoading}>
                {connectLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking…
                  </>
                ) : (
                  'Use Claude Code session'
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Reads credentials from{' '}
                <code className="font-mono">~/.claude/.credentials.json</code>
              </p>
            </>
          )}
          {connectError && <p className="text-xs text-destructive">{connectError}</p>}
        </div>
      )}
    </div>
  )
}
