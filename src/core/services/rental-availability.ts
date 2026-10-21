import type { Id, IsoDateTime, RentalBooking, RentalBookingItem, User } from '../types'
import { isBlockingRentalBookingStatus } from '../types/rental-booking'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import { isPositiveQuantity } from './primitives'
import { requireRentalReader } from './rental-access'
import { requireAccessibleWarehouse } from './warehouse-access'

export type RentalAvailabilityQuery = {
  organizationId: Id
  productId: Id
  warehouseId: Id
  startAt: IsoDateTime
  endAt: IsoDateTime
  ignoreBookingId?: Id
}

export function rentalIntervalsOverlap(
  existingStartAt: IsoDateTime,
  existingEndAt: IsoDateTime,
  nextStartAt: IsoDateTime,
  nextEndAt: IsoDateTime,
): boolean {
  return existingStartAt < nextEndAt && nextStartAt < existingEndAt
}

export function isRentalIntervalValid(
  startAt: IsoDateTime,
  endAt: IsoDateTime,
): boolean {
  return Boolean(startAt && endAt && startAt < endAt)
}

export function rentalItemQuantity(item: Pick<RentalBookingItem, 'quantity'>): number {
  return isPositiveQuantity(item.quantity) ? item.quantity : 1
}

export function rentalItemProductId(
  persistence: Persistence,
  item: Pick<RentalBookingItem, 'productId' | 'unitId'>,
): Id | undefined {
  if (item.productId) {
    return item.productId
  }
  if (!item.unitId) {
    return undefined
  }
  return persistence.rentalUnits.getById(item.unitId)?.productId
}

export function rentalProductStock(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
  productId: Id,
): number {
  return (
    persistence.inventory.getByWarehouseAndProduct(
      organizationId,
      warehouseId,
      productId,
    )?.quantity ?? 0
  )
}

function bookingBlocksRentalProduct(
  booking: RentalBooking,
  organizationId: Id,
  warehouseId: Id,
  startAt: IsoDateTime,
  endAt: IsoDateTime,
  ignoreBookingId: Id | undefined,
  itemQuantityForProduct: number,
): number {
  if (ignoreBookingId && booking.id === ignoreBookingId) {
    return 0
  }

  if (booking.organizationId !== organizationId) {
    return 0
  }

  if (booking.warehouseId !== warehouseId) {
    return 0
  }

  if (!isBlockingRentalBookingStatus(booking.status)) {
    return 0
  }

  if (
    !rentalIntervalsOverlap(
      booking.startAt,
      booking.endAt,
      startAt,
      endAt,
    )
  ) {
    return 0
  }

  return itemQuantityForProduct
}

export function bookedRentalQuantity(
  persistence: Persistence,
  query: RentalAvailabilityQuery,
): number {
  return persistence.rentalBookings.list(query.organizationId).reduce((sum, booking) => {
    const qty = persistence.rentalBookingItems
      .listByBookingId(booking.id)
      .reduce((itemSum, item) => {
        const productId = rentalItemProductId(persistence, item)
        if (productId !== query.productId) {
          return itemSum
        }
        return itemSum + rentalItemQuantity(item)
      }, 0)

    return (
      sum +
      bookingBlocksRentalProduct(
        booking,
        query.organizationId,
        query.warehouseId,
        query.startAt,
        query.endAt,
        query.ignoreBookingId,
        qty,
      )
    )
  }, 0)
}

export function availableRentalQuantity(
  persistence: Persistence,
  query: RentalAvailabilityQuery,
): number {
  if (!isRentalIntervalValid(query.startAt, query.endAt)) {
    return 0
  }

  return Math.max(
    0,
    rentalProductStock(
      persistence,
      query.organizationId,
      query.warehouseId,
      query.productId,
    ) - bookedRentalQuantity(persistence, query),
  )
}

export function assertRentalQuantityAvailable(
  persistence: Persistence,
  query: RentalAvailabilityQuery,
  quantity: number,
): ServiceResult {
  if (!isRentalIntervalValid(query.startAt, query.endAt)) {
    return fail({ code: 'RENTAL_INTERVAL_INVALID' })
  }

  if (!isPositiveQuantity(quantity) || !Number.isInteger(quantity)) {
    return fail({ code: 'INVALID_QUANTITY', requestedQuantity: quantity })
  }

  const available = availableRentalQuantity(persistence, query)
  if (quantity > available) {
    return fail({
      code: 'RENTAL_QUANTITY_UNAVAILABLE',
      productId: query.productId,
      warehouseId: query.warehouseId,
      requestedQuantity: quantity,
      availableQuantity: available,
    })
  }

  return ok(undefined)
}

export function getRentalAvailabilityForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  query: RentalAvailabilityQuery,
): ServiceResult<{ stock: number; booked: number; available: number }> {
  const actor = requireRentalReader(
    persistence,
    currentUser,
    query.organizationId,
  )
  if (!actor.ok) {
    return actor
  }

  const warehouse = requireAccessibleWarehouse(
    persistence,
    actor.value,
    query.warehouseId,
  )
  if (!warehouse.ok) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  if (
    !belongsToOrganization(
      persistence.products.getById(query.productId),
      actor.value.organizationId,
    )
  ) {
    return fail({ code: 'PRODUCT_NOT_FOUND' })
  }

  if (
    !belongsToOrganization(
      persistence.warehouses.getById(query.warehouseId),
      actor.value.organizationId,
    )
  ) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }

  const scoped: RentalAvailabilityQuery = {
    ...query,
    organizationId: actor.value.organizationId,
  }

  return ok({
    stock: rentalProductStock(
      persistence,
      scoped.organizationId,
      scoped.warehouseId,
      scoped.productId,
    ),
    booked: bookedRentalQuantity(persistence, scoped),
    available: availableRentalQuantity(persistence, scoped),
  })
}
