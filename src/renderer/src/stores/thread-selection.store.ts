import { create } from 'zustand'

interface ThreadSelectionStore {
  selectedIds: Set<string>
  anchorId: string | null

  clear: () => void
  toggle: (id: string, anchor?: string) => void
  selectOnly: (id: string) => void
  selectRange: (from: string, to: string, orderedIds: string[]) => void
  setAnchor: (id: string | null) => void
  isSelected: (id: string) => boolean
  size: () => number
  all: () => string[]
}

export const useThreadSelectionStore = create<ThreadSelectionStore>((set, get) => ({
  selectedIds: new Set<string>(),
  anchorId: null,

  clear: () => set({ selectedIds: new Set<string>(), anchorId: null }),

  toggle: (id, anchor) =>
    set((s) => {
      const next = new Set(s.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedIds: next, anchorId: anchor ?? id }
    }),

  selectOnly: (id) => set({ selectedIds: new Set([id]), anchorId: id }),

  selectRange: (from, to, orderedIds) =>
    set(() => {
      const fromIdx = orderedIds.indexOf(from)
      const toIdx = orderedIds.indexOf(to)
      if (fromIdx === -1 || toIdx === -1) return { selectedIds: new Set([to]), anchorId: to }
      const [start, end] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
      return {
        selectedIds: new Set(orderedIds.slice(start, end + 1)),
        anchorId: from
      }
    }),

  setAnchor: (id) => set({ anchorId: id }),

  isSelected: (id) => get().selectedIds.has(id),
  size: () => get().selectedIds.size,
  all: () => Array.from(get().selectedIds)
}))
