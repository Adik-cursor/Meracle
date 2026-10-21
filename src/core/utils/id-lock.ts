export function createIdLock() {
  const locked = new Set<string>()

  return {
    tryAcquire(id: string): boolean {
      if (locked.has(id)) {
        return false
      }

      locked.add(id)
      return true
    },
    release(id: string): void {
      locked.delete(id)
    },
  }
}
