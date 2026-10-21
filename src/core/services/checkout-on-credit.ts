import type { Id, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import {
  getDueAmount,
  roundMoney,
  sumCompletedPayments,
} from '../../modules/sales/sale-payment'
import { requireActorInOrganization } from './access'
import { completeSaleForUser } from './complete-sale'
import { canCompleteSale, canConfirmSale } from './financial-access'
import { getSaleRecord } from './sale-record'
import { confirmSaleForUser } from './sales'
import { requireAccessibleWarehouse } from './warehouse-access'
import { requireModuleEnabledForUser } from './organization-modules'
import { nowIso, optionalText } from './primitives'

export type SaleOnCreditWrite = {
  dueDate?: string
  comment?: string
}

export type SaleOnCreditResult = {
  saleId: Id
  customerId: Id
  total: number
  paidAmount: number
  remainingAmount: number
}

export function checkoutOnCreditForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  saleId: Id,
  draft: SaleOnCreditWrite = {},
): ServiceResult<SaleOnCreditResult> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = getSaleRecord(persistence, organizationId, saleId)
  if (!existing) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (existing.sale.organizationId !== actor.value.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  const customerId = existing.sale.customerId
  if (!customerId) {
    return fail({ code: 'CUSTOMER_INVALID' })
  }

  const customer = persistence.customers.getById(customerId)
  if (!customer) {
    return fail({ code: 'CUSTOMER_NOT_FOUND' })
  }

  if (customer.organizationId !== actor.value.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (existing.sale.status === 'cancelled' || existing.sale.status === 'completed') {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (existing.sale.total <= 0) {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (existing.sale.warehouseId) {
    const warehouse = requireAccessibleWarehouse(
      persistence,
      actor.value,
      existing.sale.warehouseId,
    )
    if (!warehouse.ok) {
      return warehouse
    }
  }

  const confirmed =
    existing.sale.status === 'confirmed'
      ? ok(actor.value)
      : canConfirmSale(persistence, actor.value, existing.sale)
  if (!confirmed.ok) {
    return confirmed
  }

  const completeAllowed = canCompleteSale(
    persistence,
    actor.value,
    existing.sale,
  )
  if (!completeAllowed.ok) {
    return completeAllowed
  }

  const paidSoFar = sumCompletedPayments(
    persistence.payments.listBySaleId(organizationId, saleId),
  )
  if (paidSoFar > 0) {
    return fail({ code: 'INVALID_INPUT' })
  }

  return persistence.runInTransaction(() => {
    if (existing.sale.status === 'draft') {
      const confirm = confirmSaleForUser(
        persistence,
        actor.value,
        organizationId,
        saleId,
      )
      if (!confirm.ok) {
        return confirm
      }
    }

    const completed = completeSaleForUser(
      persistence,
      actor.value,
      organizationId,
      saleId,
    )
    if (!completed.ok) {
      return completed
    }

    const note = optionalText(draft.comment) ?? existing.sale.note
    const dueDate = optionalText(draft.dueDate)
    const updated = persistence.sales.update(saleId, {
      settlementMethod: 'on_credit',
      invoiceDueDate: dueDate ?? existing.sale.invoiceDueDate,
      note,
      updatedAt: nowIso(),
    })
    if (!updated) {
      return fail({ code: 'SALE_NOT_FOUND' })
    }

    const total = roundMoney(updated.total)
    return ok({
      saleId,
      customerId,
      total,
      paidAmount: 0,
      remainingAmount: getDueAmount(total, 0),
    })
  })
}
