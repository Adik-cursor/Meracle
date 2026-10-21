import type { Id, PaymentRefund, SaleReturn, SaleReturnItem, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { catalogExists } from './catalog'
import { isPositiveQuantity, newId, nowIso, optionalText } from './primitives'
import { getSaleRecord } from './sale-record'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import { requireAccessibleWarehouse } from './warehouse-access'
import {
  canCreateReturn as canCreateReturnFinancial,
  canReadReturn as canReadReturnFinancial,
} from './financial-access'

export type SaleReturnItemWrite = {
  saleItemId: Id
  quantity: number
}

export type SaleReturnWrite = {
  saleId: Id
  reason: string
  note?: string
  items: SaleReturnItemWrite[]
}

function aggregateSaleItemQuantities(
  items: { saleItemId: Id; quantity: number }[],
): Map<Id, number> {
  const quantities = new Map<Id, number>()

  for (const item of items) {
    quantities.set(
      item.saleItemId,
      (quantities.get(item.saleItemId) ?? 0) + item.quantity,
    )
  }

  return quantities
}

export function getReturnedQuantity(
  persistence: Persistence,
  organizationId: Id,
  saleItemId: Id,
): number {
  return persistence.saleReturns.list(organizationId).reduce((sum, saleReturn) => {
    if (saleReturn.status !== 'completed') {
      return sum
    }

    return (
      sum +
      persistence.saleReturnItems
        .listByReturnId(saleReturn.id)
        .filter((item) => item.saleItemId === saleItemId)
        .reduce((itemSum, item) => itemSum + item.quantity, 0)
    )
  }, 0)
}

export function getReturnableQuantity(
  persistence: Persistence,
  organizationId: Id,
  saleItemId: Id,
): number {
  for (const sale of persistence.sales.list(organizationId)) {
    const saleItem = persistence.saleItems
      .listBySaleId(sale.id)
      .find((item) => item.id === saleItemId)

    if (saleItem) {
      return Math.max(
        0,
        saleItem.quantity - getReturnedQuantity(persistence, organizationId, saleItemId),
      )
    }
  }

  return 0
}

export function createReturn(
  persistence: Persistence,
  organizationId: Id,
  draft: SaleReturnWrite,
): ServiceResult<SaleReturn> {
  const saleRecord = getSaleRecord(persistence, organizationId, draft.saleId)

  if (!saleRecord) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (saleRecord.sale.status !== 'completed') {
    return fail({ code: 'SALE_NOT_COMPLETED' })
  }

  const reason = draft.reason.trim()
  if (!reason) {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (draft.items.length === 0) {
    return fail({ code: 'INVALID_QUANTITY' })
  }

  const warehouseId = saleRecord.sale.warehouseId
  if (warehouseId) {
    const warehouse = persistence.warehouses.getById(warehouseId)
    if (!warehouse || warehouse.organizationId !== organizationId) {
      return fail({
        code: 'WAREHOUSE_NOT_FOUND',
        warehouseId,
      })
    }
  }

  const requestedBySaleItem = aggregateSaleItemQuantities(draft.items)

  for (const [saleItemId, quantity] of requestedBySaleItem) {
    if (!isPositiveQuantity(quantity)) {
      return fail({
        code: 'INVALID_QUANTITY',
        requestedQuantity: quantity,
      })
    }

    const saleItem = saleRecord.items.find((item) => item.id === saleItemId)
    if (!saleItem) {
      return fail({ code: 'INVALID_INPUT' })
    }

    const returnable =
      saleItem.quantity -
      getReturnedQuantity(persistence, organizationId, saleItem.id)

    if (quantity > returnable) {
      return fail({
        code: 'RETURN_LIMIT_EXCEEDED',
        productId: saleItem.productId,
        requestedQuantity: quantity,
        availableQuantity: returnable,
      })
    }
  }

  const builtItems: Omit<
    SaleReturnItem,
    'returnId' | 'id' | 'createdAt' | 'updatedAt'
  >[] = []

  for (const line of draft.items) {
    if (!isPositiveQuantity(line.quantity)) {
      return fail({
        code: 'INVALID_QUANTITY',
        requestedQuantity: line.quantity,
      })
    }

    const saleItem = saleRecord.items.find((item) => item.id === line.saleItemId)
    if (!saleItem) {
      return fail({ code: 'INVALID_INPUT' })
    }

    if (saleItem.warehouseId) {
      if (!warehouseId || saleItem.warehouseId !== warehouseId) {
        return fail({ code: 'ORGANIZATION_MISMATCH' })
      }

      if (
        !catalogExists(
          persistence,
          organizationId,
          saleItem.warehouseId,
          saleItem.productId,
        )
      ) {
        return fail({
          code: 'PRODUCT_NOT_FOUND',
          warehouseId: saleItem.warehouseId,
          productId: saleItem.productId,
        })
      }
    }

    builtItems.push({
      organizationId,
      saleItemId: saleItem.id,
      warehouseId: saleItem.warehouseId,
      productId: saleItem.productId,
      quantity: line.quantity,
      unitPrice: saleItem.unitPrice,
      total: line.quantity * saleItem.unitPrice,
    })
  }

  const now = nowIso()
  const returnId = newId()
  const saleReturn: SaleReturn = {
    id: returnId,
    organizationId,
    saleId: saleRecord.sale.id,
    warehouseId,
    customerId: saleRecord.sale.customerId,
    status: 'draft',
    total: builtItems.reduce((sum, item) => sum + item.total, 0),
    reason,
    note: optionalText(draft.note),
    createdAt: now,
    updatedAt: now,
  }

  const items: SaleReturnItem[] = builtItems.map((item) => ({
    ...item,
    id: newId(),
    returnId,
    createdAt: now,
    updatedAt: now,
  }))

  return persistence.runInTransaction(() => {
    persistence.saleReturns.create(saleReturn)
    persistence.saleReturnItems.replaceForReturn(returnId, items)
    return ok(saleReturn)
  })
}

export function cancelReturn(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const existing = persistence.saleReturns.getById(id)

  if (!existing) {
    return fail({ code: 'RETURN_NOT_FOUND' })
  }

  if (existing.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (existing.status !== 'draft') {
    return fail({ code: 'RETURN_INVALID_STATUS' })
  }

  const updated = persistence.saleReturns.update(id, {
    status: 'cancelled',
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'RETURN_NOT_FOUND' })
  }

  return ok(undefined)
}

export function listReturnsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<SaleReturn[]> {
  const actor = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!actor.ok) {
    return actor
  }

  const returns: SaleReturn[] = []
  for (const saleReturn of persistence.saleReturns.list(
    actor.value.organizationId,
  )) {
    const sale = persistence.sales.getById(saleReturn.saleId)
    if (!sale || sale.organizationId !== actor.value.organizationId) {
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

    if (canReadReturnFinancial(persistence, actor.value, saleReturn).ok) {
      returns.push(saleReturn)
    }
  }

  return ok(returns)
}

export type SaleReturnDetailItem = {
  productId: Id
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  total: number
}

export type SaleReturnDetail = {
  saleReturn: SaleReturn
  items: SaleReturnDetailItem[]
  sale: {
    id: Id
    createdAt: string
    total: number
    currency: string
    customerId?: Id
    warehouseId?: Id
  }
  customerName?: string
  warehouseName?: string
  cashierName?: string
  saleReceiptNumber?: string
  returnReceiptNumber?: string
  refunds: {
    id: Id
    amount: number
    status: PaymentRefund['status']
    createdAt: string
    method?: string
  }[]
  refundedAmount: number
}

export function getSaleReturnDetailForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  returnId: Id,
): ServiceResult<SaleReturnDetail> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const saleReturn = persistence.saleReturns.getById(returnId)
  if (!saleReturn) {
    return fail({ code: 'RETURN_NOT_FOUND' })
  }

  if (saleReturn.organizationId !== gated.value.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  const saleRecord = getSaleRecord(
    persistence,
    gated.value.organizationId,
    saleReturn.saleId,
  )
  if (!saleRecord) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  const allowed = canReadReturnFinancial(persistence, gated.value, saleReturn)
  if (!allowed.ok) {
    return allowed
  }

  const customer = saleReturn.customerId
    ? persistence.customers.getById(saleReturn.customerId)
    : undefined
  const contact = customer?.contactId
    ? persistence.contacts.getById(customer.contactId)
    : undefined
  const warehouse = saleReturn.warehouseId
    ? persistence.warehouses.getById(saleReturn.warehouseId)
    : undefined
  const saleReceipt = persistence.internalReceipts.getBySaleId(
    gated.value.organizationId,
    saleReturn.saleId,
  )
  const returnReceipt = persistence.internalReceipts.getBySaleReturnId(
    gated.value.organizationId,
    saleReturn.id,
  )
  const cashier = saleReceipt?.cashierId
    ? persistence.users.getById(saleReceipt.cashierId)
    : undefined
  const refunds = persistence.paymentRefunds.listByReturnId(
    gated.value.organizationId,
    saleReturn.id,
  )
  const items = persistence.saleReturnItems.listByReturnId(saleReturn.id).map((item) => {
    const product = persistence.products.getById(item.productId)
    return {
      productId: item.productId,
      productName: product?.name ?? item.productId,
      sku: product?.sku ?? '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    }
  })

  return ok({
    saleReturn,
    items,
    sale: {
      id: saleRecord.sale.id,
      createdAt: saleRecord.sale.createdAt,
      total: saleRecord.sale.total,
      currency: saleRecord.sale.currency,
      customerId: saleRecord.sale.customerId,
      warehouseId: saleRecord.sale.warehouseId,
    },
    customerName: contact
      ? `${contact.firstName} ${contact.lastName}`.trim()
      : undefined,
    warehouseName: warehouse?.name,
    cashierName: cashier
      ? `${cashier.firstName} ${cashier.lastName}`.trim()
      : undefined,
    saleReceiptNumber: saleReceipt?.receiptNumber,
    returnReceiptNumber: returnReceipt?.receiptNumber,
    refunds: refunds.map((refund) => {
      const payment = persistence.payments.getById(refund.paymentId)
      return {
        id: refund.id,
        amount: refund.amount,
        status: refund.status,
        createdAt: refund.createdAt,
        method: payment?.method,
      }
    }),
    refundedAmount: refunds
      .filter((refund) => refund.status === 'completed')
      .reduce((sum, refund) => sum + refund.amount, 0),
  })
}

export function createReturnForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: SaleReturnWrite,
): ServiceResult<SaleReturn> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const saleRecord = getSaleRecord(persistence, organizationId, draft.saleId)
  if (!saleRecord) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (saleRecord.sale.warehouseId) {
    const warehouse = requireAccessibleWarehouse(
      persistence,
      actor.value,
      saleRecord.sale.warehouseId,
    )
    if (!warehouse.ok) {
      return warehouse
    }
  }

  const allowed = canCreateReturnFinancial(
    persistence,
    actor.value,
    saleRecord.sale,
  )
  if (!allowed.ok) {
    return allowed
  }

  return createReturn(persistence, organizationId, draft)
}

export function cancelReturnForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = persistence.saleReturns.getById(id)
  if (!existing) {
    return fail({ code: 'RETURN_NOT_FOUND' })
  }

  const sale = persistence.sales.getById(existing.saleId)
  if (!sale) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (sale.organizationId !== actor.value.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (sale.warehouseId) {
    const warehouse = requireAccessibleWarehouse(
      persistence,
      actor.value,
      sale.warehouseId,
    )
    if (!warehouse.ok) {
      return warehouse
    }
  }

  const allowed = canCreateReturnFinancial(persistence, actor.value, sale)
  if (!allowed.ok) {
    return allowed
  }

  return cancelReturn(persistence, organizationId, id)
}
