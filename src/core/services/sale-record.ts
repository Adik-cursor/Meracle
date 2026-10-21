import type { Id, Sale, SaleItem } from '../types'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'

export type SaleRecordData = {
  sale: Sale
  items: SaleItem[]
}

export function getSaleRecord(
  persistence: Persistence,
  organizationId: Id,
  saleId: Id,
): SaleRecordData | undefined {
  const sale = persistence.sales.getById(saleId)

  if (!belongsToOrganization(sale, organizationId)) {
    return undefined
  }

  return {
    sale,
    items: persistence.saleItems.listBySaleId(saleId),
  }
}
