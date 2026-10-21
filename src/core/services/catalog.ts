import type { Id } from '../types'
import type { Persistence } from '../repositories/persistence'

export function belongsToOrganization<T extends { organizationId: Id }>(
  entity: T | undefined,
  organizationId: Id,
): entity is T {
  return Boolean(entity && entity.organizationId === organizationId)
}

export function productExists(
  persistence: Persistence,
  organizationId: Id,
  productId: Id,
): boolean {
  const product = persistence.products.getById(productId)
  return belongsToOrganization(product, organizationId)
}

export function catalogExists(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
  productId: Id,
): boolean {
  const warehouse = persistence.warehouses.getById(warehouseId)
  const product = persistence.products.getById(productId)

  return (
    belongsToOrganization(warehouse, organizationId) &&
    belongsToOrganization(product, organizationId)
  )
}
