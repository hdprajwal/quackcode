import { ConversationEmptyState } from '@renderer/components/ai-elements/conversation'
import { Suggestions, Suggestion } from '@renderer/components/ai-elements/suggestion'
import appIcon from '@resources/icon.png'

interface EmptyStateProps {
  onSuggestion: (text: string) => void
}

const suggestions = [
  'Explain the project structure',
  'Find and fix bugs in the codebase',
  'Show me the git status',
  'Refactor this component'
]

export function EmptyState({ onSuggestion }: EmptyStateProps): React.JSX.Element {
  return (
    <ConversationEmptyState
      title="QuackCode"
      description="AI-powered coding assistant. Select a project and start chatting."
      icon={<img src={appIcon} className="h-8 w-8" alt="QuackCode" />}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <img src={appIcon} className="h-9 w-9" alt="QuackCode" />
          </div>
          <h2 className="text-lg font-semibold mt-2">QuackCode</h2>
          <p className="text-sm text-muted-foreground">AI-powered coding assistant</p>
        </div>
        <Suggestions className="justify-center">
          {suggestions.map((s) => (
            <Suggestion key={s} suggestion={s} onClick={onSuggestion} />
          ))}
        </Suggestions>
      </div>
    </ConversationEmptyState>
  )
}
