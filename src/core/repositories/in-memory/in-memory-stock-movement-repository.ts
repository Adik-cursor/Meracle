import type { Id, StockMovement } from '../../types'
import type { StockMovementRepository } from '../stock-movement-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemoryStockMovementRepository(
  onChange: () => void,
): StockMovementRepository & {
  snapshot: () => StockMovement[]
  restore: (items: StockMovement[]) => void
} {
  const base = createInMemoryEntityRepository<StockMovement>(onChange)

  const listByProduct = (organizationId: Id, productId: Id) =>
    base
      .list(organizationId)
      .filter((movement) => movement.productId === productId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  const createMany = (movements: StockMovement[]): boolean => {
    if (movements.length === 0) {
      return false
    }

    const snapshot = base.snapshot()
    base.restore([...movements, ...snapshot])
    return true
  }

  return {
    ...base,
    listByProduct,
    createMany,
  }
}
