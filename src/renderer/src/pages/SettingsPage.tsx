import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { ArrowLeft, Cpu, Palette, Code2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ProviderSettings } from '@renderer/components/settings/ProviderSettings'
import { ThemeSettings } from '@renderer/components/settings/ThemeSettings'
import { EditorSettings } from '@renderer/components/settings/EditorSettings'
import { cn } from '@renderer/lib/utils'

type Section = 'providers' | 'theme' | 'editor'

const SECTIONS: {
  id: Section
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: 'providers', label: 'Providers', icon: Cpu },
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'editor', label: 'Editor', icon: Code2 }
]

export function SettingsPage(): React.JSX.Element {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<Section>('providers')

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <div className="drag-region flex h-12 items-center gap-2 border-b border-border px-3">
        <Button
          variant="ghost"
          size="icon"
          className="no-drag h-7 w-7"
          onClick={() => router.history.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">Settings</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-48 shrink-0 border-r border-border p-3 space-y-1">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors cursor-pointer',
                activeSection === id
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-lg">
            {activeSection === 'providers' && (
              <section>
                <h2 className="mb-1 text-base font-semibold">AI Providers</h2>
                <p className="mb-6 text-sm text-muted-foreground">
                  Configure credentials and connection options for each provider
                </p>
                <div className="space-y-6">
                  <ProviderSettings provider="anthropic" label="Anthropic (Claude)" />
                  <ProviderSettings provider="openai" label="OpenAI" />
                  <ProviderSettings provider="gemini" label="Google (Gemini)" />
                  <ProviderSettings provider="opencode" label="OpenCode ACP" />
                </div>
              </section>
            )}

            {activeSection === 'theme' && (
              <section>
                <h2 className="mb-1 text-base font-semibold">Theme</h2>
                <p className="mb-6 text-sm text-muted-foreground">
                  Choose how the app looks to you
                </p>
                <ThemeSettings />
              </section>
            )}

            {activeSection === 'editor' && (
              <section>
                <h2 className="mb-1 text-base font-semibold">Editor</h2>
                <p className="mb-6 text-sm text-muted-foreground">
                  Choose your default editor for opening projects
                </p>
                <EditorSettings />
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
