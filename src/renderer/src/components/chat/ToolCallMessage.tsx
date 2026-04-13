import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
  type ToolState
} from '@renderer/components/ai-elements/tool'
import { cn } from '@renderer/lib/utils'
import type { ToolCall, ToolResult } from '@shared/types'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

const COLLAPSED_LIMIT = 5

// Tools that spawn a subagent. Their invocations are long-running and often
// accompany many short-lived sibling tool calls, so we pull them into their
// own always-visible group instead of letting them get hidden behind the
// "show earlier calls" collapse.
const AGENT_TOOL_NAMES = new Set<string>(['Task', 'Agent'])

interface ToolCallMessageProps {
  toolCalls: ToolCall[]
  toolResults: ToolResult[]
  toolCallBuffers?: Record<string, string>
}

function getToolInput(
  toolCall: ToolCall,
  toolCallBuffers?: Record<string, string>
): Record<string, unknown> | string {
  const buffer = toolCallBuffers?.[toolCall.id]
  if (!buffer) return toolCall.arguments

  try {
    return JSON.parse(buffer) as Record<string, unknown>
  } catch {
    return buffer
  }
}

// Per-tool preferred argument name(s) for the inline summary, in priority order.
const SUMMARY_ARG_BY_TOOL: Record<string, readonly string[]> = {
  Read: ['file_path'],
  Write: ['file_path'],
  Edit: ['file_path'],
  MultiEdit: ['file_path'],
  NotebookEdit: ['notebook_path'],
  Bash: ['command'],
  Glob: ['pattern'],
  Grep: ['pattern'],
  WebFetch: ['url'],
  WebSearch: ['query'],
  Task: ['description'],
  TodoWrite: ['todos']
}

const PATH_TOOLS = new Set(['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

function pickSummaryValue(toolName: string, args: Record<string, unknown>): string | null {
  const preferred = SUMMARY_ARG_BY_TOOL[toolName]
  if (preferred) {
    for (const key of preferred) {
      const v = args[key]
      if (typeof v === 'string' && v.length > 0) return v
    }
  }
  // Fallback: first string-valued argument
  for (const v of Object.values(args)) {
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

function renderPath(path: string): ReactNode {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (idx === -1 || idx === path.length - 1) {
    return <span>{path}</span>
  }
  return (
    <>
      <span className="opacity-60">{path.slice(0, idx + 1)}</span>
      <span>{path.slice(idx + 1)}</span>
    </>
  )
}

function renderSummary(toolName: string, value: string): ReactNode {
  if (PATH_TOOLS.has(toolName)) return renderPath(value)
  // Single-line truncate handled by parent; collapse internal whitespace.
  return <span>{value.replace(/\s+/g, ' ')}</span>
}

function buildSummary(
  toolName: string,
  input: Record<string, unknown> | string
): ReactNode | undefined {
  if (typeof input === 'string') {
    // Streaming partial JSON — don't render as summary, let parameters block show it.
    return undefined
  }
  const value = pickSummaryValue(toolName, input)
  if (!value) return undefined
  return renderSummary(toolName, value)
}

function renderToolCall(
  tc: ToolCall,
  toolResults: ToolResult[],
  toolCallBuffers?: Record<string, string>
): React.JSX.Element {
  const result = toolResults.find((r) => r.toolCallId === tc.id)
  const state: ToolState = result ? (result.isError ? 'error' : 'completed') : 'running'
  const input = getToolInput(tc, toolCallBuffers)
  const summary = buildSummary(tc.name, input)

  return (
    <Tool key={tc.id}>
      <ToolHeader toolName={tc.name} state={state} summary={summary} />
      <ToolContent>
        <ToolInput input={input} />
        {result && (
          <ToolOutput
            output={result.content}
            errorText={result.isError ? result.content : undefined}
          />
        )}
      </ToolContent>
    </Tool>
  )
}

export function ToolCallMessage({
  toolCalls,
  toolResults,
  toolCallBuffers
}: ToolCallMessageProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  if (toolCalls.length === 0) return <></>

  const agentCalls = toolCalls.filter((tc) => AGENT_TOOL_NAMES.has(tc.name))
  const regularCalls = toolCalls.filter((tc) => !AGENT_TOOL_NAMES.has(tc.name))

  const overflow = regularCalls.length - COLLAPSED_LIMIT
  const shouldCollapse = overflow > 0 && !expanded
  // Keep the most recent calls visible; hide the earlier ones behind the toggle.
  const visibleRegular = shouldCollapse ? regularCalls.slice(overflow) : regularCalls

  return (
    <div className="flex w-full flex-col gap-2">
      {agentCalls.length > 0 && (
        <div className="w-full overflow-hidden rounded-md border border-violet-400/20 bg-violet-500/[0.04] divide-y divide-border/60">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xxs font-medium uppercase tracking-wider text-violet-300/80">
            <span>Subagent</span>
            <span className="text-violet-300/40">
              {agentCalls.length} {agentCalls.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>
          {agentCalls.map((tc) => renderToolCall(tc, toolResults, toolCallBuffers))}
        </div>
      )}
      {regularCalls.length > 0 && (
        <div className="w-full overflow-hidden rounded-md border divide-y divide-border/60">
          {shouldCollapse && (
            <ShowMoreToggle
              hiddenCount={overflow}
              expanded={false}
              onClick={() => setExpanded(true)}
            />
          )}
          {visibleRegular.map((tc) => renderToolCall(tc, toolResults, toolCallBuffers))}
          {expanded && overflow > 0 && (
            <ShowMoreToggle
              hiddenCount={overflow}
              expanded={true}
              onClick={() => setExpanded(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ShowMoreToggle({
  hiddenCount,
  expanded,
  onClick
}: {
  hiddenCount: number
  expanded: boolean
  onClick: () => void
}): React.JSX.Element {
  const Icon = expanded ? ChevronUpIcon : ChevronDownIcon
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xxs',
        'text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
      )}
    >
      <Icon className="size-3.5 opacity-60" />
      <span className="font-sans text-xxs">
        {expanded
          ? `Hide ${hiddenCount} earlier ${hiddenCount === 1 ? 'call' : 'calls'}`
          : `Show ${hiddenCount} earlier ${hiddenCount === 1 ? 'call' : 'calls'}`}
      </span>
    </button>
  )
}
