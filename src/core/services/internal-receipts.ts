import type {
  Id,
  InternalReceipt,
  InternalReceiptItem,
  PaymentMethod,
  User,
} from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import { isPhysicalProduct, normalizeProductItemType } from '../types/product'
import type { Persistence } from '../repositories/persistence'
import { canReadSale } from './financial-access'
import { requireModuleEnabledForUser } from './organization-modules'
import { newId, nowIso, optionalText } from './primitives'
import { getSaleRecord } from './sale-record'
import { roundMoney } from '../../modules/sales/sale-payment'

const SALE_RECEIPT_PREFIX = 'ЧЕК-'
const RETURN_RECEIPT_PREFIX = 'ВОЗВРАТ-'

export type SaleReceiptPaymentDetails = {
  method: PaymentMethod
  tenderedAmount: number
  changeAmount: number
  paymentId?: Id
  bankName?: string
  terminalName?: string
  accountReference?: string
  paymentReference?: string
  paymentComment?: string
  methodDetail?: string
}

function nextNumber(
  receipts: InternalReceipt[],
  organizationId: Id,
  prefix: string,
): string {
  let max = 0

  for (const receipt of receipts) {
    if (receipt.organizationId !== organizationId) {
      continue
    }

    if (!receipt.receiptNumber.startsWith(prefix)) {
      continue
    }

    const parsed = Number(receipt.receiptNumber.slice(prefix.length))
    if (Number.isFinite(parsed) && parsed > max) {
      max = parsed
    }
  }

  return `${prefix}${String(max + 1).padStart(6, '0')}`
}

function snapshotItems(
  persistence: Persistence,
  items: {
    productId: Id
    quantity: number
    unitPrice: number
    discount: number
    total: number
  }[],
): InternalReceiptItem[] {
  return items.map((item) => {
    const product = persistence.products.getById(item.productId)

    return {
      productId: item.productId,
      name: product?.name ?? item.productId,
      sku: product?.sku ?? '',
      itemType: normalizeProductItemType(product?.itemType),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      total: item.total,
    }
  })
}

export function createInternalSaleReceipt(
  persistence: Persistence,
  organizationId: Id,
  cashierId: Id,
  saleId: Id,
  payment: SaleReceiptPaymentDetails,
): ServiceResult<InternalReceipt> {
  const paid = roundMoney(payment.tenderedAmount)
  if (paid <= 0) {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (payment.paymentId) {
    const existingByPayment = persistence.internalReceipts.getByPaymentId(
      organizationId,
      payment.paymentId,
    )
    if (existingByPayment) {
      return ok(existingByPayment)
    }
  }

  const record = getSaleRecord(persistence, organizationId, saleId)
  if (!record || record.sale.status !== 'completed') {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  const lineDiscount = record.items.reduce((sum, item) => sum + item.discount, 0)
  const subtotal = roundMoney(
    record.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  )
  const now = nowIso()
  const receipt: InternalReceipt = {
    id: newId(),
    organizationId,
    receiptNumber: nextNumber(
      persistence.internalReceipts.list(organizationId),
      organizationId,
      SALE_RECEIPT_PREFIX,
    ),
    receiptType: 'sale',
    saleId,
    paymentId: payment.paymentId,
    cashierId,
    warehouseId: record.sale.warehouseId,
    items: snapshotItems(persistence, record.items),
    subtotal,
    discount: roundMoney(lineDiscount + record.sale.discount),
    total: paid,
    paymentMethod: payment.method,
    tenderedAmount: paid,
    changeAmount: roundMoney(payment.changeAmount),
    bankName: optionalText(payment.bankName),
    terminalName: optionalText(payment.terminalName),
    accountReference: optionalText(payment.accountReference),
    paymentReference: optionalText(payment.paymentReference),
    paymentComment: optionalText(payment.paymentComment),
    methodDetail: optionalText(payment.methodDetail),
    comment: record.sale.note,
    currency: record.sale.currency,
    createdAt: now,
    updatedAt: now,
  }

  return ok(persistence.internalReceipts.create(receipt))
}

export function createInternalSaleReceiptForPayment(
  persistence: Persistence,
  payment: {
    id: Id
    organizationId: Id
    saleId?: Id
    createdBy: Id
    amount: number
    method: PaymentMethod
    bankName?: string
    terminalName?: string
    accountReference?: string
    paymentReference?: string
    paymentComment?: string
    methodDetail?: string
  },
): ServiceResult<InternalReceipt> {
  if (!payment.saleId) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  const record = getSaleRecord(
    persistence,
    payment.organizationId,
    payment.saleId,
  )
  if (!record) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }
  if (record.sale.status !== 'completed') {
    return fail({ code: 'SALE_NOT_COMPLETED' })
  }

  return createInternalSaleReceipt(
    persistence,
    payment.organizationId,
    payment.createdBy,
    payment.saleId,
    {
      method: payment.method,
      tenderedAmount: payment.amount,
      changeAmount: 0,
      paymentId: payment.id,
      bankName: payment.bankName,
      terminalName: payment.terminalName,
      accountReference: payment.accountReference,
      paymentReference: payment.paymentReference,
      paymentComment: payment.paymentComment,
      methodDetail: payment.methodDetail,
    },
  )
}

export function createInternalReturnReceipt(
  persistence: Persistence,
  organizationId: Id,
  cashierId: Id,
  saleReturnId: Id,
): ServiceResult<InternalReceipt> {
  const existing = persistence.internalReceipts.getBySaleReturnId(
    organizationId,
    saleReturnId,
  )
  if (existing) {
    return ok(existing)
  }

  const saleReturn = persistence.saleReturns.getById(saleReturnId)
  if (
    !saleReturn ||
    saleReturn.organizationId !== organizationId ||
    saleReturn.status !== 'completed'
  ) {
    return fail({ code: 'RETURN_NOT_FOUND' })
  }

  const record = getSaleRecord(persistence, organizationId, saleReturn.saleId)
  if (!record) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  const returnItems = persistence.saleReturnItems.listByReturnId(saleReturnId)
  const items = returnItems.map((item) => {
    const saleItem = record.items.find((entry) => entry.id === item.saleItemId)
    const product = persistence.products.getById(item.productId)
    const discount = saleItem
      ? roundMoney(
          (saleItem.discount / Math.max(saleItem.quantity, 1)) * item.quantity,
        )
      : 0

    return {
      productId: item.productId,
      name: product?.name ?? item.productId,
      sku: product?.sku ?? '',
      itemType: normalizeProductItemType(product?.itemType),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount,
      total: item.total,
    }
  })

  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  )
  const discount = roundMoney(items.reduce((sum, item) => sum + item.discount, 0))
  const saleReceipt = persistence.internalReceipts.getBySaleId(
    organizationId,
    saleReturn.saleId,
  )
  const now = nowIso()
  const hasPhysical = items.some((item) => isPhysicalProduct(item))

  const receipt: InternalReceipt = {
    id: newId(),
    organizationId,
    receiptNumber: nextNumber(
      persistence.internalReceipts.list(organizationId),
      organizationId,
      RETURN_RECEIPT_PREFIX,
    ),
    receiptType: 'return',
    saleId: saleReturn.saleId,
    saleReturnId,
    cashierId,
    warehouseId: hasPhysical
      ? (saleReturn.warehouseId ?? record.sale.warehouseId)
      : undefined,
    items,
    subtotal,
    discount,
    total: roundMoney(saleReturn.total),
    comment: saleReturn.note ?? record.sale.note,
    referenceSaleId: saleReturn.saleId,
    referenceReceiptId: saleReceipt?.id,
    currency: record.sale.currency,
    createdAt: now,
    updatedAt: now,
  }

  return ok(persistence.internalReceipts.create(receipt))
}

export function listInternalReceiptsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<InternalReceipt[]> {
  const actor = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!actor.ok) {
    return actor
  }

  const receipts: InternalReceipt[] = []
  for (const receipt of persistence.internalReceipts.list(
    actor.value.organizationId,
  )) {
    const sale = persistence.sales.getById(receipt.saleId)
    if (!sale) {
      continue
    }

    if (canReadSale(persistence, actor.value, sale).ok) {
      receipts.push(receipt)
    }
  }

  return ok(receipts)
}

export function getInternalReceiptForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  receiptId: Id,
): ServiceResult<InternalReceipt> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const receipt = persistence.internalReceipts.getById(receiptId)
  if (!receipt) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (receipt.organizationId !== gated.value.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  const sale = persistence.sales.getById(receipt.saleId)
  if (!sale) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  const allowed = canReadSale(persistence, currentUser, sale)
  if (!allowed.ok) {
    return allowed
  }

  return ok(receipt)
}

export function issueInternalSaleReceiptForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  saleId: Id,
): ServiceResult<InternalReceipt> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const existing = persistence.internalReceipts.getBySaleId(
    gated.value.organizationId,
    saleId,
  )
  if (existing && existing.receiptType === 'sale') {
    return ok(existing)
  }

  const record = getSaleRecord(persistence, gated.value.organizationId, saleId)
  if (!record) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  const allowed = canReadSale(persistence, gated.value, record.sale)
  if (!allowed.ok) {
    return allowed
  }

  const payments = persistence.payments
    .listBySaleId(gated.value.organizationId, saleId)
    .filter((payment) => payment.status === 'completed')
  const last = payments.at(-1)
  const paid = roundMoney(
    payments.reduce((sum, payment) => sum + payment.amount, 0),
  )
  const tendered = paid > 0 ? paid : roundMoney(record.sale.total)

  return createInternalSaleReceipt(
    persistence,
    gated.value.organizationId,
    gated.value.id,
    saleId,
    {
      method: last?.method ?? 'cash',
      tenderedAmount: tendered,
      changeAmount: 0,
      paymentId: last?.id,
      bankName: last?.bankName,
      terminalName: last?.terminalName,
      accountReference: last?.accountReference,
      paymentReference: last?.paymentReference,
      paymentComment: last?.paymentComment,
      methodDetail: last?.methodDetail,
    },
  )
}
