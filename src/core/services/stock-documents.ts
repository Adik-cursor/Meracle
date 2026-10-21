import type { Id } from '../types'
import type { Persistence } from '../repositories/persistence'
import { okVoid, fail, type ServiceResult } from '../types/domain-error'
import { belongsToOrganization, catalogExists } from './catalog'

export function requireWarehouse(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
): ServiceResult<void> {
  const warehouse = persistence.warehouses.getById(warehouseId)

  if (!warehouse) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND', warehouseId })
  }

  if (!belongsToOrganization(warehouse, organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH', warehouseId })
  }

  return okVoid()
}

export function requireProductInWarehouse(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
  productId: Id,
): ServiceResult<void> {
  const warehouse = persistence.warehouses.getById(warehouseId)
  if (!warehouse || warehouse.organizationId !== organizationId) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND', warehouseId, productId })
  }

  const product = persistence.products.getById(productId)
  if (!product || product.organizationId !== organizationId) {
    return fail({ code: 'PRODUCT_NOT_FOUND', warehouseId, productId })
  }

  if (!catalogExists(persistence, organizationId, warehouseId, productId)) {
    return fail({ code: 'PRODUCT_NOT_FOUND', warehouseId, productId })
  }

  return okVoid()
}

export function aggregateProductQuantities(
  items: { warehouseId: Id; productId: Id; quantity: number }[],
): { warehouseId: Id; productId: Id; quantity: number }[] {
  const totals = new Map<
    string,
    { warehouseId: Id; productId: Id; quantity: number }
  >()

  for (const item of items) {
    const key = `${item.warehouseId}:${item.productId}`
    const existing = totals.get(key)

    if (existing) {
      existing.quantity += item.quantity
      continue
    }

    totals.set(key, { ...item })
  }

  return [...totals.values()]
}
