'use client'

import type { ComponentProps, ReactNode } from 'react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@renderer/components/ui/collapsible'
import { cn } from '@renderer/lib/utils'
import { CheckIcon, Loader2Icon, XIcon } from 'lucide-react'
import { isValidElement } from 'react'

import { CodeBlock } from './code-block'

export type ToolState = 'running' | 'completed' | 'error'

export type ToolProps = ComponentProps<typeof Collapsible>

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn(
      'group not-prose w-full transition-colors hover:bg-muted/50 data-[state=open]:bg-muted/50',
      className
    )}
    {...props}
  />
)

export type ToolHeaderProps = {
  title?: string
  className?: string
  toolName: string
  state: ToolState
  /** Primary argument to render inline after the tool name (e.g. file path, command). */
  summary?: ReactNode
}

const statusIcon: Record<ToolState, ReactNode> = {
  running: <Loader2Icon className="size-3.5 animate-spin opacity-60" />,
  completed: <CheckIcon className="size-3.5 opacity-60" />,
  error: <XIcon className="size-3.5 text-destructive/80" />
}

export const ToolHeader = ({
  className,
  title,
  state,
  toolName,
  summary,
  ...props
}: ToolHeaderProps) => {
  return (
    <CollapsibleTrigger
      className={cn(
        'flex w-full items-center gap-3 px-3 py-1 text-left font-mono text-xxs',
        'text-muted-foreground transition-colors',
        'hover:text-foreground group-data-[state=open]:text-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className
      )}
      {...props}
    >
      <span className="shrink-0 font-sans font-semibold text-xs">{title ?? toolName}</span>
      {summary != null && <span className="min-w-0 flex-1 truncate text-xs">{summary}</span>}
      <span className="ml-auto shrink-0">{statusIcon[state]}</span>
    </CollapsibleTrigger>
  )
}

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      'space-y-3 border-t bg-background/40 px-3 py-3 text-popover-foreground outline-none',
      'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=open]:animate-in',
      className
    )}
    {...props}
  />
)

export type ToolInputProps = ComponentProps<'div'> & {
  input: unknown
}

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => {
  const code = typeof input === 'string' ? input : JSON.stringify(input, null, 2)

  return (
    <div className={cn('space-y-1.5 overflow-hidden', className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xxs uppercase tracking-wider">
        Parameters
      </h4>
      <div className="overflow-hidden rounded bg-muted/50 text-xs">
        <CodeBlock code={code} language="json" />
      </div>
    </div>
  )
}

export type ToolOutputProps = ComponentProps<'div'> & {
  output: unknown
  errorText?: string
}

export const ToolOutput = ({ className, output, errorText, ...props }: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null
  }

  let Output = <div>{output as ReactNode}</div>

  if (typeof output === 'object' && !isValidElement(output)) {
    Output = <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
  } else if (typeof output === 'string') {
    Output = <CodeBlock code={output} language="json" />
  }

  return (
    <div className={cn('space-y-1.5', className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xxs uppercase tracking-wider">
        {errorText ? 'Error' : 'Result'}
      </h4>
      <div
        className={cn(
          'overflow-x-auto rounded text-xxs [&_table]:w-full',
          errorText ? 'bg-destructive/10 text-destructive' : 'bg-muted/50 text-foreground'
        )}
      >
        {errorText && <div className="px-3 py-2">{errorText}</div>}
        {Output}
      </div>
    </div>
  )
}
