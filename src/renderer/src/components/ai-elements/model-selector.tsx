import type { ComponentProps, ReactNode } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from '@renderer/components/ui/command'
import { cn } from '@renderer/lib/utils'
import { ClaudeAiIcon } from '../svgs/claudeAiIcon'
import { CursorLight } from '../svgs/cursorLight'
import { Gemini } from '../svgs/gemini'
import { Openai } from '../svgs/openai'

export type ModelSelectorProps = ComponentProps<typeof PopoverPrimitive.Root>

export const ModelSelector = (props: ModelSelectorProps) => <PopoverPrimitive.Root {...props} />

export type ModelSelectorTriggerProps = ComponentProps<typeof PopoverPrimitive.Trigger>

export const ModelSelectorTrigger = (props: ModelSelectorTriggerProps) => (
  <PopoverPrimitive.Trigger {...props} />
)

export type ModelSelectorContentProps = ComponentProps<typeof PopoverPrimitive.Popup> & {
  title?: ReactNode
  sideOffset?: number
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right' | 'inline-start' | 'inline-end'
}

export const ModelSelectorContent = ({
  className,
  children,
  title: _title,
  sideOffset = 6,
  align = 'start',
  side = 'top',
  ...props
}: ModelSelectorContentProps) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Positioner
      className="isolate z-50 outline-none"
      sideOffset={sideOffset}
      align={align}
      side={side}
    >
      <PopoverPrimitive.Popup
        data-slot="model-selector-popup"
        className={cn(
          'flex max-h-(--available-height) w-72 origin-(--transform-origin) flex-col overflow-hidden rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-lg shadow-black/20 outline-none ring-1 ring-foreground/5',
          'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
          'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className
        )}
        {...props}
      >
        <Command
          className="flex max-h-(--available-height) flex-col **:data-[slot=command-input-wrapper]:h-auto"
          loop
        >
          {children}
        </Command>
      </PopoverPrimitive.Popup>
    </PopoverPrimitive.Positioner>
  </PopoverPrimitive.Portal>
)

export type ModelSelectorInputProps = ComponentProps<typeof CommandInput>

export const ModelSelectorInput = ({ className, ...props }: ModelSelectorInputProps) => (
  <CommandInput className={cn('h-auto py-2.5 text-sm', className)} {...props} />
)

export type ModelSelectorListProps = ComponentProps<typeof CommandList>

export const ModelSelectorList = ({ className, ...props }: ModelSelectorListProps) => (
  <CommandList className={cn('max-h-[min(22rem,60vh)] flex-1', className)} {...props} />
)

export type ModelSelectorEmptyProps = ComponentProps<typeof CommandEmpty>

export const ModelSelectorEmpty = (props: ModelSelectorEmptyProps) => <CommandEmpty {...props} />

export type ModelSelectorGroupProps = ComponentProps<typeof CommandGroup>

export const ModelSelectorGroup = (props: ModelSelectorGroupProps) => <CommandGroup {...props} />

export type ModelSelectorItemProps = ComponentProps<typeof CommandItem>

export const ModelSelectorItem = ({ className, ...props }: ModelSelectorItemProps) => (
  <CommandItem className={cn('gap-2 text-sm', className)} {...props} />
)

export type ModelSelectorShortcutProps = ComponentProps<typeof CommandShortcut>

export const ModelSelectorShortcut = (props: ModelSelectorShortcutProps) => (
  <CommandShortcut {...props} />
)

export type ModelSelectorSeparatorProps = ComponentProps<typeof CommandSeparator>

export const ModelSelectorSeparator = (props: ModelSelectorSeparatorProps) => (
  <CommandSeparator {...props} />
)

export type ModelSelectorLogoProps = Omit<ComponentProps<'img'>, 'src' | 'alt'> & {
  provider:
    | 'moonshotai-cn'
    | 'lucidquery'
    | 'moonshotai'
    | 'zai-coding-plan'
    | 'alibaba'
    | 'xai'
    | 'vultr'
    | 'nvidia'
    | 'upstage'
    | 'groq'
    | 'github-copilot'
    | 'mistral'
    | 'vercel'
    | 'nebius'
    | 'deepseek'
    | 'alibaba-cn'
    | 'google-vertex-anthropic'
    | 'venice'
    | 'chutes'
    | 'cortecs'
    | 'github-models'
    | 'togetherai'
    | 'azure'
    | 'baseten'
    | 'huggingface'
    | 'opencode'
    | 'fastrouter'
    | 'google'
    | 'google-vertex'
    | 'cloudflare-workers-ai'
    | 'inception'
    | 'wandb'
    | 'openai'
    | 'zhipuai-coding-plan'
    | 'perplexity'
    | 'openrouter'
    | 'zenmux'
    | 'v0'
    | 'iflowcn'
    | 'synthetic'
    | 'deepinfra'
    | 'zhipuai'
    | 'submodel'
    | 'zai'
    | 'inference'
    | 'requesty'
    | 'morph'
    | 'lmstudio'
    | 'anthropic'
    | 'aihubmix'
    | 'fireworks-ai'
    | 'modelscope'
    | 'llama'
    | 'scaleway'
    | 'amazon-bedrock'
    | 'cerebras'
    // oxlint-disable-next-line typescript-eslint(ban-types) -- intentional pattern for autocomplete-friendly string union
    | (string & {})
}

export const ModelSelectorLogo = ({ provider, className, ...props }: ModelSelectorLogoProps) => {
  if (provider === 'anthropic') {
    return <ClaudeAiIcon aria-label="Anthropic logo" className={cn('size-3', className)} />
  }

  if (provider === 'openai') {
    return <Openai aria-label="OpenAI logo" className={cn('size-3 fill-current', className)} />
  }

  if (provider === 'google' || provider === 'google-vertex') {
    return <Gemini aria-label="Gemini logo" className={cn('size-3', className)} />
  }

  if (provider === 'cursor') {
    return <CursorLight aria-label="Cursor logo" className={cn('size-3 fill-current', className)} />
  }

  return (
    <img
      {...props}
      alt={`${provider} logo`}
      className={cn('size-3 dark:invert', className)}
      height={12}
      src={`https://models.dev/logos/${provider}.svg`}
      width={12}
    />
  )
}

export type ModelSelectorLogoGroupProps = ComponentProps<'div'>

export const ModelSelectorLogoGroup = ({ className, ...props }: ModelSelectorLogoGroupProps) => (
  <div
    className={cn(
      'flex shrink-0 items-center -space-x-1 [&>*]:rounded-full [&>*]:bg-background [&>*]:p-px [&>*]:ring-1 dark:[&>*]:bg-foreground',
      className
    )}
    {...props}
  />
)

export type ModelSelectorNameProps = ComponentProps<'span'>

export const ModelSelectorName = ({ className, ...props }: ModelSelectorNameProps) => (
  <span className={cn('flex-1 truncate text-left', className)} {...props} />
)
