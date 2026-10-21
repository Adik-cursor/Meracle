import type { Id, SaleReturnItem } from '../types'
import type { EntityRepository } from './entity-repository'

export type SaleReturnItemRepository = EntityRepository<SaleReturnItem> & {
  listByReturnId: (returnId: Id) => SaleReturnItem[]
  replaceForReturn: (returnId: Id, items: SaleReturnItem[]) => void
}
