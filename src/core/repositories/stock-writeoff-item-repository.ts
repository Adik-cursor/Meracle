import type { Id, StockWriteoffItem } from '../types'
import type { EntityRepository } from './entity-repository'

export type StockWriteoffItemRepository = EntityRepository<StockWriteoffItem> & {
  listByWriteoffId: (writeoffId: Id) => StockWriteoffItem[]
}
