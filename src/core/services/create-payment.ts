import type { Id, Payment, PaymentMethod, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import {
  getDueAmount,
  roundMoney,
  sumCompletedPayments,
} from '../../modules/sales/sale-payment'
import type { Persistence } from '../repositories/persistence'
import { isPositiveAmount, newId, nowIso, optionalText } from './primitives'
import { getSaleRecord } from './sale-record'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import { requireAccessibleWarehouse } from './warehouse-access'
import { createInternalSaleReceiptForPayment } from './internal-receipts'
import {
  canCreatePayment,
  canReadPayment,
} from './financial-access'

export type CreatePaymentInput = {
  organizationId: Id
  createdBy: Id
  saleId: Id
  amount: number
  method: PaymentMethod
  note?: string
  bankName?: string
  terminalName?: string
  accountReference?: string
  paymentReference?: string
  paymentComment?: string
  methodDetail?: string
}

export function createPayment(
  persistence: Persistence,
  input: CreatePaymentInput,
): ServiceResult<Payment> {
  const amount = roundMoney(input.amount)
  const record = getSaleRecord(
    persistence,
    input.organizationId,
    input.saleId,
  )

  if (!record) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (record.sale.status === 'cancelled') {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (!isPositiveAmount(amount) || record.sale.total <= 0) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const paidAmount = sumCompletedPayments(
    persistence.payments.listBySaleId(input.organizationId, input.saleId),
  )
  const dueAmount = getDueAmount(record.sale.total, paidAmount)

  if (amount > dueAmount) {
    return fail({ code: 'PAYMENT_LIMIT_EXCEEDED' })
  }

  if (input.method === 'invoice' || input.method === 'on_credit') {
    return fail({ code: 'INVALID_INPUT' })
  }

  const now = nowIso()
  const payment: Payment = {
    id: newId(),
    organizationId: input.organizationId,
    saleId: input.saleId,
    amount,
    currency: record.sale.currency,
    method: input.method,
    status: 'completed',
    createdAt: now,
    createdBy: input.createdBy,
    note: optionalText(input.note),
    bankName: optionalText(input.bankName),
    terminalName: optionalText(input.terminalName),
    accountReference: optionalText(input.accountReference),
    paymentReference: optionalText(input.paymentReference),
    paymentComment: optionalText(input.paymentComment),
    methodDetail: optionalText(input.methodDetail),
  }

  const created = persistence.payments.create(payment)
  const sale = persistence.sales.getById(created.saleId ?? '')
  if (sale?.status === 'completed' && created.saleId) {
    const receipt = createInternalSaleReceiptForPayment(persistence, created)
    if (!receipt.ok) {
      return receipt
    }
  }
  return ok(created)
}

export function listPaymentsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<Payment[]> {
  const actor = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!actor.ok) {
    return actor
  }

  const payments: Payment[] = []
  for (const payment of persistence.payments.list(actor.value.organizationId)) {
    if (payment.rentalBookingId && !payment.saleId) {
      continue
    }

    if (!payment.saleId) {
      continue
    }

    const sale = persistence.sales.getById(payment.saleId)
    if (!sale) {
      continue
    }

    if (sale.organizationId !== actor.value.organizationId) {
      continue
    }

    if (sale.warehouseId) {
      const warehouse = requireAccessibleWarehouse(
        persistence,
        actor.value,
        sale.warehouseId,
      )
      if (!warehouse.ok) {
        continue
      }
    }

    if (canReadPayment(persistence, actor.value, payment).ok) {
      payments.push(payment)
    }
  }

  return ok(payments)
}

export function createPaymentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  input: CreatePaymentInput,
): ServiceResult<Payment> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, input.organizationId)
  if (!actor.ok) {
    return actor
  }

  const record = getSaleRecord(
    persistence,
    input.organizationId,
    input.saleId,
  )
  if (!record) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (record.sale.organizationId !== actor.value.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (record.sale.warehouseId) {
    const warehouse = requireAccessibleWarehouse(
      persistence,
      actor.value,
      record.sale.warehouseId,
    )
    if (!warehouse.ok) {
      return warehouse
    }
  }

  const allowed = canCreatePayment(persistence, actor.value, record.sale)
  if (!allowed.ok) {
    return allowed
  }

  return createPayment(persistence, {
    ...input,
    createdBy: actor.value.id,
  })
}
