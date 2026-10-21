import type { Id, SaleItem } from '../types'
import type { EntityRepository } from './entity-repository'

export type SaleItemRepository = EntityRepository<SaleItem> & {
  listBySaleId: (saleId: Id) => SaleItem[]
  replaceForSale: (saleId: Id, items: SaleItem[]) => void
}
