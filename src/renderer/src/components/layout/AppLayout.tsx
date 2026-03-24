import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomBar } from './BottomBar'
import { ChatArea } from '@renderer/components/chat/ChatArea'
import { AutomationsPanel } from '@renderer/pages/AutomationsPage'
import { useUIStore } from '@renderer/stores/ui.store'

export function AppLayout(): React.JSX.Element {
  const { activeView } = useUIStore()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeView === 'chat' ? (
          <>
            <TopBar />
            <ChatArea />
            <BottomBar />
          </>
        ) : (
          <AutomationsPanel />
        )}
      </div>
    </div>
  )
}
