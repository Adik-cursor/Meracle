import type { SaleReturn } from '../../types'
import type { SaleReturnRepository } from '../sale-return-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemorySaleReturnRepository(
  onChange: () => void,
): SaleReturnRepository & {
  snapshot: () => SaleReturn[]
  restore: (items: SaleReturn[]) => void
} {
  const base = createInMemoryEntityRepository<SaleReturn>(onChange)

  return {
    ...base,
    listBySaleId: (organizationId, saleId) =>
      base.list(organizationId).filter((item) => item.saleId === saleId),
  }
}
