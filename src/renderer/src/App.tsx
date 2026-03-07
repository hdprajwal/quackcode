import { useEffect } from 'react'
import { Outlet } from '@tanstack/react-router'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { useSettings } from '@renderer/hooks/useSettings'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { invoke } from '@renderer/lib/ipc'
import type { Project } from '@shared/types'

function App(): React.JSX.Element {
  const { loadSettings, loadModels } = useSettings()
  const { setRecentProjects } = useProjectStore()
  const theme = useSettingsStore((s) => s.settings.theme)

  useEffect(() => {
    loadSettings()
    loadModels()
    invoke<Project[]>('project:list').then(setRecentProjects)
  }, [])

  useEffect(() => {
    const root = document.documentElement

    const applyTheme = (isDark: boolean): void => {
      root.classList.toggle('dark', isDark)
    }

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyTheme(mq.matches)
      const handler = (e: MediaQueryListEvent): void => applyTheme(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } else {
      applyTheme(theme === 'dark')
    }
  }, [theme])

  return (
    <TooltipProvider>
      <Outlet />
    </TooltipProvider>
  )
}

export default App
