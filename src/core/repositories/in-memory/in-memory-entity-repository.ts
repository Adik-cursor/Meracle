import type { Id } from '../../types'
import type { EntityRepository } from '../entity-repository'
import {
  createInMemoryStore,
  type InMemoryStore,
} from './in-memory-store'

type OrgEntity = {
  id: Id
  organizationId: Id
}

export type InMemoryEntityRepository<T extends OrgEntity> = EntityRepository<T> & {
  listAll: () => T[]
  snapshot: () => T[]
  restore: (items: T[]) => void
  store: InMemoryStore<T>
  delete: (id: Id) => boolean
}

export function createInMemoryEntityRepository<T extends OrgEntity>(
  onChange: () => void,
  createPosition: 'start' | 'end' = 'start',
): InMemoryEntityRepository<T> {
  const store = createInMemoryStore<T>(onChange)

  return {
    store,
    getById: (id) => store.getById(id),
    list: (organizationId) =>
      store.list().filter((item) => item.organizationId === organizationId),
    listAll: () => store.list(),
    create: (entity) => store.create(entity, createPosition),
    update: (id, patch) => store.update(id, patch),
    delete: (id) => store.remove(id),
    snapshot: () => store.snapshot(),
    restore: (items) => store.restore(items),
  }
}
