import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@renderer/components/ui/dialog'
import { useUIStore } from '@renderer/stores/ui.store'
import { ProviderSettings } from './ProviderSettings'

export function SettingsModal(): React.JSX.Element {
  const { settingsOpen, setSettingsOpen } = useUIStore()

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure provider credentials and preferences</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <ProviderSettings provider="anthropic" label="Anthropic (Claude)" />
          <ProviderSettings provider="openai" label="OpenAI" />
          <ProviderSettings provider="gemini" label="Google (Gemini)" />
          <ProviderSettings provider="cursor" label="Cursor ACP" />
          <ProviderSettings provider="opencode" label="OpenCode ACP" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
