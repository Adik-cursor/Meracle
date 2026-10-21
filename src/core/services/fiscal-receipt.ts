import type { Id, Sale, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'

export type FiscalReceiptStatus = 'unavailable' | 'queued' | 'issued'

export type FiscalReceiptResult = {
  saleId: Id
  status: FiscalReceiptStatus
}

export type FiscalizationAdapter = {
  submitCompletedSale: (input: {
    sale: Sale
    actor: User
  }) => ServiceResult<FiscalReceiptResult>
}

export const unavailableFiscalizationAdapter: FiscalizationAdapter = {
  submitCompletedSale({ sale }) {
    return ok({
      saleId: sale.id,
      status: 'unavailable',
    })
  },
}

let fiscalizationAdapter: FiscalizationAdapter = unavailableFiscalizationAdapter

export function setFiscalizationAdapter(adapter: FiscalizationAdapter): void {
  fiscalizationAdapter = adapter
}

export function submitFiscalReceiptForCompletedSale(
  persistence: Persistence,
  actor: User,
  saleId: Id,
): ServiceResult<FiscalReceiptResult> {
  const sale = persistence.sales.getById(saleId)
  if (!sale) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (sale.organizationId !== actor.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (sale.status !== 'completed') {
    return fail({ code: 'SALE_NOT_COMPLETED' })
  }

  return fiscalizationAdapter.submitCompletedSale({ sale, actor })
}
