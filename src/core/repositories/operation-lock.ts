export type OperationLock = {
  tryAcquire: (key: string) => boolean
  release: (key: string) => void
}
