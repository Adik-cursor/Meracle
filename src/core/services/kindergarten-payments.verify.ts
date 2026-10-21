import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import {
  createCareChargeForUser,
  createCareChargePaymentForUser,
  getChildFinanceForUser,
} from './care-finance'
import { createChildForUser } from './children'
import { listPaymentsForUser } from './create-payment'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function addOrg(persistence: Persistence, id: Id, name: string): void {
  const now = nowIso()
  persistence.organizations.create({
    id,
    organizationId: id,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

function addUser(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}-${newId()}@${organizationId}.local`,
    firstName: role,
    lastName: 'User',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(user)
  return user
}

export function runKindergartenPaymentsChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-pay-a'
  const orgB = 'org-pay-b'
  addOrg(persistence, orgA, 'Sad A')
  addOrg(persistence, orgB, 'Sad B')
  seedEnabledBusinessModules(persistence, orgA, 'seed', ['children', 'attendance', 'crm'])
  seedEnabledBusinessModules(persistence, orgB, 'seed', ['children', 'attendance', 'crm', 'sales'])
  const ownerA = addUser(persistence, orgA, 'owner')
  const ownerB = addUser(persistence, orgB, 'owner')
  const accountant = addUser(persistence, orgA, 'accountant')
  const salesManager = addUser(persistence, orgA, 'sales_manager')
  const warehouse = addUser(persistence, orgA, 'warehouse_manager')

  const childA = createChildForUser(persistence, ownerA, {
    firstName: 'Анна',
    lastName: 'Иванова',
    birthDate: '2020-03-01',
    status: 'attending',
    parentFullName: 'Иванов Алексей',
    parentPhone: '87001112233',
  })
  assert(childA.ok, 'child with parent')

  const orphan = createChildForUser(persistence, ownerA, {
    firstName: 'Без',
    lastName: 'Родителя',
    birthDate: '2020-01-01',
    status: 'attending',
  })
  assert(orphan.ok, 'child without parent')
  const orphanCharge = createCareChargeForUser(persistence, ownerA, {
    childId: orphan.value.id,
    amount: 1000,
    period: '2026-09',
    description: 'Месяц',
  })
  assert(
    !orphanCharge.ok && orphanCharge.error.code === 'CARE_PARENT_REQUIRED',
    'charge requires parent',
  )

  const empty = getChildFinanceForUser(persistence, ownerA, childA.value.id)
  assert(
    empty.ok && empty.value.charged === 0 && empty.value.paid === 0 && empty.value.debt === 0,
    'derived zeros before charges',
  )

  const charge = createCareChargeForUser(persistence, ownerA, {
    childId: childA.value.id,
    amount: 10_000,
    period: '2026-09',
    description: 'Сентябрь',
    currency: 'KZT',
  })
  assert(charge.ok, 'create charge')
  assert(charge.value.organizationId === orgA, 'charge org from actor')
  assert(charge.value.customerId === childA.value.parentCustomerId, 'charge billed to parent customer')
  assert(charge.value.period === '2026-09', 'period stored as YYYY-MM')
  assert(charge.value.amount === 10_000, 'individual amount stored as billed')

  const duplicate = createCareChargeForUser(persistence, ownerA, {
    childId: childA.value.id,
    amount: 12_000,
    period: '2026-09',
  })
  assert(
    !duplicate.ok && duplicate.error.code === 'CARE_CHARGE_DUPLICATE_PERIOD',
    'duplicate open charge for child+period rejected',
  )

  const badPeriod = createCareChargeForUser(persistence, ownerA, {
    childId: childA.value.id,
    amount: 1000,
    period: '2026-13',
  })
  assert(!badPeriod.ok && badPeriod.error.code === 'INVALID_INPUT', 'invalid period rejected')

  const invalidAmount = createCareChargeForUser(persistence, ownerA, {
    childId: childA.value.id,
    amount: 0,
    period: '2026-09',
    description: 'Ноль',
  })
  assert(!invalidAmount.ok && invalidAmount.error.code === 'INVALID_INPUT', 'charge amount > 0')

  const payment = createCareChargePaymentForUser(persistence, ownerA, {
    childId: childA.value.id,
    careChargeId: charge.value.id,
    amount: 4_000,
    method: 'cash',
  })
  assert(payment.ok, 'create payment')
  assert(payment.value.careChargeId === charge.value.id, 'payment linked to charge')
  assert(!payment.value.saleId, 'kindergarten payment has no sale')
  assert(!payment.value.rentalBookingId, 'kindergarten payment has no rental booking')
  assert(payment.value.organizationId === orgA, 'payment org from actor')

  const zeroPay = createCareChargePaymentForUser(persistence, ownerA, {
    childId: childA.value.id,
    careChargeId: charge.value.id,
    amount: 0,
    method: 'cash',
  })
  assert(!zeroPay.ok && zeroPay.error.code === 'INVALID_INPUT', 'payment amount > 0')

  const overpay = createCareChargePaymentForUser(persistence, ownerA, {
    childId: childA.value.id,
    careChargeId: charge.value.id,
    amount: 7_000,
    method: 'card',
  })
  assert(
    !overpay.ok && overpay.error.code === 'PAYMENT_LIMIT_EXCEEDED',
    'cannot pay more than remaining charge',
  )

  const finance = getChildFinanceForUser(persistence, ownerA, childA.value.id)
  assert(
    finance.ok &&
      finance.value.charged === 10_000 &&
      finance.value.paid === 4_000 &&
      finance.value.debt === 6_000,
    'debt = charges - completed payments',
  )
  assert(finance.value.due === 6_000, 'due matches debt')
  assert(
    finance.value.periods.some(
      (row) => row.period === '2026-09' && row.charged === 10_000 && row.paid === 4_000 && row.due === 6_000,
    ),
    'period finance for 2026-09',
  )

  assert(persistence.sales.list(orgA).length === 0, 'no Sale created')
  assert(persistence.rentalBookings.list(orgA).length === 0, 'no RentalBooking created')

  seedEnabledBusinessModules(persistence, orgA, 'seed', [
    'children',
    'attendance',
    'crm',
    'sales',
  ])
  const salesList = listPaymentsForUser(persistence, ownerA)
  assert(salesList.ok, 'sales module can list sale payments')
  assert(
    salesList.value.every((item) => item.id !== payment.value.id),
    'sales payment list excludes kindergarten payments',
  )

  const stolenFinance = getChildFinanceForUser(persistence, ownerB, childA.value.id)
  assert(!stolenFinance.ok, 'org B cannot read finance of child A')
  const stolenPay = createCareChargePaymentForUser(persistence, ownerB, {
    childId: childA.value.id,
    careChargeId: charge.value.id,
    amount: 100,
    method: 'cash',
  })
  assert(!stolenPay.ok, 'org B cannot pay for child A')

  const childB = createChildForUser(persistence, ownerB, {
    firstName: 'Борис',
    lastName: 'Б',
    birthDate: '2020-02-02',
    status: 'attending',
    parentFullName: 'Борисов Б',
    parentPhone: '87002223344',
  })
  assert(childB.ok, 'child in org B')
  const chargeB = createCareChargeForUser(persistence, ownerB, {
    childId: childB.value.id,
    amount: 500,
    period: '2026-09',
    description: 'B',
  })
  assert(chargeB.ok, 'charge in org B')
  const crossPay = createCareChargePaymentForUser(persistence, ownerA, {
    childId: childB.value.id,
    careChargeId: chargeB.value.id,
    amount: 100,
    method: 'cash',
  })
  assert(!crossPay.ok, 'org A cannot pay org B charge')

  const accountantRead = getChildFinanceForUser(persistence, accountant, childA.value.id)
  assert(
    accountantRead.ok && accountantRead.value.debt === 6_000,
    'read-only accountant sees derived finance',
  )
  const accountantPay = createCareChargePaymentForUser(persistence, accountant, {
    childId: childA.value.id,
    careChargeId: charge.value.id,
    amount: 100,
    method: 'cash',
  })
  assert(
    !accountantPay.ok && accountantPay.error.code === 'ACCESS_DENIED',
    'accountant cannot create payment',
  )
  const managerCharge = createCareChargeForUser(persistence, salesManager, {
    childId: childA.value.id,
    amount: 100,
    period: '2026-10',
    description: 'No',
  })
  assert(
    !managerCharge.ok && managerCharge.error.code === 'ACCESS_DENIED',
    'sales_manager cannot manage kindergarten charges',
  )
  const warehouseRead = getChildFinanceForUser(persistence, warehouse, childA.value.id)
  assert(!warehouseRead.ok && warehouseRead.error.code === 'ACCESS_DENIED', 'warehouse rbac')

  const aliya = createChildForUser(persistence, ownerA, {
    firstName: 'Алияна',
    lastName: 'К',
    birthDate: '2020-04-04',
    status: 'attending',
    parentFullName: 'Каримов К',
    parentPhone: '87005556677',
  })
  const miras = createChildForUser(persistence, ownerA, {
    firstName: 'Мирас',
    lastName: 'К',
    birthDate: '2021-05-05',
    status: 'attending',
    parentFullName: 'Каримов К',
    parentPhone: '+7 (700) 555-66-77',
  })
  assert(aliya.ok && miras.ok, 'two children')
  assert(
    aliya.value.parentCustomerId === miras.value.parentCustomerId,
    'one parent → multiple children',
  )

  const aliyaSept = createCareChargeForUser(persistence, ownerA, {
    childId: aliya.value.id,
    amount: 50_000,
    period: '2026-09',
  })
  const mirasSept = createCareChargeForUser(persistence, ownerA, {
    childId: miras.value.id,
    amount: 35_000,
    period: '2026-09',
  })
  assert(aliyaSept.ok && aliyaSept.value.amount === 50_000, 'aliya individual 50000')
  assert(mirasSept.ok && mirasSept.value.amount === 35_000, 'miras individual 35000')
  assert(aliyaSept.value.period === mirasSept.value.period, 'same period different children')

  persistence.careCharges.update(aliyaSept.value.id, {
    status: 'cancelled',
    updatedAt: nowIso(),
  })
  const cancelledFinance = getChildFinanceForUser(persistence, ownerA, aliya.value.id)
  assert(
    cancelledFinance.ok && cancelledFinance.value.charged === 0,
    'cancelled charge excluded from charged',
  )
  const aliyaSeptAgain = createCareChargeForUser(persistence, ownerA, {
    childId: aliya.value.id,
    amount: 50_000,
    period: '2026-09',
  })
  assert(aliyaSeptAgain.ok, 'open charge allowed after cancelled period charge')

  const aliyaAug = createCareChargeForUser(persistence, ownerA, {
    childId: aliya.value.id,
    amount: 40_000,
    period: '2026-08',
  })
  assert(aliyaAug.ok, 'different period allowed')

  const partial = createCareChargePaymentForUser(persistence, ownerA, {
    childId: aliya.value.id,
    careChargeId: aliyaSeptAgain.value.id,
    amount: 30_000,
    method: 'cash',
  })
  assert(partial.ok, 'partial payment 30000')
  const afterPartial = getChildFinanceForUser(persistence, ownerA, aliya.value.id)
  assert(
    afterPartial.ok &&
      afterPartial.value.lines[0]?.period === '2026-09' &&
      afterPartial.value.lines[0]?.due === 20_000 &&
      afterPartial.value.charged === 90_000 &&
      afterPartial.value.paid === 30_000 &&
      afterPartial.value.due === 60_000,
    'partial due 20000 on september, august unpaid',
  )
  const overRemaining = createCareChargePaymentForUser(persistence, ownerA, {
    childId: aliya.value.id,
    careChargeId: aliyaSeptAgain.value.id,
    amount: 20_001,
    method: 'cash',
  })
  assert(
    !overRemaining.ok && overRemaining.error.code === 'PAYMENT_LIMIT_EXCEEDED',
    '20001 over remaining 20000 rejected',
  )
  const rest = createCareChargePaymentForUser(persistence, ownerA, {
    childId: aliya.value.id,
    careChargeId: aliyaSeptAgain.value.id,
    amount: 20_000,
    method: 'cash',
    note: 'остаток',
  })
  assert(rest.ok, 'full remaining payment')
  const afterFull = getChildFinanceForUser(persistence, ownerA, aliya.value.id)
  assert(
    afterFull.ok &&
      afterFull.value.lines.find((line) => line.period === '2026-09')?.due === 0 &&
      afterFull.value.due === 40_000,
    'september due 0, august still due',
  )

  const stolenCharge = createCareChargeForUser(persistence, ownerB, {
    childId: aliya.value.id,
    amount: 1000,
    period: '2026-07',
  })
  assert(!stolenCharge.ok, 'org B cannot charge child A')

  const snapshot = persistence.capture()
  snapshot.restore()
  const restored = getChildFinanceForUser(persistence, ownerA, childA.value.id)
  assert(
    restored.ok &&
      restored.value.charged === 10_000 &&
      restored.value.paid === 4_000 &&
      restored.value.debt === 6_000,
    'finance persists after restore',
  )
  const restoredAliya = getChildFinanceForUser(persistence, ownerA, aliya.value.id)
  assert(
    restoredAliya.ok &&
      restoredAliya.value.due === 40_000 &&
      restoredAliya.value.lines.find((line) => line.period === '2026-09')?.paid === 50_000 &&
      persistence.careCharges.getById(aliyaSeptAgain.value.id)?.period === '2026-09',
    'individual period charges persist',
  )

  const legacy = persistence.careCharges.create({
    id: newId(),
    organizationId: orgA,
    customerId: childA.value.parentCustomerId as string,
    childId: childA.value.id,
    amount: 1_000,
    currency: 'KZT',
    description: 'legacy',
    status: 'open',
    createdBy: ownerA.id,
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  })
  const legacyFinance = getChildFinanceForUser(persistence, ownerA, childA.value.id)
  assert(
    legacyFinance.ok &&
      legacyFinance.value.lines.some((line) => line.chargeId === legacy.id && line.period === '2026-07') &&
      !legacy.period,
    'legacy charge without period still loads via createdAt fallback',
  )

  const orgOff = 'org-pay-off'
  addOrg(persistence, orgOff, 'Off')
  seedEnabledBusinessModules(persistence, orgOff, 'seed', ['sales'])
  const ownerOff = addUser(persistence, orgOff, 'owner')
  const gated = getChildFinanceForUser(persistence, ownerOff, childA.value.id)
  assert(!gated.ok && gated.error.code === 'MODULE_NOT_ENABLED', 'children module gating')

  console.log('kindergarten-payments.verify: ok')
}

runKindergartenPaymentsChecks()
