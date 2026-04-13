import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import type { Automation } from '@shared/types'

export function AutomationDeleteDialog({
  automation,
  onClose,
  onConfirm
}: {
  automation: Automation | null
  onClose: () => void
  onConfirm: () => Promise<void>
}): React.JSX.Element {
  return (
    <Dialog open={automation !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md gap-0 p-6">
        <DialogHeader className="pb-4">
          <DialogTitle>Delete automation?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {automation
            ? `This will permanently delete "${automation.name}" and its execution history.`
            : ''}
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={() => void onConfirm()}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
