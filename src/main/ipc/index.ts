import { registerSettingsIpc } from './settings.ipc'
import { registerFilesystemIpc } from './filesystem.ipc'
import { registerGitIpc } from './git.ipc'
import { registerProjectIpc } from './project.ipc'
import { registerThreadIpc } from './thread.ipc'
import { registerAiIpc } from './ai.ipc'
import { registerEditorIpc } from './editor.ipc'
import { registerAutomationIpc } from './automation.ipc'

export function registerAllIpc(): void {
  registerSettingsIpc()
  registerFilesystemIpc()
  registerGitIpc()
  registerProjectIpc()
  registerThreadIpc()
  registerAiIpc()
  registerEditorIpc()
  registerAutomationIpc()
}
