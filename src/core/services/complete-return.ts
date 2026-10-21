import type { Id, User } from '../types'
import { fail, okVoid, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { catalogExists } from './catalog'
import { applyStockDeltas } from './inventory'
import { isPositiveQuantity, nowIso } from './primitives'
import { getReturnedQuantity } from './sale-returns'
import { getSaleRecord } from './sale-record'
import { createMovements } from './stock-movements'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import { requireAccessibleWarehouse } from './warehouse-access'
import { canCompleteReturn as canCompleteReturnFinancial } from './financial-access'
import { createInternalReturnReceipt } from './internal-receipts'

function aggregateStockIncreases(
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

export function completeReturn(
  persistence: Persistence,
  organizationId: Id,
  returnId: Id,
): boolean {
  const saleReturn = persistence.saleReturns.getById(returnId)
  const lockKey = `completeReturn:${returnId}`

  if (
    !saleReturn ||
    saleReturn.organizationId !== organizationId ||
    saleReturn.status !== 'draft'
  ) {
    return false
  }

  if (!persistence.locks.tryAcquire(lockKey)) {
    return false
  }

  return persistence.runInTransaction(
    () => {
      const saleRecord = getSaleRecord(
        persistence,
        organizationId,
        saleReturn.saleId,
      )
      if (!saleRecord || saleRecord.sale.status !== 'completed') {
        return false
      }

      const warehouseId = saleReturn.warehouseId
      if (warehouseId) {
        const warehouse = persistence.warehouses.getById(warehouseId)
        if (!warehouse || warehouse.organizationId !== organizationId) {
          return false
        }

        if (saleRecord.sale.warehouseId && warehouseId !== saleRecord.sale.warehouseId) {
          return false
        }
      }

      const items = persistence.saleReturnItems.listByReturnId(returnId)

      if (
        items.length === 0 ||
        items.some((item) => !isPositiveQuantity(item.quantity))
      ) {
        return false
      }

      const requestedBySaleItem = aggregateSaleItemQuantities(items)

      for (const [saleItemId, quantity] of requestedBySaleItem) {
        const saleItem = saleRecord.items.find((item) => item.id === saleItemId)

        if (
          !saleItem ||
          quantity >
            saleItem.quantity -
              getReturnedQuantity(persistence, organizationId, saleItem.id)
        ) {
          return false
        }
      }

      for (const item of items) {
        const saleItem = saleRecord.items.find(
          (current) => current.id === item.saleItemId,
        )

        if (!saleItem || saleItem.productId !== item.productId) {
          return false
        }

        if (item.warehouseId) {
          if (!saleReturn.warehouseId || item.warehouseId !== saleReturn.warehouseId) {
            return false
          }

          if (item.warehouseId !== saleItem.warehouseId) {
            return false
          }

          if (
            !catalogExists(
              persistence,
              organizationId,
              item.warehouseId,
              item.productId,
            )
          ) {
            return false
          }
        }
      }

      const stockItems = items.filter((item) => Boolean(item.warehouseId)) as {
        warehouseId: Id
        productId: Id
        quantity: number
      }[]

      if (stockItems.length > 0) {
        const updates = aggregateStockIncreases(stockItems).map((item) => ({
          warehouseId: item.warehouseId,
          productId: item.productId,
          delta: item.quantity,
        }))

        if (!applyStockDeltas(persistence, organizationId, updates).ok) {
          return false
        }

        const moved = createMovements(
          persistence,
          organizationId,
          organizationId,
          stockItems.map((item) => ({
            warehouseId: item.warehouseId,
            productId: item.productId,
            type: 'return' as const,
            quantity: item.quantity,
            note: saleReturn.id,
          })),
        )

        if (!moved.ok) {
          return false
        }
      }

      const updated = persistence.saleReturns.update(returnId, {
        status: 'completed',
        updatedAt: nowIso(),
      })

      return Boolean(updated)
    },
    {
      onRollback: () => persistence.locks.release(lockKey),
    },
  )
}

export function completeReturnForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  returnId: Id,
): ServiceResult {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const saleReturn = persistence.saleReturns.getById(returnId)
  if (!saleReturn) {
    return fail({ code: 'RETURN_NOT_FOUND' })
  }

  const sale = persistence.sales.getById(saleReturn.saleId)
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

  const allowed = canCompleteReturnFinancial(
    persistence,
    actor.value,
    saleReturn,
  )
  if (!allowed.ok) {
    return allowed
  }

  return persistence.runInTransaction(() => {
    const completed = completeReturn(persistence, organizationId, returnId)
    if (!completed) {
      return fail({ code: 'INVALID_INPUT' })
    }

    const receipt = createInternalReturnReceipt(
      persistence,
      organizationId,
      actor.value.id,
      returnId,
    )
    if (!receipt.ok) {
      return receipt
    }

    return okVoid()
  })
}
