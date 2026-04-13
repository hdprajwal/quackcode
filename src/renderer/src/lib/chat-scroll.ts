export const NEAR_BOTTOM_THRESHOLD_PX = 64

export function isNearBottom(el: HTMLElement | null, thresholdPx = NEAR_BOTTOM_THRESHOLD_PX): boolean {
  if (!el) return true
  return el.scrollHeight - el.clientHeight - el.scrollTop <= thresholdPx
}

export function scrollToBottom(el: HTMLElement | null, behavior: ScrollBehavior = 'auto'): void {
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior })
}
