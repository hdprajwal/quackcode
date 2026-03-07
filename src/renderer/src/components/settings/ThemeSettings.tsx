import { Monitor, Moon, Sun } from 'lucide-react'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useSettings } from '@renderer/hooks/useSettings'
import { cn } from '@renderer/lib/utils'

type Theme = 'light' | 'dark' | 'system'

const THEMES: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor }
  ]

export function ThemeSettings(): React.JSX.Element {
  const theme = useSettingsStore((s) => s.settings.theme)
  const { updateSettings } = useSettings()

  const handleSelect = async (value: Theme): Promise<void> => {
    await updateSettings({ theme: value })
  }

  return (
    <div className="flex gap-3">
      {THEMES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => handleSelect(value)}
          className={cn(
            'flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
            theme === value
              ? 'border-primary bg-accent'
              : 'border-border bg-card hover:border-muted-foreground/40 hover:bg-accent/50'
          )}
        >
          <Icon className="h-5 w-5" />
          <span className="text-xs font-medium">{label}</span>
        </button>
      ))}
    </div>
  )
}
