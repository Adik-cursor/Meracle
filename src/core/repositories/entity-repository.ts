import type { Id } from '../types'

export type EntityRepository<T extends { id: Id }> = {
  getById: (id: Id) => T | undefined
  list: (organizationId: Id) => T[]
  create: (entity: T) => T
  update: (id: Id, patch: Partial<Omit<T, 'id'>>) => T | undefined
}

export type ListedEntityRepository<T extends { id: Id }> = EntityRepository<T> & {
  listAll: () => T[]
  delete: (id: Id) => boolean
}
