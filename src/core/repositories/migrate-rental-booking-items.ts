import type { RentalBookingItem, RentalUnit } from '../types'

export function migrateRentalBookingItems(
  items: readonly RentalBookingItem[],
  units: readonly RentalUnit[],
): RentalBookingItem[] {
  const unitsById = new Map(units.map((unit) => [unit.id, unit]))

  return items.map((item) => {
    const unit = item.unitId ? unitsById.get(item.unitId) : undefined
    const productId = item.productId || unit?.productId || item.productId
    const quantity =
      typeof item.quantity === 'number' &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0
        ? item.quantity
        : 1

    return {
      ...item,
      productId,
      quantity,
    }
  })
}
