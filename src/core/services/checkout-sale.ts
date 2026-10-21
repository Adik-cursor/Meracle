import type { Id, PaymentMethod, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import {
  getDueAmount,
  roundMoney,
  sumCompletedPayments,
} from '../../modules/sales/sale-payment'
import { requireActorInOrganization } from './access'
import { completeSaleForUser } from './complete-sale'
import { createPaymentForUser } from './create-payment'
import {
  canCompleteSale,
  canConfirmSale,
  canCreatePayment,
} from './financial-access'
import { getSaleRecord } from './sale-record'
import { confirmSaleForUser } from './sales'
import { requireAccessibleWarehouse } from './warehouse-access'
import { createInternalSaleReceipt } from './internal-receipts'
import { requireModuleEnabledForUser } from './organization-modules'

export type SaleCheckoutWrite = {
  amount: number
  method: PaymentMethod
  bankName?: string
  terminalName?: string
  accountReference?: string
  paymentReference?: string
  paymentComment?: string
  methodDetail?: string
}

export type SaleCheckoutResult = {
  saleId: Id
  paidAmount: number
  change: number
  receiptId: Id
  receiptNumber: string
  fiscalStatus: 'unavailable' | 'queued' | 'issued'
}

export function checkoutSaleForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  saleId: Id,
  draft: SaleCheckoutWrite,
): ServiceResult<SaleCheckoutResult> {
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

  const paymentAllowed = canCreatePayment(
    persistence,
    actor.value,
    existing.sale,
  )
  if (!paymentAllowed.ok) {
    return paymentAllowed
  }

  const completeAllowed = canCompleteSale(
    persistence,
    actor.value,
    existing.sale,
  )
  if (!completeAllowed.ok) {
    return completeAllowed
  }

  const tendered = roundMoney(draft.amount)
  const paidSoFar = sumCompletedPayments(
    persistence.payments.listBySaleId(organizationId, saleId),
  )
  const dueAmount = getDueAmount(existing.sale.total, paidSoFar)

  if (draft.method === 'invoice' || draft.method === 'on_credit') {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (tendered < dueAmount) {
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

    const payment = createPaymentForUser(persistence, actor.value, {
      organizationId,
      createdBy: actor.value.id,
      saleId,
      amount: dueAmount,
      method: draft.method,
      bankName: draft.bankName,
      terminalName: draft.terminalName,
      accountReference: draft.accountReference,
      paymentReference: draft.paymentReference,
      paymentComment: draft.paymentComment,
      methodDetail: draft.methodDetail,
    })
    if (!payment.ok) {
      return payment
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

    const change = roundMoney(tendered - dueAmount)
    const receipt = createInternalSaleReceipt(
      persistence,
      organizationId,
      actor.value.id,
      saleId,
      {
        method: draft.method,
        tenderedAmount: dueAmount,
        changeAmount: change,
        paymentId: payment.value.id,
        bankName: draft.bankName,
        terminalName: draft.terminalName,
        accountReference: draft.accountReference,
        paymentReference: draft.paymentReference,
        paymentComment: draft.paymentComment,
        methodDetail: draft.methodDetail,
      },
    )
    if (!receipt.ok) {
      return receipt
    }

    return ok({
      saleId,
      paidAmount: dueAmount,
      change,
      receiptId: receipt.value.id,
      receiptNumber: receipt.value.receiptNumber,
      fiscalStatus: 'unavailable' as const,
    })
  })
}
