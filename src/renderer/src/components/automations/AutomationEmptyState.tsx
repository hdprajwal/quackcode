import { Plus, Zap } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

export function AutomationEmptyState({
  onCreateAutomation
}: {
  onCreateAutomation: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
          <Zap className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground">No automations yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Create an automation from the sidebar to start scheduling runs and viewing logs.
        </p>
        <Button className="mt-5 gap-1.5" onClick={onCreateAutomation}>
          <Plus className="h-3.5 w-3.5" />
          Create automation
        </Button>
      </div>
    </div>
  )
}
