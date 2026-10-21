import type {
  Customer,
  Id,
  IsoDateTime,
  RentalBooking,
  RentalBookingItem,
  RentalBookingViewStatus,
  RentalReturnCondition,
  User,
} from '../types'
import {
  deriveRentalBookingViewStatus,
  isRentalReturnCondition,
} from '../types/rental-booking'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import {
  isNonNegativeQuantity,
  isPositiveQuantity,
  newId,
  nowIso,
  optionalText,
} from './primitives'
import {
  recordRentalBookingAudit,
  requireRentalIssuer,
  requireRentalManager,
  requireRentalReader,
  rentalProductLockKey,
  runWithRentalProductLocks,
} from './rental-access'
import {
  assertRentalQuantityAvailable,
  isRentalIntervalValid,
  rentalItemProductId,
  rentalItemQuantity,
} from './rental-availability'
import {
  requireRentalCustomerPhone,
  type RentalPartyLookup,
} from './rental-party'
import { rentalBookingPaidAmount } from './rental-payments'
import { requireAccessibleWarehouse } from './warehouse-access'

export type RentalBookingItemWrite = {
  productId?: Id
  quantity?: number
  /** Legacy write field. Mapped to productId + quantity 1. */
  unitId?: Id
}

export type RentalBookingWrite = {
  customerId: Id
  warehouseId: Id
  startAt: IsoDateTime
  endAt: IsoDateTime
  items: RentalBookingItemWrite[]
  subtotal?: number
  discount?: number
  total?: number
  prepayment?: number
  /** @deprecated Use `prepayment`. Still accepted so old callers/data keep working. */
  deposit?: number
  comment?: string
}

export type RentalBookingRead = RentalBooking & {
  viewStatus: RentalBookingViewStatus
  items: RentalBookingItem[]
  prepayment: number
}

export function rentalBookingPrepayment(
  booking: Pick<RentalBooking, 'deposit'>,
): number {
  return booking.deposit
}

export function rentalBookingBalance(
  booking: Pick<RentalBooking, 'total' | 'paidAmount'>,
): number {
  return Math.max(0, booking.total - booking.paidAmount)
}

function money(value: number | undefined): ServiceResult<number> {
  const amount = value ?? 0
  if (!isNonNegativeQuantity(amount)) {
    return fail({ code: 'INVALID_INPUT' })
  }
  return ok(amount)
}

function requireCustomerInOrganization(
  persistence: Persistence,
  organizationId: Id,
  customerId: Id,
): ServiceResult<Customer> {
  const customer = persistence.customers.getById(customerId)
  if (!customer) {
    return fail({ code: 'CUSTOMER_NOT_FOUND' })
  }
  if (!belongsToOrganization(customer, organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }
  return ok(customer)
}

function requireWarehouseInOrganization(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
): ServiceResult {
  const warehouse = persistence.warehouses.getById(warehouseId)
  if (!warehouse) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }
  if (!belongsToOrganization(warehouse, organizationId)) {
    return fail({ code: 'WAREHOUSE_ORGANIZATION_MISMATCH' })
  }
  return ok(undefined)
}

function bookingProductLockKeys(
  persistence: Persistence,
  booking: Pick<RentalBooking, 'id' | 'organizationId' | 'warehouseId'>,
): string[] {
  return persistence.rentalBookingItems.listByBookingId(booking.id).map((item) => {
    const productId = rentalItemProductId(persistence, item) ?? item.productId
    return rentalProductLockKey(
      booking.organizationId,
      booking.warehouseId,
      productId,
    )
  })
}

function normalizeBookingItems(
  persistence: Persistence,
  items: RentalBookingItem[],
): RentalBookingItem[] {
  const grouped = new Map<Id, RentalBookingItem>()
  for (const item of items) {
    const productId = rentalItemProductId(persistence, item)
    if (!productId) {
      grouped.set(item.id, { ...item, quantity: rentalItemQuantity(item) })
      continue
    }
    const current = grouped.get(productId)
    const quantity = rentalItemQuantity(item)
    if (!current) {
      grouped.set(productId, {
        ...item,
        productId,
        quantity,
        unitId: item.unitId,
      })
      continue
    }
    grouped.set(productId, {
      ...current,
      quantity: current.quantity + quantity,
    })
  }
  return [...grouped.values()]
}

function toBookingRead(
  persistence: Persistence,
  booking: RentalBooking,
  at: IsoDateTime,
): RentalBookingRead {
  const paidAmount = rentalBookingPaidAmount(
    persistence,
    booking.organizationId,
    booking.id,
  )
  return {
    ...booking,
    paidAmount,
    prepayment: rentalBookingPrepayment(booking),
    viewStatus: deriveRentalBookingViewStatus(booking, at),
    items: normalizeBookingItems(
      persistence,
      persistence.rentalBookingItems.listByBookingId(booking.id),
    ),
  }
}

function canAccessBookingWarehouse(
  persistence: Persistence,
  actor: User,
  warehouseId: Id,
): boolean {
  return requireAccessibleWarehouse(persistence, actor, warehouseId).ok
}

function resolveItems(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
  items: RentalBookingItemWrite[],
): ServiceResult<
  Omit<RentalBookingItem, 'id' | 'bookingId' | 'createdAt' | 'updatedAt'>[]
> {
  const quantities = new Map<Id, number>()

  for (const item of items) {
    let productId = item.productId
    if (item.unitId) {
      const unit = persistence.rentalUnits.getById(item.unitId)
      if (unit) {
        if (!belongsToOrganization(unit, organizationId)) {
          return fail({ code: 'RENTAL_UNIT_NOT_FOUND' })
        }
        if (productId && unit.productId !== productId) {
          return fail({ code: 'INVALID_INPUT' })
        }
        productId = unit.productId
      } else if (!productId) {
        return fail({ code: 'RENTAL_UNIT_NOT_FOUND' })
      }
    }

    if (!productId) {
      return fail({ code: 'INVALID_INPUT' })
    }

    const product = persistence.products.getById(productId)
    if (!product || !belongsToOrganization(product, organizationId)) {
      return fail({ code: 'PRODUCT_NOT_FOUND' })
    }

    const quantity = item.quantity ?? (item.unitId ? 1 : 0)
    if (!isPositiveQuantity(quantity) || !Number.isInteger(quantity)) {
      return fail({
        code: 'INVALID_QUANTITY',
        productId,
        warehouseId,
        requestedQuantity: quantity,
      })
    }

    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity)
  }

  return ok(
    [...quantities.entries()].map(([productId, quantity]) => ({
      organizationId,
      productId,
      quantity,
    })),
  )
}

export function createRentalBooking(
  persistence: Persistence,
  organizationId: Id,
  createdBy: Id,
  draft: RentalBookingWrite,
  lookup: RentalPartyLookup,
): ServiceResult<RentalBookingRead> {
  if (!isRentalIntervalValid(draft.startAt, draft.endAt)) {
    return fail({ code: 'RENTAL_INTERVAL_INVALID' })
  }

  if (!draft.items.length) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const customer = requireCustomerInOrganization(
    persistence,
    organizationId,
    draft.customerId,
  )
  if (!customer.ok) {
    return customer
  }

  const phone = requireRentalCustomerPhone(customer.value, lookup)
  if (!phone.ok) {
    return phone
  }

  const warehouse = requireWarehouseInOrganization(
    persistence,
    organizationId,
    draft.warehouseId,
  )
  if (!warehouse.ok) {
    return warehouse
  }

  const subtotal = money(draft.subtotal)
  if (!subtotal.ok) {
    return subtotal
  }
  const discount = money(draft.discount)
  if (!discount.ok) {
    return discount
  }
  const total = money(draft.total)
  if (!total.ok) {
    return total
  }
  const deposit = money(draft.prepayment ?? draft.deposit)
  if (!deposit.ok) {
    return deposit
  }

  const resolvedItems = resolveItems(
    persistence,
    organizationId,
    draft.warehouseId,
    draft.items,
  )
  if (!resolvedItems.ok) {
    return resolvedItems
  }

  const now = nowIso()
  const booking: RentalBooking = {
    id: newId(),
    organizationId,
    customerId: draft.customerId,
    warehouseId: draft.warehouseId,
    startAt: draft.startAt,
    endAt: draft.endAt,
    status: 'draft',
    subtotal: subtotal.value,
    discount: discount.value,
    total: total.value,
    deposit: deposit.value,
    depositHeld: 0,
    depositReturned: 0,
    paidAmount: 0,
    comment: optionalText(draft.comment),
    createdBy,
    createdAt: now,
    updatedAt: now,
  }

  persistence.rentalBookings.create(booking)
  for (const item of resolvedItems.value) {
    persistence.rentalBookingItems.create({
      id: newId(),
      bookingId: booking.id,
      createdAt: now,
      updatedAt: now,
      ...item,
    })
  }

  return ok(toBookingRead(persistence, booking, now))
}

export function createRentalBookingForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: RentalBookingWrite,
  lookup: RentalPartyLookup,
): ServiceResult<RentalBookingRead> {
  const actor = requireRentalManager(
    persistence,
    currentUser,
    organizationId,
    draft.warehouseId,
  )
  if (!actor.ok) {
    return actor
  }

  return createRentalBooking(
    persistence,
    actor.value.organizationId,
    actor.value.id,
    draft,
    lookup,
  )
}

export function getRentalBookingForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
  at: IsoDateTime = nowIso(),
): ServiceResult<RentalBookingRead> {
  const booking = persistence.rentalBookings.getById(id)
  if (!booking) {
    return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
  }

  const actor = requireRentalReader(
    persistence,
    currentUser,
    booking.organizationId,
  )
  if (!actor.ok) {
    return actor
  }

  if (!belongsToOrganization(booking, actor.value.organizationId)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  if (!canAccessBookingWarehouse(persistence, actor.value, booking.warehouseId)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return ok(toBookingRead(persistence, booking, at))
}

export function listRentalBookingsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  at: IsoDateTime = nowIso(),
): ServiceResult<RentalBookingRead[]> {
  const actor = requireRentalReader(persistence, currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.rentalBookings
      .list(actor.value.organizationId)
      .filter((booking) =>
        canAccessBookingWarehouse(persistence, actor.value, booking.warehouseId),
      )
      .map((booking) => toBookingRead(persistence, booking, at)),
  )
}

export function listRentalBookingsForCustomerForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  customerId: Id,
  at: IsoDateTime = nowIso(),
): ServiceResult<RentalBookingRead[]> {
  const listed = listRentalBookingsForUser(
    persistence,
    currentUser,
    organizationId,
    at,
  )
  if (!listed.ok) {
    return listed
  }

  const customer = requireCustomerInOrganization(
    persistence,
    organizationId,
    customerId,
  )
  if (!customer.ok) {
    return customer
  }

  return ok(
    listed.value.filter((booking) => booking.customerId === customerId),
  )
}

export function reserveRentalBookingForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  bookingId: Id,
  lookup: RentalPartyLookup,
): ServiceResult<RentalBookingRead> {
  const booking = persistence.rentalBookings.getById(bookingId)
  if (!booking) {
    return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
  }

  const actor = requireRentalManager(
    persistence,
    currentUser,
    booking.organizationId,
    booking.warehouseId,
  )
  if (!actor.ok) {
    return actor
  }

  if (booking.status !== 'draft') {
    return fail({ code: 'RENTAL_INVALID_STATUS' })
  }

  const customer = requireCustomerInOrganization(
    persistence,
    actor.value.organizationId,
    booking.customerId,
  )
  if (!customer.ok) {
    return customer
  }

  const phone = requireRentalCustomerPhone(customer.value, lookup)
  if (!phone.ok) {
    return phone
  }

  return runWithRentalProductLocks(
    persistence,
    bookingProductLockKeys(persistence, booking),
    () => {
      const items = persistence.rentalBookingItems.listByBookingId(booking.id)
      for (const item of items) {
        const productId = rentalItemProductId(persistence, item)
        if (!productId) {
          return fail({ code: 'PRODUCT_NOT_FOUND' })
        }
        const check = assertRentalQuantityAvailable(
          persistence,
          {
            organizationId: booking.organizationId,
            productId,
            warehouseId: booking.warehouseId,
            startAt: booking.startAt,
            endAt: booking.endAt,
            ignoreBookingId: booking.id,
          },
          rentalItemQuantity(item),
        )
        if (!check.ok) {
          return check
        }
      }

      const now = nowIso()
      const updated = persistence.rentalBookings.update(booking.id, {
        status: 'reserved',
        updatedAt: now,
      })
      if (!updated) {
        return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
      }

      recordRentalBookingAudit(
        persistence,
        booking.organizationId,
        actor.value.id,
        booking.id,
        'status',
        booking.status,
        'reserved',
      )

      return ok(toBookingRead(persistence, updated, now))
    },
  )
}

export function createAndReserveRentalBookingForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: RentalBookingWrite,
  lookup: RentalPartyLookup,
): ServiceResult<RentalBookingRead> {
  const actor = requireRentalManager(
    persistence,
    currentUser,
    organizationId,
    draft.warehouseId,
  )
  if (!actor.ok) {
    return actor
  }

  const resolvedItems = resolveItems(
    persistence,
    actor.value.organizationId,
    draft.warehouseId,
    draft.items,
  )
  if (!resolvedItems.ok) {
    return resolvedItems
  }

  const lockKeys = resolvedItems.value.map((item) =>
    rentalProductLockKey(
      actor.value.organizationId,
      draft.warehouseId,
      item.productId,
    ),
  )

  return runWithRentalProductLocks(persistence, lockKeys, () => {
    for (const item of resolvedItems.value) {
      const check = assertRentalQuantityAvailable(
        persistence,
        {
          organizationId: actor.value.organizationId,
          productId: item.productId,
          warehouseId: draft.warehouseId,
          startAt: draft.startAt,
          endAt: draft.endAt,
        },
        item.quantity,
      )
      if (!check.ok) {
        return check
      }
    }

    const created = createRentalBooking(
      persistence,
      actor.value.organizationId,
      actor.value.id,
      draft,
      lookup,
    )
    if (!created.ok) {
      return created
    }

    const now = nowIso()
    const updated = persistence.rentalBookings.update(created.value.id, {
      status: 'reserved',
      updatedAt: now,
    })
    if (!updated) {
      return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
    }

    recordRentalBookingAudit(
      persistence,
      actor.value.organizationId,
      actor.value.id,
      updated.id,
      'status',
      'draft',
      'reserved',
    )

    return ok(toBookingRead(persistence, updated, now))
  })
}

export function cancelRentalBookingForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  bookingId: Id,
): ServiceResult<RentalBookingRead> {
  const booking = persistence.rentalBookings.getById(bookingId)
  if (!booking) {
    return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
  }

  const actor = requireRentalManager(
    persistence,
    currentUser,
    booking.organizationId,
    booking.warehouseId,
  )
  if (!actor.ok) {
    return actor
  }

  if (booking.status !== 'draft' && booking.status !== 'reserved') {
    return fail({ code: 'RENTAL_INVALID_STATUS' })
  }

  const now = nowIso()
  const updated = persistence.rentalBookings.update(booking.id, {
    status: 'cancelled',
    updatedAt: now,
  })
  if (!updated) {
    return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
  }

  recordRentalBookingAudit(
    persistence,
    booking.organizationId,
    actor.value.id,
    booking.id,
    'status',
    booking.status,
    'cancelled',
  )

  return ok(toBookingRead(persistence, updated, now))
}

export function issueRentalBookingForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  bookingId: Id,
): ServiceResult<RentalBookingRead> {
  const booking = persistence.rentalBookings.getById(bookingId)
  if (!booking) {
    return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
  }

  const actor = requireRentalIssuer(
    persistence,
    currentUser,
    booking.organizationId,
    booking.warehouseId,
  )
  if (!actor.ok) {
    return actor
  }

  if (booking.status !== 'reserved') {
    return fail({ code: 'RENTAL_INVALID_STATUS' })
  }

  return runWithRentalProductLocks(
    persistence,
    bookingProductLockKeys(persistence, booking),
    () => {
      const now = nowIso()
      const updated = persistence.rentalBookings.update(booking.id, {
        status: 'issued',
        issuedAt: now,
        issuedBy: actor.value.id,
        updatedAt: now,
      })
      if (!updated) {
        return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
      }

      recordRentalBookingAudit(
        persistence,
        booking.organizationId,
        actor.value.id,
        booking.id,
        'status',
        'reserved',
        'issued',
      )

      return ok(toBookingRead(persistence, updated, now))
    },
  )
}

export function returnRentalBookingForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  bookingId: Id,
  condition: RentalReturnCondition,
  comment?: string,
): ServiceResult<RentalBookingRead> {
  const booking = persistence.rentalBookings.getById(bookingId)
  if (!booking) {
    return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
  }

  const actor = requireRentalIssuer(
    persistence,
    currentUser,
    booking.organizationId,
    booking.warehouseId,
  )
  if (!actor.ok) {
    return actor
  }

  if (booking.status !== 'issued') {
    return fail({ code: 'RENTAL_INVALID_STATUS' })
  }

  if (!isRentalReturnCondition(condition)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const now = nowIso()

  return runWithRentalProductLocks(
    persistence,
    bookingProductLockKeys(persistence, booking),
    () => {
      const updated = persistence.rentalBookings.update(booking.id, {
        status: 'returned',
        returnedAt: now,
        returnedBy: actor.value.id,
        returnCondition: condition,
        returnComment: optionalText(comment),
        updatedAt: now,
      })
      if (!updated) {
        return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
      }

      recordRentalBookingAudit(
        persistence,
        booking.organizationId,
        actor.value.id,
        booking.id,
        'status',
        'issued',
        'returned',
      )

      return ok(toBookingRead(persistence, updated, now))
    },
  )
}
