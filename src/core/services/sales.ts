import type { Id, Sale, SaleItem, SaleStockCheckResult, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import {
  calcLineTotal,
  calcSaleTotals,
  checkSaleStock,
} from '../../modules/sales/sale-stock'
import { belongsToOrganization, catalogExists, productExists } from './catalog'
import { isPositiveQuantity, newId, nowIso, optionalText } from './primitives'
import { getSaleRecord, type SaleRecordData } from './sale-record'
import {
  requireAccessibleWarehouse,
} from './warehouse-access'
import {
  canConfirmSale as canConfirmSaleFinancial,
  canCreateSale as canCreateSaleFinancial,
  canCreateSaleInOrganization,
  canReadFinancialAnalytics,
  canReadSale as canReadSaleFinancial,
  canUpdateSale as canUpdateSaleFinancial,
  requireWarehouseLessSaleScope,
} from './financial-access'
import { hasEffectiveFinancialPermission, requireActorInOrganization, requireCurrentUser } from './access'
import { getUserForUser } from './users'
import { isPhysicalProduct } from '../types/product'
import { requireModuleEnabledForUser } from './organization-modules'

export type SaleItemWrite = {
  productId: Id
  quantity: number
  unitPrice: number
  discount: number
  warehouseId?: Id
}

export type SaleWrite = {
  warehouseId?: Id
  discount: number
  note?: string
  invoiceNumber?: string
  invoiceDueDate?: string
  invoiceComment?: string
  customerId?: Id
  packageId?: Id
  items: SaleItemWrite[]
}

function saleItemsArePhysical(
  persistence: Persistence,
  items: { productId: Id }[],
): boolean {
  return items.some((item) =>
    isPhysicalProduct(persistence.products.getById(item.productId)),
  )
}

function physicalSaleItems<T extends { productId: Id }>(
  persistence: Persistence,
  items: T[],
): T[] {
  return items.filter((item) =>
    isPhysicalProduct(persistence.products.getById(item.productId)),
  )
}

export function toSaleStockCheckResult(
  result: ServiceResult<unknown>,
): SaleStockCheckResult {
  if (result.ok) {
    return { ok: true }
  }

  return {
    ok: false,
    error: {
      code: 'PRODUCT_NOT_AVAILABLE',
      warehouseId: result.error.warehouseId ?? '',
      productId: result.error.productId ?? '',
      requestedQuantity: result.error.requestedQuantity ?? 0,
      availableQuantity: result.error.availableQuantity ?? 0,
    },
  }
}

function isValidSaleWrite(
  persistence: Persistence,
  draft: SaleWrite,
): boolean {
  if (draft.items.length === 0) {
    return false
  }

  const hasPhysical = saleItemsArePhysical(persistence, draft.items)
  if (hasPhysical && !draft.warehouseId) {
    return false
  }

  if (!Number.isFinite(draft.discount) || draft.discount < 0) {
    return false
  }

  return draft.items.every((item) => {
    const subtotal = item.quantity * item.unitPrice
    return (
      item.productId &&
      isPositiveQuantity(item.quantity) &&
      Number.isFinite(item.unitPrice) &&
      item.unitPrice >= 0 &&
      Number.isFinite(item.discount) &&
      item.discount >= 0 &&
      item.discount <= subtotal
    )
  })
}

function unavailableWrite(draft: SaleWrite): ServiceResult<never> {
  return fail({
    code: 'PRODUCT_NOT_AVAILABLE',
    warehouseId: draft.warehouseId,
    productId: draft.items[0]?.productId ?? '',
    requestedQuantity: draft.items[0]?.quantity ?? 0,
    availableQuantity: 0,
  })
}

function catalogMatchesWrite(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id | undefined,
  items: SaleItemWrite[],
): boolean {
  return items.every((item) => {
    if (!productExists(persistence, organizationId, item.productId)) {
      return false
    }

    const product = persistence.products.getById(item.productId)
    if (!isPhysicalProduct(product)) {
      return true
    }

    return Boolean(
      warehouseId &&
        catalogExists(persistence, organizationId, warehouseId, item.productId),
    )
  })
}

function customerMatchesWrite(
  persistence: Persistence,
  organizationId: Id,
  customerId: string | undefined,
): boolean {
  if (!customerId) {
    return true
  }

  const customer = persistence.customers.getById(customerId)
  return belongsToOrganization(customer, organizationId)
}

function buildSaleRecord(
  persistence: Persistence,
  organizationId: Id,
  currency: string,
  draft: SaleWrite,
  existing?: SaleRecordData,
): SaleRecordData {
  const now = nowIso()
  const saleId = existing?.sale.id ?? newId()
  const items: SaleItem[] = draft.items.map((item) => {
    const existingItem = existing?.items.find(
      (current) => current.productId === item.productId,
    )

    return {
      id: existingItem?.id ?? newId(),
      organizationId,
      saleId,
      warehouseId: draft.warehouseId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      costPrice: existingItem?.costPrice ?? persistence.products.getById(item.productId)?.costPrice ?? 0,
      total: calcLineTotal(item.quantity, item.unitPrice, item.discount),
      createdAt: existingItem?.createdAt ?? now,
      updatedAt: now,
    }
  })
  const totals = calcSaleTotals(
    items.map((item) => item.total),
    draft.discount,
  )

  const sale: Sale = {
    id: saleId,
    organizationId,
    warehouseId: draft.warehouseId,
    customerId: draft.customerId ? draft.customerId : undefined,
    packageId: draft.packageId ?? existing?.sale.packageId,
    status: existing?.sale.status ?? 'draft',
    currency,
    subtotal: totals.subtotal,
    discount: draft.discount,
    total: totals.total,
    note: optionalText(draft.note),
    invoiceNumber: optionalText(draft.invoiceNumber) ?? existing?.sale.invoiceNumber,
    invoiceDueDate: optionalText(draft.invoiceDueDate) ?? existing?.sale.invoiceDueDate,
    invoiceComment: optionalText(draft.invoiceComment) ?? existing?.sale.invoiceComment,
    settlementMethod: existing?.sale.settlementMethod,
    createdAt: existing?.sale.createdAt ?? now,
    updatedAt: now,
  }

  return { sale, items }
}

function itemsMatchSaleWarehouse(
  persistence: Persistence,
  draft: SaleWrite,
): boolean {
  return draft.items.every((item) => {
    const physical = isPhysicalProduct(
      persistence.products.getById(item.productId),
    )

    if (!physical) {
      return !item.warehouseId
    }

    return !item.warehouseId || item.warehouseId === draft.warehouseId
  })
}

function persistSaleRecord(persistence: Persistence, record: SaleRecordData) {
  const existing = persistence.sales.getById(record.sale.id)

  if (existing) {
    persistence.sales.update(record.sale.id, record.sale)
  } else {
    persistence.sales.create(record.sale)
  }

  persistence.saleItems.replaceForSale(record.sale.id, record.items)
}

function checkDraft(
  persistence: Persistence,
  organizationId: Id,
  draft: SaleWrite,
): ServiceResult {
  if (!isValidSaleWrite(persistence, draft)) {
    return unavailableWrite(draft)
  }

  if (!itemsMatchSaleWarehouse(persistence, draft)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  if (
    !catalogMatchesWrite(
      persistence,
      organizationId,
      draft.warehouseId,
      draft.items,
    ) ||
    !customerMatchesWrite(persistence, organizationId, draft.customerId)
  ) {
    return unavailableWrite(draft)
  }

  const stockItems = physicalSaleItems(persistence, draft.items)
  if (stockItems.length === 0) {
    return ok(undefined)
  }

  const warehouseId = draft.warehouseId
  if (!warehouseId) {
    return unavailableWrite(draft)
  }

  const stockCheck = checkSaleStock(
    warehouseId,
    stockItems,
    (itemWarehouseId, productId) =>
      persistence.inventory.getByWarehouseAndProduct(
        organizationId,
        itemWarehouseId,
        productId,
      ),
  )

  if (!stockCheck.ok) {
    return fail({
      code: 'INSUFFICIENT_STOCK',
      warehouseId: stockCheck.error.warehouseId,
      productId: stockCheck.error.productId,
      requestedQuantity: stockCheck.error.requestedQuantity,
      availableQuantity: stockCheck.error.availableQuantity,
    })
  }

  return ok(undefined)
}

function saleItemsUseSaleWarehouse(record: SaleRecordData): boolean {
  return record.items.every((item) => {
    if (!item.warehouseId) {
      return true
    }

    return item.warehouseId === record.sale.warehouseId
  })
}

export function createSale(
  persistence: Persistence,
  organizationId: Id,
  currency: string,
  draft: SaleWrite,
): ServiceResult<SaleRecordData> {
  const checked = checkDraft(persistence, organizationId, draft)
  if (!checked.ok) {
    return checked
  }

  const record = buildSaleRecord(persistence, organizationId, currency, draft)

  if (!saleItemsUseSaleWarehouse(record)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return persistence.runInTransaction(() => {
    persistSaleRecord(persistence, record)
    return ok(record)
  })
}

export function updateSale(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  currency: string,
  draft: SaleWrite,
): ServiceResult<SaleRecordData> {
  const existing = getSaleRecord(persistence, organizationId, id)

  if (!existing) {
    return fail({ code: 'SALE_NOT_FOUND', warehouseId: draft.warehouseId })
  }

  if (existing.sale.status !== 'draft') {
    return fail({
      code: 'SALE_NOT_DRAFT',
      warehouseId: existing.sale.warehouseId,
      productId: existing.items[0]?.productId,
    })
  }

  const checked = checkDraft(persistence, organizationId, draft)
  if (!checked.ok) {
    return checked
  }

  const record = buildSaleRecord(
    persistence,
    organizationId,
    currency,
    draft,
    existing,
  )

  if (!saleItemsUseSaleWarehouse(record)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return persistence.runInTransaction(() => {
    persistSaleRecord(persistence, record)
    return ok(record)
  })
}

export function confirmSale(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const existing = getSaleRecord(persistence, organizationId, id)

  if (!existing) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (existing.sale.status !== 'draft') {
    return fail({
      code: 'SALE_NOT_DRAFT',
      warehouseId: existing.sale.warehouseId,
      productId: existing.items[0]?.productId,
      requestedQuantity: existing.items[0]?.quantity,
    })
  }

  const stockItems = physicalSaleItems(persistence, existing.items)
  if (stockItems.length > 0) {
    const warehouseId = existing.sale.warehouseId
    if (!warehouseId) {
      return fail({
        code: 'INSUFFICIENT_STOCK',
        warehouseId: '',
        productId: stockItems[0]?.productId,
        requestedQuantity: stockItems[0]?.quantity,
        availableQuantity: 0,
      })
    }

    const stockCheck = checkSaleStock(
      warehouseId,
      stockItems,
      (itemWarehouseId, productId) =>
        persistence.inventory.getByWarehouseAndProduct(
          organizationId,
          itemWarehouseId,
          productId,
        ),
    )

    if (!stockCheck.ok) {
      return fail({
        code: 'INSUFFICIENT_STOCK',
        warehouseId: stockCheck.error.warehouseId,
        productId: stockCheck.error.productId,
        requestedQuantity: stockCheck.error.requestedQuantity,
        availableQuantity: stockCheck.error.availableQuantity,
      })
    }
  }

  const updated = persistence.sales.update(id, {
    status: 'confirmed',
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  return ok(undefined)
}

export function cancelSale(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const existing = getSaleRecord(persistence, organizationId, id)

  if (!existing) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (
    existing.sale.status !== 'draft' &&
    existing.sale.status !== 'confirmed'
  ) {
    return fail({ code: 'SALE_CANNOT_CANCEL' })
  }

  const updated = persistence.sales.update(id, {
    status: 'cancelled',
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  return ok(undefined)
}

export function listSalesForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<Sale[]> {
  const actor = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!actor.ok) {
    return actor
  }

  const sales: Sale[] = []
  for (const sale of persistence.sales.list(actor.value.organizationId)) {
    const scope = requireSaleScope(persistence, actor.value, sale)
    if (!scope.ok) {
      continue
    }

    if (canReadSaleFinancial(persistence, actor.value, sale).ok) {
      sales.push(sale)
    }
  }

  return ok(sales)
}

function saleCashierUserId(persistence: Persistence, sale: Sale): Id | undefined {
  return persistence.payments
    .listBySaleId(sale.organizationId, sale.id)
    .find((payment) => payment.status === 'completed')?.createdBy
}

export function listSalesForManagedEmployeeForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  employeeId: Id,
): ServiceResult<Sale[]> {
  const employee = getUserForUser(persistence, currentUser, employeeId)
  if (!employee.ok) {
    return employee
  }

  const listed = listSalesForUser(persistence, currentUser)
  if (!listed.ok) {
    return listed
  }

  return ok(
    listed.value
      .filter((sale) => saleCashierUserId(persistence, sale) === employeeId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  )
}

export function countSalesByCashierForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<Record<Id, number>> {
  const listed = listSalesForUser(persistence, currentUser)
  if (!listed.ok) {
    return listed
  }

  const counts: Record<Id, number> = {}
  for (const sale of listed.value) {
    const cashierId = saleCashierUserId(persistence, sale)
    if (!cashierId) {
      continue
    }
    counts[cashierId] = (counts[cashierId] ?? 0) + 1
  }

  return ok(counts)
}

export function getSaleForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  saleId: Id,
): ServiceResult<Sale> {
  const actor = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!actor.ok) {
    return actor
  }

  const sale = persistence.sales.getById(saleId)
  if (!sale) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (sale.organizationId !== actor.value.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  const warehouse = requireSaleScope(persistence, actor.value, sale)
  if (!warehouse.ok) {
    return warehouse
  }

  const allowed = canReadSaleFinancial(persistence, actor.value, sale)
  if (!allowed.ok) {
    return allowed
  }

  return ok(sale)
}

export function listSalesForAnalytics(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<Sale[]> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const sales: Sale[] = []
  for (const sale of persistence.sales.list(actor.value.organizationId)) {
    const scope = requireSaleScope(persistence, actor.value, sale)
    if (!scope.ok) {
      continue
    }

    if (!sale.warehouseId) {
      if (!hasEffectiveFinancialPermission(actor.value, 'financial_analytics.read')) {
        continue
      }

      if (requireWarehouseLessSaleScope(persistence, actor.value, sale).ok) {
        sales.push(sale)
      }

      continue
    }

    const warehouse = persistence.warehouses.getById(sale.warehouseId)
    if (!warehouse) {
      continue
    }

    if (canReadFinancialAnalytics(persistence, actor.value, warehouse).ok) {
      sales.push(sale)
    }
  }

  return ok(sales)
}

function requireSaleScope(
  persistence: Persistence,
  actor: User,
  sale: Sale,
): ServiceResult<User> {
  if (!sale.warehouseId) {
    return requireWarehouseLessSaleScope(persistence, actor, sale)
  }

  const warehouse = persistence.warehouses.getById(sale.warehouseId)
  if (!warehouse) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }

  if (warehouse.organizationId !== actor.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (actor.role === 'sales_employee') {
    if (!actor.branchId || warehouse.branchId !== actor.branchId) {
      return fail({ code: 'ACCESS_DENIED' })
    }

    return ok(actor)
  }

  const accessible = requireAccessibleWarehouse(
    persistence,
    actor,
    sale.warehouseId,
  )
  if (!accessible.ok) {
    return accessible
  }

  return ok(actor)
}

function resolveSaleWarehouseId(
  actor: User,
  requestedWarehouseId: Id | undefined,
): ServiceResult<Id> {
  if (!requestedWarehouseId) {
    return fail({ code: 'USER_WAREHOUSE_REQUIRED' })
  }

  if (actor.role !== 'sales_employee') {
    return ok(requestedWarehouseId)
  }

  if (!actor.warehouseId) {
    return fail({ code: 'USER_WAREHOUSE_REQUIRED' })
  }

  if (requestedWarehouseId !== actor.warehouseId) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return ok(actor.warehouseId)
}

export function createSaleForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  currency: string,
  draft: SaleWrite,
): ServiceResult<SaleRecordData> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  if (!saleItemsArePhysical(persistence, draft.items)) {
    const allowed = canCreateSaleInOrganization(actor.value, organizationId)
    if (!allowed.ok) {
      return allowed
    }

    return createSale(persistence, organizationId, currency, {
      ...draft,
      warehouseId: undefined,
    })
  }

  const warehouseId = resolveSaleWarehouseId(actor.value, draft.warehouseId)
  if (!warehouseId.ok) {
    return warehouseId
  }

  const warehouse = requireAccessibleWarehouse(
    persistence,
    actor.value,
    warehouseId.value,
  )
  if (!warehouse.ok) {
    return warehouse
  }

  const allowed = canCreateSaleFinancial(
    persistence,
    actor.value,
    warehouse.value,
  )
  if (!allowed.ok) {
    return allowed
  }

  return createSale(persistence, organizationId, currency, {
    ...draft,
    warehouseId: warehouse.value.id,
  })
}

export function updateSaleForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  currency: string,
  draft: SaleWrite,
): ServiceResult<SaleRecordData> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = getSaleRecord(persistence, organizationId, id)
  if (!existing) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  const currentScope = requireSaleScope(persistence, actor.value, existing.sale)
  if (!currentScope.ok) {
    return currentScope
  }

  const allowed = canUpdateSaleFinancial(persistence, actor.value, existing.sale)
  if (!allowed.ok) {
    return allowed
  }

  if (!saleItemsArePhysical(persistence, draft.items)) {
    return updateSale(persistence, organizationId, id, currency, {
      ...draft,
      warehouseId: undefined,
    })
  }

  const warehouseId = resolveSaleWarehouseId(actor.value, draft.warehouseId)
  if (!warehouseId.ok) {
    return warehouseId
  }

  const nextWarehouse = requireAccessibleWarehouse(
    persistence,
    actor.value,
    warehouseId.value,
  )
  if (!nextWarehouse.ok) {
    return nextWarehouse
  }

  return updateSale(persistence, organizationId, id, currency, {
    ...draft,
    warehouseId: nextWarehouse.value.id,
  })
}

export function confirmSaleForUser(
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

  const existing = getSaleRecord(persistence, organizationId, id)
  if (!existing) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  const warehouse = requireSaleScope(persistence, actor.value, existing.sale)
  if (!warehouse.ok) {
    return warehouse
  }

  const allowed = canConfirmSaleFinancial(
    persistence,
    actor.value,
    existing.sale,
  )
  if (!allowed.ok) {
    return allowed
  }

  return confirmSale(persistence, organizationId, id)
}

export function cancelSaleForUser(
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

  const existing = getSaleRecord(persistence, organizationId, id)
  if (!existing) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  const warehouse = requireSaleScope(persistence, actor.value, existing.sale)
  if (!warehouse.ok) {
    return warehouse
  }

  const allowed = canUpdateSaleFinancial(persistence, actor.value, existing.sale)
  if (!allowed.ok) {
    return allowed
  }

  return cancelSale(persistence, organizationId, id)
}
