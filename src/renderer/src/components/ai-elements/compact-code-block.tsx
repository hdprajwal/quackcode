'use client'

import type { HTMLAttributes } from 'react'
import type { BundledLanguage } from 'shiki'

import { cn } from '@renderer/lib/utils'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { CodeBlockContent } from './code-block'

type CompactCodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string
  language: string
  showLineNumbers?: boolean
}

export const CompactCodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  ...props
}: CompactCodeBlockProps) => {
  return (
    <div
      className={cn(
        'group not-prose my-3 w-full overflow-hidden rounded-md border bg-transparent',
        'transition-colors hover:bg-muted/40',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-1 font-mono text-[11px]',
          'text-muted-foreground transition-colors group-hover:text-foreground'
        )}
      >
        <span className="truncate">{language || 'text'}</span>
        <CopyButton code={code} />
      </div>
      <div className="border-t border-border/60">
        <CodeBlockContent
          code={code}
          language={(language || 'text') as BundledLanguage}
          showLineNumbers={showLineNumbers}
        />
      </div>
    </div>
  )
}

const CopyButton = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<number>(0)

  const onCopy = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }, [code])

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current)
    },
    []
  )

  const Icon = copied ? CheckIcon : CopyIcon
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? 'Copied' : 'Copy code'}
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded opacity-0 transition',
        'hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
      )}
    >
      <Icon className="size-3.5" />
    </button>
  )
}

type PreOverrideProps = HTMLAttributes<HTMLPreElement> & {
  node?: {
    children?: Array<{
      type: string
      tagName?: string
      properties?: { className?: string[] | string }
      children?: Array<{ type: string; value?: string }>
    }>
  }
}

// Extracts language + raw text from a markdown <pre><code class="language-x">…</code></pre> AST node.
function extractFromNode(node: PreOverrideProps['node']): { language: string; code: string } | null {
  const codeEl = node?.children?.find((c) => c.type === 'element' && c.tagName === 'code')
  if (!codeEl) return null
  const className = codeEl.properties?.className
  const classList = Array.isArray(className) ? className : typeof className === 'string' ? [className] : []
  const langClass = classList.find((c) => typeof c === 'string' && c.startsWith('language-'))
  const language = langClass ? langClass.replace(/^language-/, '') : ''
  const text = (codeEl.children ?? [])
    .filter((c) => c.type === 'text' && typeof c.value === 'string')
    .map((c) => c.value as string)
    .join('')
  // Strip trailing newline that markdown always appends
  return { language, code: text.replace(/\n$/, '') }
}

export const CompactPre = ({ node, children, ...props }: PreOverrideProps) => {
  const extracted = extractFromNode(node)
  if (!extracted) {
    return <pre {...props}>{children}</pre>
  }
  return <CompactCodeBlock code={extracted.code} language={extracted.language} />
}
