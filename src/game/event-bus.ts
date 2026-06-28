export type Listener = (...args: unknown[]) => void

export class EventBus {
  private listeners = new Map<string, Set<Listener>>()

  on(type: string, fn: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
  }

  off(type: string, fn: Listener): void {
    this.listeners.get(type)?.delete(fn)
  }

  emit(type: string, ...args: unknown[]): void {
    this.listeners.get(type)?.forEach((fn) => fn(...args))
  }

  clear(): void {
    this.listeners.clear()
  }
}
