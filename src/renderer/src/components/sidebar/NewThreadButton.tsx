import { Plus } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useThread } from '@renderer/hooks/useThread'
import { useProjectStore } from '@renderer/stores/project.store'

export function NewThreadButton(): React.JSX.Element {
  const { createThread } = useThread()
  const project = useProjectStore((s) => s.project)

  return (
    <Button
      variant="outline"
      className="w-full justify-start gap-2"
      onClick={() => createThread()}
      disabled={!project}
    >
      <Plus className="h-4 w-4" />
      New Thread
    </Button>
  )
}
