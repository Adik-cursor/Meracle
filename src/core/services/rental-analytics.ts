import type { Id, IsoDateTime, User } from '../types'
import { ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { hasEffectiveFinancialPermission } from './access'
import type { AnalyticsRange } from './financial-analytics'
import { analyticsStampInRange } from './financial-analytics'
import { nowIso } from './primitives'
import type { RentalBookingRead } from './rental-bookings'
import { listRentalBookingsForUser, rentalBookingBalance, rentalBookingPrepayment } from './rental-bookings'
import {
  availableRentalQuantity,
  bookedRentalQuantity,
  rentalItemQuantity,
  rentalProductStock,
} from './rental-availability'
import { sumCompletedPayments } from '../../modules/sales/sale-payment'

export type RentalAnalyticsQuery = {
  at?: IsoDateTime
  range?: AnalyticsRange
  branchId?: Id
  warehouseId?: Id
  userId?: Id
}

export type RentalAnalyticsTotals = {
  bookings: number
  issued: number
  returned: number
  active: number
  overdue: number
  rentalTotal: number
  prepayment: number
  paidAmount: number
  dueAmount: number
  rentedQuantity: number
  paymentsIncluded: boolean
}

export type RentalReportRow = {
  bookingId: Id
  customerId: Id
  startAt: IsoDateTime
  endAt: IsoDateTime
  productIds: Id[]
  quantity: number
  total: number
  prepayment: number
  paidAmount: number
  dueAmount: number
  status: RentalBookingRead['status']
  viewStatus: RentalBookingRead['viewStatus']
  issuedAt?: IsoDateTime
  issuedBy?: Id
  returnedAt?: IsoDateTime
  returnedBy?: Id
  returnCondition?: RentalBookingRead['returnCondition']
}

export type RentalAnalyticsGroupRow = {
  key: string
  count: number
  quantity: number
  stock: number
  booked: number
  available: number
  total: number
  paidAmount: number
  dueAmount: number
}

export type RentalAnalytics = {
  totals: RentalAnalyticsTotals
  rows: RentalReportRow[]
  byCustomer: RentalAnalyticsGroupRow[]
  byProduct: RentalAnalyticsGroupRow[]
  returns: RentalReportRow[]
  overdue: RentalReportRow[]
  payments: RentalReportRow[]
}

function emptyGroup(key: string): RentalAnalyticsGroupRow {
  return {
    key,
    count: 0,
    quantity: 0,
    stock: 0,
    booked: 0,
    available: 0,
    total: 0,
    paidAmount: 0,
    dueAmount: 0,
  }
}

function mergeGroups(rows: RentalAnalyticsGroupRow[]): RentalAnalyticsGroupRow[] {
  const map = new Map<string, RentalAnalyticsGroupRow>()
  for (const row of rows) {
    const current = map.get(row.key) ?? emptyGroup(row.key)
    current.count += row.count
    current.quantity += row.quantity
    current.stock = Math.max(current.stock, row.stock)
    current.booked = Math.max(current.booked, row.booked)
    current.available = row.available
    current.total += row.total
    current.paidAmount += row.paidAmount
    current.dueAmount += row.dueAmount
    map.set(row.key, current)
  }
  return [...map.values()]
}

function parseRentalAnalyticsQuery(
  atOrQuery?: IsoDateTime | RentalAnalyticsQuery,
): RentalAnalyticsQuery {
  if (!atOrQuery) {
    return {}
  }

  if (typeof atOrQuery === 'string') {
    return { at: atOrQuery }
  }

  return atOrQuery
}

function matchesScope(
  persistence: Persistence,
  booking: RentalBookingRead,
  query: RentalAnalyticsQuery,
): boolean {
  if (query.warehouseId && booking.warehouseId !== query.warehouseId) {
    return false
  }

  if (query.userId && booking.createdBy !== query.userId) {
    return false
  }

  if (query.branchId) {
    const warehouse = persistence.warehouses.getById(booking.warehouseId)
    if (!warehouse || warehouse.branchId !== query.branchId) {
      return false
    }
  }

  return true
}

function periodPaidAmount(
  persistence: Persistence,
  actor: User,
  organizationId: Id,
  bookingIds: Set<Id>,
  range: AnalyticsRange,
): { paidAmount: number; paymentsIncluded: boolean } {
  if (!hasEffectiveFinancialPermission(actor, 'payments.read')) {
    return { paidAmount: 0, paymentsIncluded: false }
  }

  return {
    paidAmount: sumCompletedPayments(
      persistence.payments
        .list(organizationId)
        .filter(
          (payment) =>
            Boolean(payment.rentalBookingId) &&
            bookingIds.has(payment.rentalBookingId as Id) &&
            analyticsStampInRange(payment.createdAt, range),
        ),
    ),
    paymentsIncluded: true,
  }
}

export function getRentalAnalyticsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  atOrQuery: IsoDateTime | RentalAnalyticsQuery = nowIso(),
): ServiceResult<RentalAnalytics> {
  const query = parseRentalAnalyticsQuery(atOrQuery)
  const at = query.at ?? nowIso()
  const listed = listRentalBookingsForUser(
    persistence,
    currentUser,
    organizationId,
    at,
  )
  if (!listed.ok) {
    return listed
  }

  const scoped = listed.value.filter((booking) =>
    matchesScope(persistence, booking, query),
  )
  const periodBookings = query.range
    ? scoped.filter((booking) => analyticsStampInRange(booking.createdAt, query.range as AnalyticsRange))
    : scoped

  const rows: RentalReportRow[] = periodBookings.map((booking) => ({
    bookingId: booking.id,
    customerId: booking.customerId,
    startAt: booking.startAt,
    endAt: booking.endAt,
    productIds: [...new Set(booking.items.map((item) => item.productId))],
    quantity: booking.items.reduce((sum, item) => sum + rentalItemQuantity(item), 0),
    total: booking.total,
    prepayment: rentalBookingPrepayment(booking),
    paidAmount: booking.paidAmount,
    dueAmount: rentalBookingBalance(booking),
    status: booking.status,
    viewStatus: booking.viewStatus,
    issuedAt: booking.issuedAt,
    issuedBy: booking.issuedBy,
    returnedAt: booking.returnedAt,
    returnedBy: booking.returnedBy,
    returnCondition: booking.returnCondition,
  }))

  const productGroups = periodBookings.flatMap((booking) =>
    booking.items.map((item) => {
      const availabilityQuery = {
        organizationId: booking.organizationId,
        productId: item.productId,
        warehouseId: booking.warehouseId,
        startAt: at,
        endAt: at < booking.endAt ? booking.endAt : new Date(new Date(at).getTime() + 1000).toISOString(),
      }
      const quantity = rentalItemQuantity(item)
      return {
        key: item.productId,
        count: 1,
        quantity,
        stock: rentalProductStock(
          persistence,
          booking.organizationId,
          booking.warehouseId,
          item.productId,
        ),
        booked: bookedRentalQuantity(persistence, {
          ...availabilityQuery,
          startAt: at,
          endAt: new Date(new Date(at).getTime() + 1).toISOString(),
        }),
        available: availableRentalQuantity(persistence, {
          ...availabilityQuery,
          startAt: at,
          endAt: new Date(new Date(at).getTime() + 1).toISOString(),
        }),
        total: booking.total,
        paidAmount: booking.paidAmount,
        dueAmount: rentalBookingBalance(booking),
      }
    }),
  )

  const bookingPaidAmount = rows.reduce((sum, row) => sum + row.paidAmount, 0)
  const payments =
    query.range && currentUser
      ? periodPaidAmount(
          persistence,
          currentUser,
          organizationId,
          new Set(scoped.map((booking) => booking.id)),
          query.range,
        )
      : { paidAmount: bookingPaidAmount, paymentsIncluded: true }
  const periodPrepayment = rows
    .filter((row) => row.status !== 'draft')
    .reduce((sum, row) => sum + row.prepayment, 0)

  const totals: RentalAnalyticsTotals = {
    bookings: rows.filter((row) => row.status !== 'cancelled').length,
    issued: rows.filter((row) => row.status === 'issued').length,
    returned: rows.filter((row) => row.status === 'returned').length,
    active: rows.filter((row) => row.viewStatus === 'active').length,
    overdue: rows.filter((row) => row.viewStatus === 'overdue').length,
    rentalTotal: rows
      .filter((row) => row.status !== 'cancelled' && row.status !== 'draft')
      .reduce((sum, row) => sum + row.total, 0),
    paidAmount: payments.paymentsIncluded
      ? payments.paidAmount + (query.range ? periodPrepayment : 0)
      : 0,
    dueAmount: rows
      .filter((row) => row.status !== 'cancelled')
      .reduce((sum, row) => sum + row.dueAmount, 0),
    prepayment: rows
      .filter((row) => row.status !== 'draft')
      .reduce((sum, row) => sum + row.prepayment, 0),
    rentedQuantity: rows
      .filter((row) => row.status !== 'cancelled' && row.status !== 'draft')
      .reduce((sum, row) => sum + row.quantity, 0),
    paymentsIncluded: payments.paymentsIncluded,
  }

  return ok({
    totals,
    rows,
    byCustomer: mergeGroups(
      rows.map((row) => ({
        key: row.customerId,
        count: 1,
        quantity: row.quantity,
        stock: 0,
        booked: 0,
        available: 0,
        total: row.total,
        paidAmount: row.paidAmount,
        dueAmount: row.dueAmount,
      })),
    ),
    byProduct: mergeGroups(productGroups),
    returns: rows.filter((row) => row.status === 'returned'),
    overdue: rows.filter((row) => row.viewStatus === 'overdue'),
    payments: rows.filter((row) => row.status !== 'cancelled'),
  })
}
