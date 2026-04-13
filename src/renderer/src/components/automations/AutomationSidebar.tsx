import { Plus } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  Sidebar as SidebarShell,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator
} from '@renderer/components/ui/sidebar'
import type { Automation } from '@shared/types'
import { formatFutureTime, formatSchedule } from './automation-utils'

interface AutomationSidebarProps {
  globalAutomations: Automation[]
  projectAutomations: Automation[]
  selectedAutomationId: string | null
  projectNameById: Map<string, string>
  onSelectAutomation: (automationId: string) => void
  onCreateAutomation: () => void
}

function AutomationSidebarSection({
  label,
  automations,
  selectedAutomationId,
  projectNameById,
  emptyLabel,
  onSelectAutomation
}: {
  label: string
  automations: Automation[]
  selectedAutomationId: string | null
  projectNameById: Map<string, string>
  emptyLabel: string
  onSelectAutomation: (automationId: string) => void
}): React.JSX.Element {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {automations.length > 0 ? (
            automations.map((automation) => (
              <SidebarMenuItem key={automation.id}>
                <SidebarMenuButton
                  isActive={selectedAutomationId === automation.id}
                  className="items-start px-3 py-2"
                  onClick={() => onSelectAutomation(automation.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {automation.name}
                    </div>
                    {automation.projectIds.length > 0 ? (
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {automation.projectIds
                          .map((projectId) => projectNameById.get(projectId) || projectId)
                          .join(', ')}
                      </div>
                    ) : null}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatSchedule(automation)}
                    </div>
                    {automation.projectIds.length === 0 ? (
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>
                          {automation.status === 'active'
                            ? `Next ${formatFutureTime(automation.nextRunAt)}`
                            : 'Paused'}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-muted-foreground">{emptyLabel}</div>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AutomationSidebar({
  globalAutomations,
  projectAutomations,
  selectedAutomationId,
  projectNameById,
  onSelectAutomation,
  onCreateAutomation
}: AutomationSidebarProps): React.JSX.Element {
  return (
    <SidebarShell className="w-[300px] min-w-[300px] border-r border-border bg-background/60 text-foreground">
      <SidebarHeader className="border-b border-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">Automations</div>
            <div className="text-xs text-muted-foreground">Browse schedules and execution logs</div>
          </div>
          <Button size="sm" className="gap-1.5" onClick={onCreateAutomation}>
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-2 py-3">
            <AutomationSidebarSection
              label="Global"
              automations={globalAutomations}
              selectedAutomationId={selectedAutomationId}
              projectNameById={projectNameById}
              emptyLabel="No global automations"
              onSelectAutomation={onSelectAutomation}
            />

            <SidebarSeparator className="my-3" />

            <AutomationSidebarSection
              label="Projects"
              automations={projectAutomations}
              selectedAutomationId={selectedAutomationId}
              projectNameById={projectNameById}
              emptyLabel="No project automations"
              onSelectAutomation={onSelectAutomation}
            />
          </div>
        </ScrollArea>
      </SidebarContent>
    </SidebarShell>
  )
}
