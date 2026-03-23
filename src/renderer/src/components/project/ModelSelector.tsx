import { useState } from 'react'
import { Check, ChevronDown, Sparkles } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  ModelSelector as ModelSelectorRoot,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName
} from '@renderer/components/ai-elements/model-selector'
import { useSettings } from '@renderer/hooks/useSettings'
import { PROVIDER_LABELS } from '@renderer/lib/provider-labels'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { cn } from '@renderer/lib/utils'
import type { AIModel, AIProvider } from '@shared/types'

function getProviderLogo(provider: AIProvider): string {
  return provider === 'gemini' ? 'google' : provider
}

export function ModelSelector(): React.JSX.Element {
  const { models, selectedModel, setSelectedModel, setSelectedProvider } = useSettingsStore()
  const { updateSettings } = useSettings()
  const [open, setOpen] = useState(false)

  const currentModel = models.find((m) => m.id === selectedModel)
  const grouped = models.reduce(
    (acc, m) => {
      if (!acc[m.provider]) acc[m.provider] = []
      acc[m.provider].push(m)
      return acc
    },
    {} as Record<string, typeof models>
  )

  const featuredModels = models.slice(0, Math.min(models.length, 3))

  const handleSelect = async (provider: AIProvider, modelId: string): Promise<void> => {
    setSelectedModel(modelId)
    setSelectedProvider(provider)
    setOpen(false)

    await updateSettings({
      defaultProvider: provider,
      defaultModel: modelId
    })
  }

  const renderModelItem = (model: AIModel): React.JSX.Element => {
    const isSelected = model.id === selectedModel

    return (
      <ModelSelectorItem
        key={model.id}
        value={`${model.name} ${model.id} ${PROVIDER_LABELS[model.provider]}`}
        onSelect={() => {
          void handleSelect(model.provider, model.id)
        }}
      >
        <ModelSelectorLogo provider={getProviderLogo(model.provider)} />
        <ModelSelectorName>{model.name}</ModelSelectorName>
        <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
      </ModelSelectorItem>
    )
  }

  return (
    <ModelSelectorRoot open={open} onOpenChange={setOpen}>
      <ModelSelectorTrigger render={<Button variant="ghost" size="sm" className="gap-2 text-sm" />}>
        <ModelSelectorLogoGroup>
          {featuredModels.map((model) => (
            <ModelSelectorLogo
              key={`${model.provider}-${model.id}`}
              provider={getProviderLogo(model.provider)}
            />
          ))}
        </ModelSelectorLogoGroup>
        <span className="max-w-[150px] truncate">{currentModel?.name || selectedModel}</span>
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
        <ChevronDown className="h-3 w-3" />
      </ModelSelectorTrigger>
      <ModelSelectorContent className="max-w-md">
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {Object.entries(grouped).map(([provider, providerModels]) => (
            <ModelSelectorGroup
              key={provider}
              heading={PROVIDER_LABELS[provider as AIProvider] || provider}
            >
              {providerModels.map(renderModelItem)}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelectorRoot>
  )
}
