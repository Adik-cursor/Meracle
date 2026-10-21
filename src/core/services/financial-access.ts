import type {
  FinancialPermission,
  Payment,
  PaymentRefund,
  RentalBooking,
  Sale,
  SaleFinancialView,
  SaleReturn,
  User,
  Warehouse,
  PaymentFinancialView,
  RefundFinancialView,
} from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import { getAccessScope } from '../types/access-scope'
import type { Persistence } from '../repositories/persistence'
import { requireCurrentUser, hasEffectiveFinancialPermission, getEffectiveFinancialPermissions } from './access'
import { canAccessWarehouse } from './warehouse-access'

function requireSameOrganization(
  actor: User,
  organizationId: Sale['organizationId'],
): ServiceResult<User> {
  if (actor.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(actor)
}

function requireFinancialPermission(
  actor: User,
  permission: FinancialPermission,
): ServiceResult<User> {
  if (!hasEffectiveFinancialPermission(actor, permission)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return ok(actor)
}

function requireFinancialAccess(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Sale['organizationId'],
  warehouseId: Sale['warehouseId'] | undefined,
  permission: FinancialPermission,
): ServiceResult<User> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const sameOrg = requireSameOrganization(actor.value, organizationId)
  if (!sameOrg.ok) {
    return sameOrg
  }

  if (!warehouseId) {
    return requireFinancialPermission(actor.value, permission)
  }

  const warehouse = persistence.warehouses.getById(warehouseId)
  if (!warehouse) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }

  if (warehouse.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  const warehouseAccess = canAccessWarehouse(actor.value, warehouse)
  if (!warehouseAccess.ok) {
    return warehouseAccess
  }

  return requireFinancialPermission(actor.value, permission)
}

export function requireWarehouseLessSaleScope(
  persistence: Persistence,
  actor: User,
  sale: Sale,
): ServiceResult<User> {
  const scope = getAccessScope(actor.role)
  if (scope === 'organization') {
    return ok(actor)
  }

  const cashierId = persistence.payments
    .listBySaleId(sale.organizationId, sale.id)
    .find((payment) => payment.status === 'completed')?.createdBy
  const cashier = cashierId
    ? persistence.users.getById(cashierId)
    : undefined

  if (!cashier || cashier.organizationId !== actor.organizationId) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  if (scope === 'own') {
    if (cashier.id === actor.id) {
      return ok(actor)
    }

    return cashier.branchId &&
      actor.branchId &&
      cashier.branchId === actor.branchId
      ? ok(actor)
      : fail({ code: 'ACCESS_DENIED' })
  }

  if (scope === 'department') {
    return cashier.departmentId && cashier.departmentId === actor.departmentId
      ? ok(actor)
      : fail({ code: 'ACCESS_DENIED' })
  }

  if (scope === 'branch') {
    return cashier.branchId && cashier.branchId === actor.branchId
      ? ok(actor)
      : fail({ code: 'ACCESS_DENIED' })
  }

  if (scope === 'warehouse') {
    return cashier.warehouseId && cashier.warehouseId === actor.warehouseId
      ? ok(actor)
      : fail({ code: 'ACCESS_DENIED' })
  }

  return fail({ code: 'ACCESS_DENIED' })
}

function requireSaleAccess(
  persistence: Persistence,
  currentUser: User | null | undefined,
  sale: Sale,
  permission: FinancialPermission,
): ServiceResult<User> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const sameOrg = requireSameOrganization(actor.value, sale.organizationId)
  if (!sameOrg.ok) {
    return sameOrg
  }

  const permitted = requireFinancialPermission(actor.value, permission)
  if (!permitted.ok) {
    return permitted
  }

  if (!sale.warehouseId) {
    return requireWarehouseLessSaleScope(persistence, actor.value, sale)
  }

  const warehouse = persistence.warehouses.getById(sale.warehouseId)
  if (!warehouse) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }

  if (warehouse.organizationId !== sale.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  const isSaleRead =
    permission === 'sales.read' || permission === 'sales.read_amount'

  if (isSaleRead && actor.value.role === 'sales_employee') {
    if (!actor.value.branchId || warehouse.branchId !== actor.value.branchId) {
      return fail({ code: 'ACCESS_DENIED' })
    }

    return ok(actor.value)
  }

  return requireFinancialAccess(
    persistence,
    currentUser,
    sale.organizationId,
    sale.warehouseId,
    permission,
  )
}

function requireWarehouseDocumentAccess(
  persistence: Persistence,
  currentUser: User | null | undefined,
  warehouse: Warehouse,
  permission: FinancialPermission,
): ServiceResult<User> {
  return requireFinancialAccess(
    persistence,
    currentUser,
    warehouse.organizationId,
    warehouse.id,
    permission,
  )
}

function requirePaymentSale(
  persistence: Persistence,
  payment: Payment,
): ServiceResult<Sale> {
  if (!payment.saleId) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  const sale = persistence.sales.getById(payment.saleId)
  if (!sale) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (sale.organizationId !== payment.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(sale)
}

function requireReturnSale(
  persistence: Persistence,
  saleReturn: SaleReturn,
): ServiceResult<Sale> {
  const sale = persistence.sales.getById(saleReturn.saleId)
  if (!sale) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (sale.organizationId !== saleReturn.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(sale)
}

function requireRefundPayment(
  persistence: Persistence,
  refund: PaymentRefund,
): ServiceResult<Payment> {
  const payment = persistence.payments.getById(refund.paymentId)
  if (!payment) {
    return fail({ code: 'PAYMENT_NOT_FOUND' })
  }

  if (payment.organizationId !== refund.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(payment)
}

function sumCompletedPayments(
  persistence: Persistence,
  organizationId: Sale['organizationId'],
  saleId: Sale['id'],
): number {
  return persistence.payments
    .listBySaleId(organizationId, saleId)
    .filter((payment) => payment.status === 'completed')
    .reduce((sum, payment) => sum + payment.amount, 0)
}

export function canReadSale(
  persistence: Persistence,
  currentUser: User | null | undefined,
  sale: Sale,
): ServiceResult<User> {
  return requireSaleAccess(persistence, currentUser, sale, 'sales.read')
}

export function canReadSaleAmount(
  persistence: Persistence,
  currentUser: User | null | undefined,
  sale: Sale,
): ServiceResult<User> {
  return requireSaleAccess(persistence, currentUser, sale, 'sales.read_amount')
}

export function canCreateSale(
  persistence: Persistence,
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  return requireWarehouseDocumentAccess(
    persistence,
    currentUser,
    warehouse,
    'sales.create',
  )
}

export function canCreateSaleInOrganization(
  currentUser: User | null | undefined,
  organizationId: Sale['organizationId'],
): ServiceResult<User> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const sameOrg = requireSameOrganization(actor.value, organizationId)
  if (!sameOrg.ok) {
    return sameOrg
  }

  return requireFinancialPermission(actor.value, 'sales.create')
}

export function canUpdateSale(
  persistence: Persistence,
  currentUser: User | null | undefined,
  sale: Sale,
): ServiceResult<User> {
  return requireSaleAccess(persistence, currentUser, sale, 'sales.update')
}

export function canConfirmSale(
  persistence: Persistence,
  currentUser: User | null | undefined,
  sale: Sale,
): ServiceResult<User> {
  return requireSaleAccess(persistence, currentUser, sale, 'sales.confirm')
}

export function canCompleteSale(
  persistence: Persistence,
  currentUser: User | null | undefined,
  sale: Sale,
): ServiceResult<User> {
  return requireSaleAccess(persistence, currentUser, sale, 'sales.complete')
}

function requirePaymentRentalBooking(
  persistence: Persistence,
  payment: Payment,
): ServiceResult<RentalBooking> {
  if (!payment.rentalBookingId) {
    return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
  }

  const booking = persistence.rentalBookings.getById(payment.rentalBookingId)
  if (!booking) {
    return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
  }

  if (booking.organizationId !== payment.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(booking)
}

function requireRentalBookingPaymentAccess(
  persistence: Persistence,
  currentUser: User | null | undefined,
  payment: Payment,
  permission: FinancialPermission,
): ServiceResult<User> {
  const booking = requirePaymentRentalBooking(persistence, payment)
  if (!booking.ok) {
    return booking
  }

  return requireFinancialAccess(
    persistence,
    currentUser,
    booking.value.organizationId,
    booking.value.warehouseId,
    permission,
  )
}
export function canReadPayment(
  persistence: Persistence,
  currentUser: User | null | undefined,
  payment: Payment,
): ServiceResult<User> {
  if (payment.rentalBookingId) {
    return requireRentalBookingPaymentAccess(
      persistence,
      currentUser,
      payment,
      'payments.read',
    )
  }

  if (payment.careChargeId && !payment.saleId) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  const sale = requirePaymentSale(persistence, payment)
  if (!sale.ok) {
    return sale
  }

  return requireSaleAccess(
    persistence,
    currentUser,
    sale.value,
    'payments.read',
  )
}

export function canCreatePayment(
  persistence: Persistence,
  currentUser: User | null | undefined,
  sale: Sale,
): ServiceResult<User> {
  return requireSaleAccess(persistence, currentUser, sale, 'payments.create')
}

export function canCancelPayment(
  persistence: Persistence,
  currentUser: User | null | undefined,
  payment: Payment,
): ServiceResult<User> {
  if (payment.rentalBookingId) {
    return requireRentalBookingPaymentAccess(
      persistence,
      currentUser,
      payment,
      'payments.cancel',
    )
  }

  if (payment.careChargeId && !payment.saleId) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  const sale = requirePaymentSale(persistence, payment)
  if (!sale.ok) {
    return sale
  }

  return requireSaleAccess(
    persistence,
    currentUser,
    sale.value,
    'payments.cancel',
  )
}

export function canReadReturn(
  persistence: Persistence,
  currentUser: User | null | undefined,
  saleReturn: SaleReturn,
): ServiceResult<User> {
  const sale = requireReturnSale(persistence, saleReturn)
  if (!sale.ok) {
    return sale
  }

  return requireSaleAccess(persistence, currentUser, sale.value, 'returns.read')
}

export function canCreateReturn(
  persistence: Persistence,
  currentUser: User | null | undefined,
  sale: Sale,
): ServiceResult<User> {
  return requireSaleAccess(persistence, currentUser, sale, 'returns.create')
}

export function canCompleteReturn(
  persistence: Persistence,
  currentUser: User | null | undefined,
  saleReturn: SaleReturn,
): ServiceResult<User> {
  const sale = requireReturnSale(persistence, saleReturn)
  if (!sale.ok) {
    return sale
  }

  return requireSaleAccess(
    persistence,
    currentUser,
    sale.value,
    'returns.complete',
  )
}

export function canReadRefund(
  persistence: Persistence,
  currentUser: User | null | undefined,
  refund: PaymentRefund,
): ServiceResult<User> {
  const payment = requireRefundPayment(persistence, refund)
  if (!payment.ok) {
    return payment
  }

  const sale = requirePaymentSale(persistence, payment.value)
  if (!sale.ok) {
    return sale
  }

  return requireSaleAccess(persistence, currentUser, sale.value, 'refunds.read')
}

export function canCreateRefund(
  persistence: Persistence,
  currentUser: User | null | undefined,
  payment: Payment,
): ServiceResult<User> {
  const sale = requirePaymentSale(persistence, payment)
  if (!sale.ok) {
    return sale
  }

  return requireSaleAccess(
    persistence,
    currentUser,
    sale.value,
    'refunds.create',
  )
}

export function canCancelRefund(
  persistence: Persistence,
  currentUser: User | null | undefined,
  refund: PaymentRefund,
): ServiceResult<User> {
  const payment = requireRefundPayment(persistence, refund)
  if (!payment.ok) {
    return payment
  }

  const sale = requirePaymentSale(persistence, payment.value)
  if (!sale.ok) {
    return sale
  }

  return requireSaleAccess(
    persistence,
    currentUser,
    sale.value,
    'refunds.cancel',
  )
}

export function canReadFinancialAnalytics(
  persistence: Persistence,
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  return requireWarehouseDocumentAccess(
    persistence,
    currentUser,
    warehouse,
    'financial_analytics.read',
  )
}

export function listFinancialPermissionsForUser(
  currentUser: User | null | undefined,
): ServiceResult<readonly FinancialPermission[]> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  return ok(getEffectiveFinancialPermissions(actor.value))
}

export function buildSaleFinancialView(input: {
  sale: Sale
  canRead: boolean
  canReadAmount: boolean
  paidAmount: number
  outstandingAmount: number
}): SaleFinancialView {
  const view: SaleFinancialView = {
    id: input.sale.id,
    saleId: input.sale.id,
    canRead: input.canRead,
    canReadAmount: input.canReadAmount,
  }

  if (!input.canRead || !input.canReadAmount) {
    return view
  }

  return {
    ...view,
    subtotal: input.sale.subtotal,
    discount: input.sale.discount,
    total: input.sale.total,
    paidAmount: input.paidAmount,
    outstandingAmount: input.outstandingAmount,
  }
}

export function toSaleFinancialView(
  persistence: Persistence,
  currentUser: User | null | undefined,
  sale: Sale,
): ServiceResult<SaleFinancialView> {
  const readable = canReadSale(persistence, currentUser, sale)
  if (!readable.ok) {
    return readable
  }

  const canReadAmount = canReadSaleAmount(persistence, currentUser, sale).ok
  const paidAmount = sumCompletedPayments(
    persistence,
    sale.organizationId,
    sale.id,
  )

  return ok(
    buildSaleFinancialView({
      sale,
      canRead: true,
      canReadAmount,
      paidAmount,
      outstandingAmount: Math.max(0, sale.total - paidAmount),
    }),
  )
}

export function toPaymentFinancialView(
  persistence: Persistence,
  currentUser: User | null | undefined,
  payment: Payment,
): ServiceResult<PaymentFinancialView> {
  const allowed = canReadPayment(persistence, currentUser, payment)
  if (!allowed.ok) {
    return allowed
  }

  const view: PaymentFinancialView = {
    id: payment.id,
    paymentId: payment.id,
    saleId: payment.saleId,
    rentalBookingId: payment.rentalBookingId,
    method: payment.method,
    amount: payment.amount,
    status: payment.status,
    createdAt: payment.createdAt,
  }

  return ok(view)
}

export function toRefundFinancialView(
  persistence: Persistence,
  currentUser: User | null | undefined,
  refund: PaymentRefund,
): ServiceResult<RefundFinancialView> {
  const allowed = canReadRefund(persistence, currentUser, refund)
  if (!allowed.ok) {
    return allowed
  }

  const view: RefundFinancialView = {
    id: refund.id,
    refundId: refund.id,
    paymentId: refund.paymentId,
    returnId: refund.returnId,
    amount: refund.amount,
    status: refund.status,
    createdAt: refund.createdAt,
  }

  return ok(view)
}
