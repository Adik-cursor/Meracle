import type {
  CustomerDebtPayment,
  Id,
  PaymentMethod,
  Sale,
  SalePaymentStatus,
  User,
} from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import {
  hasEffectiveFinancialPermission,
  requireCurrentUser,
} from './access'
import { createPayment } from './create-payment'
import { listSalesForUser } from './sales'
import { requireModuleEnabledForUser } from './organization-modules'
import { isPositiveAmount, newId, nowIso, optionalText } from './primitives'
import { roundMoney } from '../../modules/sales/sale-payment'
import { getSaleSettlement } from './sale-settlement'

export type CustomerDebtView = {
  customerId: Id
  totalDebt: number
  paidAmount: number
  remainingDebt: number
  overdueAmount: number
  status: 'clear' | 'open' | 'overdue'
}

export type CustomerDebtPaymentWrite = {
  customerId: Id
  saleId?: Id
  amount: number
  method: PaymentMethod
  bankName?: string
  accountReference?: string
  paymentReference?: string
  comment?: string
}

export type SaleDebtRow = {
  saleId: Id
  organizationId: Id
  customerId: Id
  saleNumber: string
  createdAt: string
  charged: number
  paidAmount: number
  remainingAmount: number
  returnedAmount: number
  refundedAmount: number
  grossCharged: number
  grossPaid: number
  dueDate?: string
  status: SalePaymentStatus
  settlementMethod?: Sale['settlementMethod']
}

export type CustomerDebtGroup = {
  customerId: Id
  organizationId: Id
  saleCount: number
  charged: number
  paidAmount: number
  remainingAmount: number
  returnedAmount: number
  refundedAmount: number
  grossCharged: number
  grossPaid: number
  status: SalePaymentStatus
  sales: SaleDebtRow[]
}

function todayIsoDate(now = nowIso()): string {
  return now.slice(0, 10)
}

function requireDebtRead(actor: User): ServiceResult<User> {
  if (
    !hasEffectiveFinancialPermission(actor, 'payments.read') ||
    !hasEffectiveFinancialPermission(actor, 'sales.read')
  ) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return ok(actor)
}

function completedCustomerSales(
  persistence: Persistence,
  actor: User,
  customerId: Id,
) {
  const listed = listSalesForUser(persistence, actor)
  const sales = listed.ok ? listed.value : []
  return sales
    .filter(
      (sale) =>
        sale.status === 'completed' &&
        sale.customerId === customerId &&
        sale.total > 0,
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

function saleRemaining(persistence: Persistence, sale: { id: Id; organizationId: Id; total: number }): number {
  return getSaleSettlement(persistence, sale).remainingAmount
}

function buildDebtView(
  persistence: Persistence,
  actor: User,
  customerId: Id,
): CustomerDebtView {
  const sales = completedCustomerSales(persistence, actor, customerId)
  const today = todayIsoDate()
  let totalDebt = 0
  let paidAmount = 0
  let remainingDebt = 0
  let overdueAmount = 0

  for (const sale of sales) {
    const settlement = getSaleSettlement(persistence, sale)
    totalDebt += settlement.netSales
    paidAmount += settlement.netPaid
    remainingDebt += settlement.remainingAmount
    if (settlement.remainingAmount > 0 && sale.invoiceDueDate && sale.invoiceDueDate < today) {
      overdueAmount += settlement.remainingAmount
    }
  }

  return {
    customerId,
    totalDebt: roundMoney(totalDebt),
    paidAmount: roundMoney(paidAmount),
    remainingDebt: roundMoney(remainingDebt),
    overdueAmount: roundMoney(overdueAmount),
    status:
      remainingDebt <= 0 ? 'clear' : overdueAmount > 0 ? 'overdue' : 'open',
  }
}

export function listCustomerDebtsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<CustomerDebtView[]> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const allowed = requireDebtRead(gated.value)
  if (!allowed.ok) {
    return allowed
  }

  const listed = listSalesForUser(persistence, gated.value)
  const sales = listed.ok ? listed.value : []
  const ids = new Set(
    sales
      .filter((sale) => sale.customerId)
      .map((sale) => sale.customerId as Id),
  )

  return ok(
    [...ids]
      .map((customerId) => buildDebtView(persistence, gated.value, customerId))
      .filter((row) => row.totalDebt > 0)
      .sort((left, right) => right.remainingDebt - left.remainingDebt),
  )
}

export function getCustomerDebtForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  customerId: Id,
): ServiceResult<CustomerDebtView> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const allowed = requireDebtRead(gated.value)
  if (!allowed.ok) {
    return allowed
  }

  const customer = persistence.customers.getById(customerId)
  if (!customer || customer.organizationId !== gated.value.organizationId) {
    return fail({ code: 'CUSTOMER_NOT_FOUND' })
  }

  return ok(buildDebtView(persistence, gated.value, customerId))
}

function toSaleDetailRow(persistence: Persistence, sale: Sale): SaleDebtRow | null {
  if (sale.status !== 'completed' || !sale.customerId || sale.total <= 0) {
    return null
  }
  const settlement = getSaleSettlement(persistence, sale)
  return {
    saleId: sale.id,
    organizationId: sale.organizationId,
    customerId: sale.customerId,
    saleNumber: sale.id.slice(-4).toUpperCase(),
    createdAt: sale.createdAt,
    charged: settlement.netSales,
    paidAmount: settlement.netPaid,
    remainingAmount: settlement.remainingAmount,
    returnedAmount: settlement.returnedAmount,
    refundedAmount: settlement.refundedAmount,
    grossCharged: settlement.grossSales,
    grossPaid: settlement.paidAmount,
    dueDate: sale.invoiceDueDate,
    status: settlement.status,
    settlementMethod: sale.settlementMethod,
  }
}

function toSaleDebtRow(
  persistence: Persistence,
  sale: Sale,
): SaleDebtRow | null {
  const row = toSaleDetailRow(persistence, sale)
  if (!row) {
    return null
  }
  if (row.remainingAmount <= 0 && sale.settlementMethod !== 'on_credit') {
    return null
  }
  return row
}

export function listSaleDebtRowsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<SaleDebtRow[]> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const allowed = requireDebtRead(gated.value)
  if (!allowed.ok) {
    return allowed
  }

  const listed = listSalesForUser(persistence, gated.value)
  const sales = listed.ok ? listed.value : []

  return ok(
    sales
      .map((sale) => toSaleDebtRow(persistence, sale))
      .filter((row): row is SaleDebtRow => row !== null)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  )
}

export function listCustomerDebtGroupsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<CustomerDebtGroup[]> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }
  const allowed = requireDebtRead(gated.value)
  if (!allowed.ok) {
    return allowed
  }
  const listed = listSalesForUser(persistence, gated.value)
  const sales = listed.ok ? listed.value : []
  const byCustomer = new Map<Id, SaleDebtRow[]>()
  for (const sale of sales) {
    const row = toSaleDetailRow(persistence, sale)
    if (!row) {
      continue
    }
    const bucket = byCustomer.get(row.customerId) ?? []
    bucket.push(row)
    byCustomer.set(row.customerId, bucket)
  }
  const groups: CustomerDebtGroup[] = []
  for (const [customerId, rows] of byCustomer) {
    const charged = roundMoney(rows.reduce((sum, row) => sum + row.charged, 0))
    const paidAmount = roundMoney(rows.reduce((sum, row) => sum + row.paidAmount, 0))
    const remainingAmount = roundMoney(rows.reduce((sum, row) => sum + row.remainingAmount, 0))
    const returnedAmount = roundMoney(rows.reduce((sum, row) => sum + row.returnedAmount, 0))
    const refundedAmount = roundMoney(rows.reduce((sum, row) => sum + row.refundedAmount, 0))
    const grossCharged = roundMoney(rows.reduce((sum, row) => sum + row.grossCharged, 0))
    const grossPaid = roundMoney(rows.reduce((sum, row) => sum + row.grossPaid, 0))
    if (remainingAmount <= 0) {
      continue
    }
    const organizationId = rows[0]?.organizationId
    if (!organizationId || organizationId !== gated.value.organizationId) {
      continue
    }
    groups.push({
      customerId,
      organizationId,
      saleCount: rows.length,
      charged,
      paidAmount,
      remainingAmount,
      returnedAmount,
      refundedAmount,
      grossCharged,
      grossPaid,
      status: remainingAmount <= 0 ? 'paid' : paidAmount <= 0 ? 'unpaid' : paidAmount >= charged ? 'paid' : 'partially_paid',
      sales: rows.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    })
  }
  return ok(groups.sort((left, right) => right.remainingAmount - left.remainingAmount))
}

export function listCustomerDebtPaymentsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<CustomerDebtPayment[]> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const allowed = requireDebtRead(gated.value)
  if (!allowed.ok) {
    return allowed
  }

  const debts = listCustomerDebtsForUser(persistence, currentUser)
  const visible = new Set(
    debts.ok ? debts.value.map((row) => row.customerId) : [],
  )

  return ok(
    persistence.customerDebtPayments
      .list(gated.value.organizationId)
      .filter((item) => visible.has(item.customerId))
      .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1)),
  )
}

export function createCustomerDebtPaymentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: CustomerDebtPaymentWrite,
): ServiceResult<CustomerDebtPayment> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  if (!hasEffectiveFinancialPermission(actor.value, 'payments.create')) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const customer = persistence.customers.getById(draft.customerId)
  if (!customer || customer.organizationId !== actor.value.organizationId) {
    return fail({ code: 'CUSTOMER_NOT_FOUND' })
  }

  if (
    draft.method === 'invoice' ||
    draft.method === 'on_credit' ||
    !isPositiveAmount(draft.amount)
  ) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const before = buildDebtView(
    persistence,
    actor.value,
    draft.customerId,
  )
  if (draft.amount > before.remainingDebt) {
    return fail({ code: 'PAYMENT_LIMIT_EXCEEDED' })
  }

  return persistence.runInTransaction(() => {
    let leftover = roundMoney(draft.amount)
    const sales = completedCustomerSales(
      persistence,
      actor.value,
      draft.customerId,
    ).filter((sale) => !draft.saleId || sale.id === draft.saleId)

    if (draft.saleId) {
      const targeted = sales[0]
      if (
        !targeted ||
        targeted.organizationId !== actor.value.organizationId
      ) {
        return fail({ code: 'SALE_NOT_FOUND' })
      }
      const remaining = saleRemaining(persistence, targeted)
      if (draft.amount > remaining) {
        return fail({ code: 'PAYMENT_LIMIT_EXCEEDED' })
      }
    }

    for (const sale of sales) {
      if (leftover <= 0) {
        break
      }

      const remaining = saleRemaining(persistence, sale)
      if (remaining <= 0) {
        continue
      }

      const chunk = Math.min(leftover, remaining)
      const paid = createPayment(persistence, {
        organizationId: actor.value.organizationId,
        createdBy: actor.value.id,
        saleId: sale.id,
        amount: chunk,
        method: draft.method,
        bankName: optionalText(draft.bankName),
        accountReference: optionalText(draft.accountReference),
        paymentReference: optionalText(draft.paymentReference),
        paymentComment: optionalText(draft.comment),
      })
      if (!paid.ok) {
        return paid
      }

      leftover = roundMoney(leftover - chunk)
    }

    if (leftover > 0) {
      return fail({ code: 'INVALID_INPUT' })
    }

    const after = buildDebtView(
      persistence,
      actor.value,
      draft.customerId,
    )
    const now = nowIso()
    return ok(
      persistence.customerDebtPayments.create({
        id: newId(),
        organizationId: actor.value.organizationId,
        customerId: draft.customerId,
        amount: roundMoney(draft.amount),
        method: draft.method,
        actorUserId: actor.value.id,
        remainingAfter: after.remainingDebt,
        bankName: optionalText(draft.bankName),
        accountReference: optionalText(draft.accountReference),
        paymentReference: optionalText(draft.paymentReference),
        comment: optionalText(draft.comment),
        createdAt: now,
        updatedAt: now,
      }),
    )
  })
}

export function debtDashboardTotalsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  periodKey: string,
): ServiceResult<{
  remaining: number
  overdue: number
  paidInPeriod: number
  debtors: number
}> {
  const listed = listCustomerDebtsForUser(persistence, currentUser)
  if (!listed.ok) {
    return listed
  }

  const payments = listCustomerDebtPaymentsForUser(persistence, currentUser)
  if (!payments.ok) {
    return payments
  }

  const remaining = listed.value.reduce((sum, row) => sum + row.remainingDebt, 0)
  const overdue = listed.value.reduce((sum, row) => sum + row.overdueAmount, 0)
  const paidInPeriod = payments.value
    .filter((item) => item.createdAt.slice(0, 7) === periodKey)
    .reduce((sum, item) => sum + item.amount, 0)

  return ok({
    remaining: roundMoney(remaining),
    overdue: roundMoney(overdue),
    paidInPeriod: roundMoney(paidInPeriod),
    debtors: listed.value.filter((row) => row.remainingDebt > 0).length,
  })
}
