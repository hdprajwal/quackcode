import { Folder } from 'lucide-react'
import appIcon from '@resources/icon.png'
import { useProjectStore } from '@renderer/stores/project.store'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger
} from '@renderer/components/ui/select'

export function NewThreadView(): React.JSX.Element {
  const { recentProjects, project, setProject } = useProjectStore()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-4 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
          <img src={appIcon} className="h-12 w-12" alt="QuackCode" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Welcome to QuackCode</h1>
          <p className="text-muted-foreground">Select a project to start a new coding session</p>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-2">
        <Select
          value={project?.id}
          onValueChange={(value) => {
            const selected = recentProjects.find((p) => p.id === value)
            if (selected) {
              setProject(selected)
            }
          }}
        >
          <SelectTrigger className="w-full">
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span className={!project ? 'text-muted-foreground' : ''}>
                {project ? project.name : 'Select a project...'}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {recentProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
