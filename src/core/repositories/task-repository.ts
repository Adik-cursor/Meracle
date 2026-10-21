import type { Id, Task } from '../types'
import type { EntityRepository } from './entity-repository'

export type TaskRepository = EntityRepository<Task> & {
  listByUserId: (organizationId: Id, userId: Id) => Task[]
  listByDealId: (organizationId: Id, dealId: Id) => Task[]
  delete: (id: Id) => boolean
}
