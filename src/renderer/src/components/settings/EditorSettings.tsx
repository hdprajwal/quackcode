import { useEffect, useState } from 'react'
import { Terminal } from 'lucide-react'
import { invoke } from '@renderer/lib/ipc'
import { useSettingsStore } from '@renderer/stores/settings.store'
import type { EditorId, EditorInfo } from '@shared/types'
import { cn } from '@renderer/lib/utils'
import { ZedLogo } from '@renderer/components/svgs/zedLogo'
import { Vscode } from '@renderer/components/svgs/vscode'
import { CursorLight } from '@renderer/components/svgs/cursorLight'

const EDITOR_LABELS: Record<EditorId, string> = {
  zed: 'Zed',
  vscode: 'VS Code',
  cursor: 'Cursor',
  nvim: 'NeoVim'
}

function EditorIcon({ id, className }: { id: EditorId; className?: string }): React.JSX.Element {
  switch (id) {
    case 'zed':
      return <ZedLogo className={cn('fill-current', className)} />
    case 'vscode':
      return <Vscode className={className} />
    case 'cursor':
      return <CursorLight className={cn('fill-current', className)} />
    case 'nvim':
      return <Terminal className={className} />
  }
}

export function EditorSettings(): React.JSX.Element {
  const { settings, setSettings } = useSettingsStore()
  const [editors, setEditors] = useState<EditorInfo[]>([])

  useEffect(() => {
    invoke<EditorInfo[]>('editor:detect').then(setEditors)
  }, [])

  const availableEditors = editors.filter((e) => e.available)

  const handleSelect = async (editorId: EditorId): Promise<void> => {
    const updated = { ...settings, defaultEditor: editorId }
    await invoke('settings:set', { defaultEditor: editorId })
    setSettings(updated)
  }

  return (
    <div className="space-y-3">
      {editors.length === 0 && (
        <p className="text-sm text-muted-foreground">Detecting editors...</p>
      )}
      {editors.length > 0 && availableEditors.length === 0 && (
        <p className="text-sm text-muted-foreground">No supported editors found on this machine.</p>
      )}
      <div className="space-y-2">
        {availableEditors.map((editor) => {
          const isSelected = settings.defaultEditor === editor.id
          return (
            <button
              key={editor.id}
              onClick={() => handleSelect(editor.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-sm transition-colors cursor-pointer',
                isSelected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
            >
              <span className="flex items-center gap-2.5">
                <EditorIcon id={editor.id} className="h-4 w-4 shrink-0" />
                {EDITOR_LABELS[editor.id]}
              </span>
              {isSelected && (
                <span className="text-xs font-medium text-primary">Default</span>
              )}
            </button>
          )
        })}
      </div>
      {editors.some((e) => !e.available) && (
        <p className="text-xs text-muted-foreground">
          Not available:{' '}
          {editors
            .filter((e) => !e.available)
            .map((e) => EDITOR_LABELS[e.id])
            .join(', ')}
        </p>
      )}
    </div>
  )
}
