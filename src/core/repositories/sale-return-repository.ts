import type { Id, SaleReturn } from '../types'
import type { EntityRepository } from './entity-repository'

export type SaleReturnRepository = EntityRepository<SaleReturn> & {
  listBySaleId: (organizationId: Id, saleId: Id) => SaleReturn[]
}
