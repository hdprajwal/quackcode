import { ipcMain } from 'electron'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { platform } from 'os'
import type { EditorId, EditorInfo } from '@shared/types'

const execFileAsync = promisify(execFile)

const EDITORS: { id: EditorId; name: string; commands: string[] }[] = [
  { id: 'zed', name: 'Zed', commands: ['zed'] },
  { id: 'vscode', name: 'VS Code', commands: ['code'] },
  { id: 'cursor', name: 'Cursor', commands: ['cursor'] },
  { id: 'nvim', name: 'NeoVim', commands: ['nvim'] }
]

async function commandExists(cmd: string): Promise<boolean> {
  try {
    const whichCmd = platform() === 'win32' ? 'where' : 'which'
    await execFileAsync(whichCmd, [cmd])
    return true
  } catch {
    return false
  }
}

async function detectEditors(): Promise<EditorInfo[]> {
  const results = await Promise.all(
    EDITORS.map(async (editor) => {
      const available = (await Promise.all(editor.commands.map(commandExists))).some(Boolean)
      return { id: editor.id, name: editor.name, available }
    })
  )
  return results
}

function getTerminalCommand(): string[] | null {
  const terminals = ['wezterm', 'kitty', 'alacritty', 'gnome-terminal', 'xterm']
  // We do a synchronous check isn't possible here; fall back to xterm
  // The caller should handle missing terminal gracefully
  for (const t of terminals) {
    try {
      require('child_process').execFileSync('which', [t], { stdio: 'ignore' })
      return [t]
    } catch {
      continue
    }
  }
  return null
}

function openInEditor(editorId: EditorId, projectPath: string): void {
  switch (editorId) {
    case 'zed':
      spawn('zed', [projectPath], { detached: true, stdio: 'ignore' }).unref()
      break
    case 'vscode':
      spawn('code', [projectPath], { detached: true, stdio: 'ignore' }).unref()
      break
    case 'cursor':
      spawn('cursor', [projectPath], { detached: true, stdio: 'ignore' }).unref()
      break
    case 'nvim': {
      const terminal = getTerminalCommand()
      if (!terminal) break
      const [term, ...termArgs] = terminal
      const nvimArgs =
        term === 'gnome-terminal'
          ? [...termArgs, '--', 'nvim', projectPath]
          : term === 'wezterm'
            ? [...termArgs, 'start', '--', 'nvim', projectPath]
            : [...termArgs, '-e', 'nvim', projectPath]
      spawn(term, nvimArgs, { detached: true, stdio: 'ignore' }).unref()
      break
    }
  }
}

export function registerEditorIpc(): void {
  ipcMain.handle('editor:detect', async (): Promise<EditorInfo[]> => {
    return detectEditors()
  })

  ipcMain.handle('editor:open', (_event, editorId: EditorId, projectPath: string): void => {
    openInEditor(editorId, projectPath)
  })
}
