import type { Id, Deal } from '../types'
import type { EntityRepository } from './entity-repository'

export type DealRepository = EntityRepository<Deal> & {
  delete: (id: Id) => boolean
}
