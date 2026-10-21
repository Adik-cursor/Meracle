import type { Id, StockMovement } from '../types'
import type { EntityRepository } from './entity-repository'

export type StockMovementRepository = EntityRepository<StockMovement> & {
  listByProduct: (organizationId: Id, productId: Id) => StockMovement[]
  createMany: (movements: StockMovement[]) => boolean
}
