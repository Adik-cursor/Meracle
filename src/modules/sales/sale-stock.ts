import type { Id, InventoryItem, ProductNotAvailableError, SaleStockCheckResult } from '../../core/types'

export function getAvailableQuantity(item: InventoryItem | undefined): number {
  if (!item) {
    return 0
  }

  return Math.max(0, item.quantity - Number(item.reservedQuantity))
}

export function calcLineTotal(
  quantity: number,
  unitPrice: number,
  discount: number,
): number {
  return Math.max(0, quantity * unitPrice - discount)
}

export function calcSaleTotals(
  lineTotals: number[],
  saleDiscount: number,
): { subtotal: number; total: number } {
  const subtotal = lineTotals.reduce((sum, value) => sum + value, 0)
  return {
    subtotal,
    total: Math.max(0, subtotal - saleDiscount),
  }
}

export function aggregateItemQuantities(
  items: { productId: Id; quantity: number }[],
): { productId: Id; quantity: number }[] {
  const quantities = new Map<Id, number>()

  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity)
  }

  return [...quantities.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }))
}

export function checkSaleStock(
  warehouseId: Id,
  items: { productId: Id; quantity: number }[],
  getStock: (warehouseId: Id, productId: Id) => InventoryItem | undefined,
): SaleStockCheckResult {
  for (const item of aggregateItemQuantities(items)) {
    const availableQuantity = getAvailableQuantity(
      getStock(warehouseId, item.productId),
    )

    if (availableQuantity < item.quantity) {
      const error: ProductNotAvailableError = {
        code: 'PRODUCT_NOT_AVAILABLE',
        warehouseId,
        productId: item.productId,
        requestedQuantity: item.quantity,
        availableQuantity,
      }

      return { ok: false, error }
    }
  }

  return { ok: true }
}
