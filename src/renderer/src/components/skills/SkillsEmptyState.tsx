import { Package } from 'lucide-react'

export function SkillsEmptyState({ tab }: { tab: 'installed' | 'browse' }): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
          <Package className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          {tab === 'installed' ? 'No skill selected' : 'Discover skills'}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {tab === 'installed'
            ? 'Pick a skill from the list to view its SKILL.md or uninstall it.'
            : 'Search the skills.sh directory to find reusable capabilities for Claude.'}
        </p>
      </div>
    </div>
  )
}
