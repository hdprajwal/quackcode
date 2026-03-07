export function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return window.api.invoke<T>(channel, ...args)
}

export function on(channel: string, callback: (...args: unknown[]) => void): () => void {
  return window.api.on(channel, callback)
}

export function send(channel: string, ...args: unknown[]): void {
  window.api.send(channel, ...args)
}
