import type { Task } from '../../types'
import type { TaskRepository } from '../task-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemoryTaskRepository(
  onChange: () => void,
): TaskRepository & {
  snapshot: () => Task[]
  restore: (items: Task[]) => void
} {
  const inner = createInMemoryEntityRepository<Task>(onChange, 'end')

  return {
    getById: inner.getById,
    list: inner.list,
    create: inner.create,
    update: inner.update,
    listByUserId: (organizationId, userId) =>
      inner
        .list(organizationId)
        .filter((task) => task.assignedUserId === userId),
    listByDealId: (organizationId, dealId) =>
      inner.list(organizationId).filter((task) => task.dealId === dealId),
    delete: (id) => inner.store.remove(id),
    snapshot: inner.snapshot,
    restore: inner.restore,
  }
}
