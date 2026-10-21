import type { Id, SaleStockCheckResult, User } from '../types'
import {
  aggregateItemQuantities,
  checkSaleStock,
} from '../../modules/sales/sale-stock'
import type { Persistence } from '../repositories/persistence'
import { fail, okVoid, type ServiceResult } from '../types/domain-error'
import { belongsToOrganization, catalogExists } from './catalog'
import { applyStockDeltas } from './inventory'
import { nowIso } from './primitives'
import { getSaleRecord } from './sale-record'
import { toSaleStockCheckResult } from './sales'
import { createMovements } from './stock-movements'
import { canCompleteSale as canCompleteSaleFinancial } from './financial-access'
import { requireAccessibleWarehouse } from './warehouse-access'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import { isPhysicalProduct } from '../types/product'

function unavailable(
  warehouseId: Id,
  productId: Id,
  requestedQuantity: number,
): SaleStockCheckResult {
  return {
    ok: false,
    error: {
      code: 'PRODUCT_NOT_AVAILABLE',
      warehouseId,
      productId,
      requestedQuantity,
      availableQuantity: 0,
    },
  }
}

export function completeSale(
  persistence: Persistence,
  organizationId: Id,
  saleId: Id,
): SaleStockCheckResult {
  const existing = getSaleRecord(persistence, organizationId, saleId)
  const failResult = unavailable(
    existing?.sale.warehouseId ?? '',
    existing?.items[0]?.productId ?? '',
    existing?.items[0]?.quantity ?? 0,
  )
  const lockKey = `completeSale:${saleId}`

  if (!existing || existing.sale.status !== 'confirmed') {
    return failResult
  }

  if (!persistence.locks.tryAcquire(lockKey)) {
    return failResult
  }

  return persistence.runInTransaction(
    () => {
      if (existing.sale.customerId) {
        const customer = persistence.customers.getById(existing.sale.customerId)

        if (!belongsToOrganization(customer, organizationId)) {
          return failResult
        }
      }

      const catalogOk = existing.items.every((item) => {
        const product = persistence.products.getById(item.productId)
        if (!belongsToOrganization(product, organizationId)) {
          return false
        }

        if (!isPhysicalProduct(product)) {
          return true
        }

        return catalogExists(
          persistence,
          organizationId,
          existing.sale.warehouseId ?? '',
          item.productId,
        )
      })

      if (!catalogOk) {
        return failResult
      }

      for (const item of existing.items) {
        const product = persistence.products.getById(item.productId)
        let costPrice = product?.costPrice ?? 0

        if (
          isPhysicalProduct(product) &&
          existing.sale.warehouseId
        ) {
          const inventory = persistence.inventory.getByWarehouseAndProduct(
            organizationId,
            existing.sale.warehouseId,
            item.productId,
          )
          if (inventory) {
            costPrice = inventory.unitCost
          }
        }

        persistence.saleItems.update(item.id, {
          costPrice,
          updatedAt: nowIso(),
        })
      }

      const stockItems = existing.items.filter((item) =>
        isPhysicalProduct(persistence.products.getById(item.productId)),
      )

      if (stockItems.length > 0) {
        const warehouseId = existing.sale.warehouseId
        if (!warehouseId) {
          return failResult
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
          return stockCheck
        }

        const movementDrafts = stockItems.map((item) => ({
          warehouseId: item.warehouseId ?? warehouseId,
          productId: item.productId,
          type: 'shipment' as const,
          quantity: item.quantity,
          note: existing.sale.id,
        }))

        const updates = aggregateItemQuantities(stockItems).map((item) => ({
          warehouseId,
          productId: item.productId,
          delta: -item.quantity,
        }))

        const applied = applyStockDeltas(persistence, organizationId, updates)
        if (!applied.ok) {
          return toSaleStockCheckResult(applied)
        }

        const moved = createMovements(
          persistence,
          organizationId,
          organizationId,
          movementDrafts,
        )
        if (!moved.ok) {
          return toSaleStockCheckResult(moved)
        }
      }

      const updated = persistence.sales.update(saleId, {
        status: 'completed',
        updatedAt: nowIso(),
      })

      if (!updated) {
        return failResult
      }

      return { ok: true as const }
    },
    {
      shouldCommit: (result) => result.ok,
      onRollback: () => persistence.locks.release(lockKey),
    },
  )
}

export function completeSaleForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  saleId: Id,
): ServiceResult {
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

  const allowed = canCompleteSaleFinancial(
    persistence,
    actor.value,
    existing.sale,
  )
  if (!allowed.ok) {
    return allowed
  }

  const result = completeSale(persistence, organizationId, saleId)
  return result.ok
    ? okVoid()
    : fail({
        code: 'INSUFFICIENT_STOCK',
        warehouseId: result.error.warehouseId,
        productId: result.error.productId,
        requestedQuantity: result.error.requestedQuantity,
        availableQuantity: result.error.availableQuantity,
      })
}
