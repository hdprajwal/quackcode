import { useState } from 'react'
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools
} from '@renderer/components/ai-elements/prompt-input'
import {
  ModelSelector as ModelSelectorRoot,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger
} from '@renderer/components/ai-elements/model-selector'
import { useThreadStore } from '@renderer/stores/thread.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { useSettings } from '@renderer/hooks/useSettings'
import { PROVIDER_LABELS } from '@renderer/lib/provider-labels'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { AIModel, AIProvider } from '@shared/types'

function getProviderLogo(provider: AIProvider): string {
  return provider === 'gemini' ? 'google' : provider
}

interface ChatInputProps {
  onSend: (content: string) => void
  onCancel: () => void
}

export function ChatInput({ onSend, onCancel }: ChatInputProps): React.JSX.Element {
  const [input, setInput] = useState('')
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
  const isStreaming = useThreadStore((s) => s.isStreaming)
  const project = useProjectStore((s) => s.project)
  const { models, selectedModel, setSelectedModel, setSelectedProvider } = useSettingsStore()
  const { updateSettings } = useSettings()

  const currentModel = models.find((m) => m.id === selectedModel)
  const grouped = models.reduce(
    (acc, m) => {
      if (!acc[m.provider]) acc[m.provider] = []
      acc[m.provider].push(m)
      return acc
    },
    {} as Record<string, typeof models>
  )

  const handleModelSelect = async (provider: AIProvider, modelId: string): Promise<void> => {
    setSelectedModel(modelId)
    setSelectedProvider(provider)
    setModelSelectorOpen(false)
    await updateSettings({ defaultProvider: provider, defaultModel: modelId })
  }

  const renderModelItem = (model: AIModel): React.JSX.Element => {
    const isSelected = model.id === selectedModel
    return (
      <ModelSelectorItem
        key={model.id}
        value={`${model.name} ${model.id} ${PROVIDER_LABELS[model.provider]}`}
        onSelect={() => {
          void handleModelSelect(model.provider, model.id)
        }}
      >
        <ModelSelectorLogo provider={getProviderLogo(model.provider)} />
        <ModelSelectorName>{model.name}</ModelSelectorName>
        <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
      </ModelSelectorItem>
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Escape' && isStreaming) {
      onCancel()
    }
  }

  return (
    <div className="border-t border-border p-4">
      <PromptInputProvider>
        <PromptInput
          className={`flex flex-col ${!project ? 'opacity-50' : undefined}`}
          onSubmit={({ text }) => {
            const trimmed = text.trim()
            if (!trimmed || isStreaming) return
            onSend(trimmed)
            setInput('')
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea
              disabled={!project || isStreaming}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={project ? 'Send a message...' : 'Select a project to start'}
              value={input}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <ModelSelectorRoot open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                <ModelSelectorTrigger render={<PromptInputButton />}>
                  {currentModel && (
                    <ModelSelectorLogo provider={getProviderLogo(currentModel.provider)} />
                  )}
                  <span className="max-w-[120px] truncate text-xs">
                    {currentModel?.name ?? selectedModel}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </ModelSelectorTrigger>
                <ModelSelectorContent className="max-w-md">
                  <ModelSelectorInput placeholder="Search models..." />
                  <ModelSelectorList>
                    <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                    {Object.entries(grouped).map(([provider, providerModels]) => (
                      <ModelSelectorGroup
                        key={provider}
                        heading={PROVIDER_LABELS[provider as AIProvider] ?? provider}
                      >
                        {providerModels.map(renderModelItem)}
                      </ModelSelectorGroup>
                    ))}
                  </ModelSelectorList>
                </ModelSelectorContent>
              </ModelSelectorRoot>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={!isStreaming && (!input.trim() || !project)}
              onStop={onCancel}
              status={isStreaming ? 'streaming' : 'ready'}
            >
              {isStreaming ? 'Stop' : undefined}
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
      </PromptInputProvider>
    </div>
  )
}
