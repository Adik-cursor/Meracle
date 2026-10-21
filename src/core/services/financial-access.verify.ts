import type {
  Id,
  Payment,
  PaymentRefund,
  Sale,
  SaleReturn,
  User,
  UserRole,
  Warehouse,
} from '../types'
import type { DomainErrorCode } from '../types/domain-error'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { newId, nowIso } from './primitives'
import { seedEnabledBusinessModules } from './organization-modules'
import {
  buildSaleFinancialView,
  canCancelPayment,
  canCancelRefund,
  canCompleteReturn,
  canCompleteSale,
  canConfirmSale,
  canCreatePayment,
  canCreateRefund,
  canCreateReturn,
  canCreateSale,
  canReadFinancialAnalytics,
  canReadPayment,
  canReadRefund,
  canReadReturn,
  canReadSale,
  canReadSaleAmount,
  canUpdateSale,
  toPaymentFinancialView,
  toRefundFinancialView,
  toSaleFinancialView,
} from './financial-access'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function denied(
  result: { ok: boolean; error?: { code: DomainErrorCode } },
  code: DomainErrorCode,
  message: string,
): void {
  assert(!result.ok && result.error?.code === code, message)
}

function addUser(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
  branchId?: Id,
  warehouseId?: Id,
): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}@${organizationId}.local`,
    firstName: role,
    lastName: organizationId,
    role,
    status: 'active',
    branchId,
    warehouseId,
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(user)
  return user
}

function addWarehouse(
  persistence: Persistence,
  organizationId: Id,
  branchId: Id,
  name: string,
): Warehouse {
  const now = nowIso()
  const warehouse: Warehouse = {
    id: newId(),
    organizationId,
    branchId,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.warehouses.create(warehouse)
  return warehouse
}

function addSale(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
  total = 100,
): Sale {
  const now = nowIso()
  const sale: Sale = {
    id: newId(),
    organizationId,
    warehouseId,
    status: 'completed',
    currency: 'KZT',
    subtotal: total,
    discount: 0,
    total,
    createdAt: now,
    updatedAt: now,
  }
  persistence.sales.create(sale)
  return sale
}

function addPayment(
  persistence: Persistence,
  sale: Sale,
  amount: number,
): Payment {
  const payment: Payment = {
    id: newId(),
    organizationId: sale.organizationId,
    saleId: sale.id,
    amount,
    currency: sale.currency,
    method: 'cash',
    status: 'completed',
    createdAt: nowIso(),
    createdBy: sale.id,
  }
  persistence.payments.create(payment)
  return payment
}

function addReturn(persistence: Persistence, sale: Sale): SaleReturn {
  const now = nowIso()
  const saleReturn: SaleReturn = {
    id: newId(),
    organizationId: sale.organizationId,
    saleId: sale.id,
    warehouseId: sale.warehouseId ?? '',
    status: 'draft',
    total: sale.total,
    createdAt: now,
    updatedAt: now,
  }
  persistence.saleReturns.create(saleReturn)
  return saleReturn
}

function addRefund(
  persistence: Persistence,
  payment: Payment,
  saleReturn?: SaleReturn,
): PaymentRefund {
  const refund: PaymentRefund = {
    id: newId(),
    organizationId: payment.organizationId,
    paymentId: payment.id,
    saleId: payment.saleId ?? '',
    returnId: saleReturn?.id,
    amount: payment.amount,
    currency: payment.currency,
    status: 'completed',
    createdAt: nowIso(),
    createdBy: payment.createdBy,
  }
  persistence.paymentRefunds.create(refund)
  return refund
}

function seedWorld() {
  const persistence = createInMemoryPersistence()
  const now = nowIso()
  const orgA = 'org-a'
  const orgB = 'org-b'
  seedEnabledBusinessModules(persistence, orgA, 'seed')
  seedEnabledBusinessModules(persistence, orgB, 'seed')
  const branchA = newId()
  const branchB = newId()
  const branchXB = newId()

  persistence.branches.create({
    id: branchA,
    organizationId: orgA,
    name: 'Branch A',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  persistence.branches.create({
    id: branchB,
    organizationId: orgA,
    name: 'Branch B',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  persistence.branches.create({
    id: branchXB,
    organizationId: orgB,
    name: 'Branch XB',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })

  const a1 = addWarehouse(persistence, orgA, branchA, 'A1')
  const b1 = addWarehouse(persistence, orgA, branchB, 'B1')
  const xb1 = addWarehouse(persistence, orgB, branchXB, 'XB1')

  const saleA1 = addSale(persistence, orgA, a1.id, 100)
  const saleB1 = addSale(persistence, orgA, b1.id, 80)
  const saleXB1 = addSale(persistence, orgB, xb1.id, 50)

  const paymentA1 = addPayment(persistence, saleA1, 40)
  const paymentB1 = addPayment(persistence, saleB1, 20)
  const paymentXB1 = addPayment(persistence, saleXB1, 10)

  const returnA1 = addReturn(persistence, saleA1)
  const returnB1 = addReturn(persistence, saleB1)

  const refundA1 = addRefund(persistence, paymentA1, returnA1)
  const refundB1 = addRefund(persistence, paymentB1)

  const employee = addUser(persistence, orgA, 'sales_employee', branchA, a1.id)
  const manager = addUser(persistence, orgA, 'sales_manager', branchA, a1.id)
  const director = addUser(persistence, orgA, 'branch_director', branchA, a1.id)
  const commercial = addUser(persistence, orgA, 'commercial_director', undefined, a1.id)
  const owner = addUser(persistence, orgA, 'owner', undefined, a1.id)
  const foreignOwner = addUser(persistence, orgB, 'owner')

  return {
    persistence,
    a1,
    b1,
    xb1,
    saleA1,
    saleB1,
    saleXB1,
    paymentA1,
    paymentB1,
    paymentXB1,
    returnA1,
    returnB1,
    refundA1,
    refundB1,
    employee,
    manager,
    director,
    commercial,
    owner,
    foreignOwner,
  }
}

export function runFinancialAccessChecks(): void {
  const world = seedWorld()
  const {
    persistence,
    a1,
    b1,
    xb1,
    saleA1,
    saleB1,
    saleXB1,
    paymentA1,
    paymentB1,
    paymentXB1,
    returnA1,
    returnB1,
    refundA1,
    refundB1,
    employee,
    manager,
    director,
    commercial,
    owner,
    foreignOwner,
  } = world

  {
    assert(canReadSale(persistence, employee, saleA1).ok, '1 employee sales.read A1')
    assert(
      canReadSaleAmount(persistence, employee, saleA1).ok,
      '1 employee sales.read_amount A1',
    )
    assert(canCreateSale(persistence, employee, a1).ok, '1 employee sales.create A1')
    assert(canUpdateSale(persistence, employee, saleA1).ok, '1 employee sales.update')
    assert(canConfirmSale(persistence, employee, saleA1).ok, '1 employee sales.confirm')
    assert(
      canCompleteSale(persistence, employee, saleA1).ok,
      '1 employee sales.complete',
    )
  }

  {
    assert(
      canReadPayment(persistence, employee, paymentA1).ok,
      '2 employee payments.read A1',
    )
    assert(
      canCreatePayment(persistence, employee, saleA1).ok,
      '2 employee payments.create A1',
    )
    denied(
      canCancelPayment(persistence, employee, paymentA1),
      'ACCESS_DENIED',
      '2 employee payments.cancel',
    )
    assert(
      toPaymentFinancialView(persistence, employee, paymentA1).ok,
      '2 employee payment projection',
    )
  }

  {
    assert(
      canReadReturn(persistence, employee, returnA1).ok,
      '3 employee returns.read',
    )
    denied(
      canCreateReturn(persistence, employee, saleA1),
      'ACCESS_DENIED',
      '3 employee returns.create',
    )
    denied(
      canCompleteReturn(persistence, employee, returnA1),
      'ACCESS_DENIED',
      '3 employee returns.complete',
    )
  }

  {
    denied(
      canReadRefund(persistence, employee, refundA1),
      'ACCESS_DENIED',
      '4 employee refunds.read',
    )
    denied(
      canCreateRefund(persistence, employee, paymentA1),
      'ACCESS_DENIED',
      '4 employee refunds.create',
    )
    denied(
      toRefundFinancialView(persistence, employee, refundA1),
      'ACCESS_DENIED',
      '4 employee refund projection',
    )
  }

  {
    assert(canCreateReturn(persistence, manager, saleA1).ok, '5 manager returns.create')
    assert(
      canCompleteReturn(persistence, manager, returnA1).ok,
      '5 manager returns.complete',
    )
  }

  {
    assert(canReadRefund(persistence, manager, refundA1).ok, '6 manager refunds.read')
    assert(
      toRefundFinancialView(persistence, manager, refundA1).ok,
      '6 manager refund projection',
    )
  }

  {
    denied(
      canCreateRefund(persistence, manager, paymentA1),
      'ACCESS_DENIED',
      '7 manager refunds.create',
    )
    denied(
      canCancelRefund(persistence, manager, refundA1),
      'ACCESS_DENIED',
      '7 manager refunds.cancel',
    )
  }

  {
    assert(
      canCancelPayment(persistence, director, paymentA1).ok,
      '8 director payments.cancel A1',
    )
    denied(
      canCancelPayment(persistence, director, paymentB1),
      'WAREHOUSE_BRANCH_MISMATCH',
      '8 director payments.cancel B1 warehouse',
    )
  }

  {
    assert(
      canCreateRefund(persistence, director, paymentA1).ok,
      '9 director refunds.create',
    )
    assert(
      canCancelRefund(persistence, director, refundA1).ok,
      '9 director refunds.cancel',
    )
  }

  {
    assert(canReadSale(persistence, commercial, saleA1).ok, '10 commercial sale A1')
    assert(canReadSale(persistence, commercial, saleB1).ok, '10 commercial sale B1')
    assert(
      canCancelPayment(persistence, commercial, paymentB1).ok,
      '10 commercial payment cancel B1',
    )
    assert(
      canCreateRefund(persistence, commercial, paymentB1).ok,
      '10 commercial refund create B1',
    )
    assert(
      canReadFinancialAnalytics(persistence, commercial, b1).ok,
      '10 commercial analytics B1',
    )
    assert(
      canReadReturn(persistence, commercial, returnB1).ok,
      '10 commercial return B1',
    )
    assert(
      canReadRefund(persistence, commercial, refundB1).ok,
      '10 commercial refund B1',
    )
  }

  {
    assert(canReadSale(persistence, owner, saleA1).ok, '11 owner sale A1')
    assert(canReadSale(persistence, owner, saleB1).ok, '11 owner sale B1')
    assert(canCreateRefund(persistence, owner, paymentB1).ok, '11 owner refund B1')
    assert(canReadFinancialAnalytics(persistence, owner, a1).ok, '11 owner analytics')
    assert(canCancelRefund(persistence, owner, refundB1).ok, '11 owner refund cancel')
  }

  {
    denied(
      canReadSale(persistence, employee, saleB1),
      'ACCESS_DENIED',
      '12 employee sale warehouse B1',
    )
    denied(
      canReadPayment(persistence, employee, paymentB1),
      'ACCESS_DENIED',
      '12 employee payment warehouse B1',
    )
    denied(
      canCreateSale(persistence, manager, b1),
      'WAREHOUSE_BRANCH_MISMATCH',
      '12 manager warehouse B1',
    )
    assert(canCreateSale(persistence, director, a1).ok, '12 director warehouse A1')
    denied(
      canCreateSale(persistence, director, b1),
      'WAREHOUSE_BRANCH_MISMATCH',
      '12 director warehouse B1',
    )
  }

  {
    denied(
      canReadSale(persistence, employee, saleXB1),
      'ORGANIZATION_MISMATCH',
      '13 employee cross-org sale',
    )
    denied(
      canReadPayment(persistence, owner, paymentXB1),
      'ORGANIZATION_MISMATCH',
      '13 owner cross-org payment',
    )
    denied(
      canReadSale(persistence, foreignOwner, saleA1),
      'ORGANIZATION_MISMATCH',
      '13 foreign owner sale A',
    )
    denied(
      canReadFinancialAnalytics(persistence, owner, xb1),
      'ORGANIZATION_MISMATCH',
      '13 owner analytics foreign warehouse',
    )
  }

  {
    denied(
      canReadSale(persistence, null, saleA1),
      'CURRENT_USER_REQUIRED',
      '14 no currentUser sale',
    )
    denied(
      canReadPayment(persistence, undefined, paymentA1),
      'CURRENT_USER_REQUIRED',
      '14 no currentUser payment',
    )
    denied(
      canReadFinancialAnalytics(persistence, null, a1),
      'CURRENT_USER_REQUIRED',
      '14 no currentUser analytics',
    )
  }

  {
    const masked = buildSaleFinancialView({
      sale: saleA1,
      canRead: true,
      canReadAmount: false,
      paidAmount: 40,
      outstandingAmount: 60,
    })
    assert(masked.canRead && !masked.canReadAmount, '15 read without amount flags')
    assert(
      masked.subtotal === undefined &&
        masked.discount === undefined &&
        masked.total === undefined &&
        masked.paidAmount === undefined &&
        masked.outstandingAmount === undefined,
      '15 amounts omitted from projection',
    )

    const withAmounts = toSaleFinancialView(persistence, employee, saleA1)
    assert(withAmounts.ok && withAmounts.value.canReadAmount, '15 employee has amounts')
    assert(
      withAmounts.value.total === saleA1.total &&
        withAmounts.value.paidAmount === 40 &&
        withAmounts.value.outstandingAmount === 60,
      '15 employee amount projection',
    )
  }

  {
    denied(
      canReadFinancialAnalytics(persistence, employee, a1),
      'ACCESS_DENIED',
      '16 employee analytics',
    )
    assert(
      canReadFinancialAnalytics(persistence, manager, a1).ok,
      '16 manager analytics A1',
    )
    denied(
      canReadFinancialAnalytics(persistence, manager, b1),
      'WAREHOUSE_BRANCH_MISMATCH',
      '16 manager analytics B1',
    )
    assert(
      canReadFinancialAnalytics(persistence, director, a1).ok,
      '16 director analytics branch',
    )
    denied(
      canReadFinancialAnalytics(persistence, director, b1),
      'WAREHOUSE_BRANCH_MISMATCH',
      '16 director analytics foreign branch',
    )
    assert(
      canReadFinancialAnalytics(persistence, commercial, a1).ok &&
        canReadFinancialAnalytics(persistence, commercial, b1).ok,
      '16 commercial analytics organization',
    )
    assert(
      canReadFinancialAnalytics(persistence, owner, a1).ok &&
        canReadFinancialAnalytics(persistence, owner, b1).ok,
      '16 owner analytics organization',
    )
  }
}
