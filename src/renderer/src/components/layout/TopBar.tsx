import { useEffect, useState } from 'react'
import { useUIStore } from '@renderer/stores/ui.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { PanelLeft, ChevronDown } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { ProjectSelector } from '@renderer/components/project/ProjectSelector'
import { EnvironmentSelector } from '@renderer/components/project/EnvironmentSelector'
import { invoke } from '@renderer/lib/ipc'
import type { EditorId, EditorInfo } from '@shared/types'
import { ZedLogo } from '@renderer/components/svgs/zedLogo'
import { Vscode } from '@renderer/components/svgs/vscode'
import { CursorLight } from '@renderer/components/svgs/cursorLight'
import { cn } from '@renderer/lib/utils'
import { Neovim } from '@renderer/components/svgs/neovim'

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
      return <Neovim className={className} />
  }
}

export function TopBar(): React.JSX.Element {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { project } = useProjectStore()
  const { settings } = useSettingsStore()
  const [availableEditors, setAvailableEditors] = useState<EditorInfo[]>([])

  useEffect(() => {
    invoke<EditorInfo[]>('editor:detect').then((editors) => {
      setAvailableEditors(editors.filter((e) => e.available))
    })
  }, [])

  const defaultEditor = availableEditors.find((e) => e.id === settings.defaultEditor)
  const otherEditors = availableEditors.filter((e) => e.id !== settings.defaultEditor)

  const openInEditor = (editorId: EditorId): void => {
    if (!project) return
    invoke('editor:open', editorId, project.path)
  }

  const showEditorButton = project && availableEditors.length > 0

  return (
    <div className="drag-region flex h-12 items-center gap-2 border-b border-border px-3">
      <Button variant="ghost" size="icon" className="no-drag h-7 w-7" onClick={toggleSidebar}>
        <PanelLeft className="h-4 w-4" />
      </Button>

      <div className="no-drag flex items-center gap-2">
        <ProjectSelector />
        <EnvironmentSelector />
      </div>

      <div className="flex-1" />

      {showEditorButton && (
        <div className="no-drag flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-r-none border-r border-border text-xs"
            onClick={() => openInEditor(defaultEditor?.id ?? availableEditors[0].id)}
          >
            <EditorIcon id={defaultEditor?.id ?? availableEditors[0].id} className="h-3.5 w-3.5" />
            Open in {EDITOR_LABELS[defaultEditor?.id ?? availableEditors[0].id]}
          </Button>
          {otherEditors.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                children={
                  <Button variant="ghost" size="icon" className="h-7 w-6 rounded-l-none text-xs">
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-full">
                {otherEditors.map((editor) => (
                  <DropdownMenuItem key={editor.id} onClick={() => openInEditor(editor.id)}>
                    <EditorIcon id={editor.id} className="mr-2 h-3.5 w-3.5" />
                    Open in {EDITOR_LABELS[editor.id]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  )
}
