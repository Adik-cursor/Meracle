import type { Id } from '../../types'

export type Identified = {
  id: Id
}

export type InMemoryStore<T extends Identified> = {
  getById: (id: Id) => T | undefined
  list: () => T[]
  create: (entity: T, position?: 'start' | 'end') => T
  update: (id: Id, patch: Partial<Omit<T, 'id'>>) => T | undefined
  remove: (id: Id) => boolean
  snapshot: () => T[]
  restore: (items: T[]) => void
  replaceWhere: (keep: (item: T) => boolean, incoming: T[]) => void
}

export function createInMemoryStore<T extends Identified>(
  onChange: () => void,
): InMemoryStore<T> {
  let records: T[] = []

  const clone = (item: T): T => structuredClone(item)

  return {
    getById(id) {
      const found = records.find((item) => item.id === id)
      return found ? clone(found) : undefined
    },
    list() {
      return records.map(clone)
    },
    create(entity, position = 'start') {
      const stored = clone(entity)
      records =
        position === 'end' ? [...records, stored] : [stored, ...records]
      onChange()
      return clone(stored)
    },
    update(id, patch) {
      const index = records.findIndex((item) => item.id === id)

      if (index < 0) {
        return undefined
      }

      const next = {
        ...clone(records[index]),
        ...patch,
        id,
      }
      records[index] = next
      onChange()
      return clone(next)
    },
    remove(id) {
      const index = records.findIndex((item) => item.id === id)

      if (index < 0) {
        return false
      }

      records = records.filter((item) => item.id !== id)
      onChange()
      return true
    },
    snapshot() {
      return records.map(clone)
    },
    restore(items) {
      records = items.map(clone)
      onChange()
    },
    replaceWhere(keep, incoming) {
      records = [...incoming.map(clone), ...records.filter(keep)]
      onChange()
    },
  }
}
