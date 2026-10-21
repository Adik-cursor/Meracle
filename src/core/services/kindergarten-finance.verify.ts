import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { createCareGroupForUser } from './care-groups'
import {
  createCareChargeForUser,
  createCareChargePaymentForUser,
  listKindergartenFinanceForUser,
} from './care-finance'
import { createChildForUser } from './children'
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

export function runKindergartenFinanceChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-fin-a'
  const orgB = 'org-fin-b'
  addOrg(persistence, orgA, 'Ясмин')
  addOrg(persistence, orgB, 'Sad B')
  seedEnabledBusinessModules(persistence, orgA, 'seed', ['children', 'attendance', 'crm'])
  seedEnabledBusinessModules(persistence, orgB, 'seed', ['children', 'attendance', 'crm'])
  const ownerA = addUser(persistence, orgA, 'owner')
  const ownerB = addUser(persistence, orgB, 'owner')
  const accountant = addUser(persistence, orgA, 'accountant')
  const warehouse = addUser(persistence, orgA, 'warehouse_manager')

  const seniors = createCareGroupForUser(persistence, ownerA, {
    name: 'Старшая группа',
    capacity: 20,
    status: 'active',
  })
  const nursery = createCareGroupForUser(persistence, ownerA, {
    name: 'Ясельная',
    capacity: 10,
    status: 'active',
  })
  assert(seniors.ok && nursery.ok, 'groups')

  const aliya = createChildForUser(persistence, ownerA, {
    firstName: 'Алияна',
    lastName: 'Садыкова',
    birthDate: '2020-01-01',
    status: 'attending',
    groupId: seniors.value.id,
    parentFullName: 'Садыков С',
    parentPhone: '87001110001',
  })
  const miras = createChildForUser(persistence, ownerA, {
    firstName: 'Мирас',
    lastName: 'Иванов',
    birthDate: '2020-02-02',
    status: 'attending',
    groupId: seniors.value.id,
    parentFullName: 'Иванов И',
    parentPhone: '87001110002',
  })
  const aruzhan = createChildForUser(persistence, ownerA, {
    firstName: 'Аружан',
    lastName: 'К',
    birthDate: '2021-03-03',
    status: 'attending',
    groupId: nursery.value.id,
    parentFullName: 'Каримова К',
    parentPhone: '87001110003',
  })
  const idle = createChildForUser(persistence, ownerA, {
    firstName: 'Без',
    lastName: 'Начисления',
    birthDate: '2020-04-04',
    status: 'attending',
    groupId: seniors.value.id,
    parentFullName: 'Нет Н',
    parentPhone: '87001110004',
  })
  assert(aliya.ok && miras.ok && aruzhan.ok && idle.ok, 'children')

  const septAliya = createCareChargeForUser(persistence, ownerA, {
    childId: aliya.value.id,
    amount: 50_000,
    period: '2026-09',
  })
  const septMiras = createCareChargeForUser(persistence, ownerA, {
    childId: miras.value.id,
    amount: 40_000,
    period: '2026-09',
  })
  const septAruzhan = createCareChargeForUser(persistence, ownerA, {
    childId: aruzhan.value.id,
    amount: 35_000,
    period: '2026-09',
  })
  const augAliya = createCareChargeForUser(persistence, ownerA, {
    childId: aliya.value.id,
    amount: 10_000,
    period: '2026-08',
  })
  assert(septAliya.ok && septMiras.ok && septAruzhan.ok && augAliya.ok, 'individual charges')

  const duplicate = createCareChargeForUser(persistence, ownerA, {
    childId: aliya.value.id,
    amount: 1,
    period: '2026-09',
  })
  assert(
    !duplicate.ok && duplicate.error.code === 'CARE_CHARGE_DUPLICATE_PERIOD',
    'duplicate open charge blocked',
  )

  const empty = listKindergartenFinanceForUser(persistence, ownerA, { period: '2026-07' })
  assert(empty.ok && empty.value.rows.length === 0, 'month without charges is empty')
  assert(
    empty.value.childrenWithCharge === 0 && empty.value.childrenWithDebt === 0,
    'idle month has no debtors',
  )

  const september = listKindergartenFinanceForUser(persistence, ownerA, { period: '2026-09' })
  assert(september.ok, 'list september')
  assert(september.value.period === '2026-09', 'period filter')
  assert(!september.value.rows.some((row) => row.childId === idle.value.id), 'no charge → not listed')
  assert(september.value.rows.length === 3, 'three children with september charges')
  assert(september.value.charged === 125_000, 'period charged 125000')
  assert(september.value.paid === 0 && september.value.due === 125_000, 'unpaid period due')
  assert(september.value.childrenWithCharge === 3 && september.value.childrenWithDebt === 3, 'debtors')
  assert(
    september.value.rows.find((row) => row.childId === aliya.value.id)?.charged === 50_000 &&
      september.value.rows.find((row) => row.childId === miras.value.id)?.charged === 40_000 &&
      september.value.rows.find((row) => row.childId === aruzhan.value.id)?.charged === 35_000,
    'individual amounts',
  )
  assert(
    september.value.rows.every((row) => row.paymentStatus === 'unpaid'),
    'unpaid status derived',
  )

  const searched = listKindergartenFinanceForUser(persistence, ownerA, {
    period: '2026-09',
    query: 'алияна',
  })
  assert(searched.ok && searched.value.rows.length === 1, 'search by name')
  assert(searched.value.charged === 125_000, 'summary stays period total while table is filtered')

  const byGroup = listKindergartenFinanceForUser(persistence, ownerA, {
    period: '2026-09',
    groupId: nursery.value.id,
  })
  assert(byGroup.ok && byGroup.value.rows.length === 1 && byGroup.value.rows[0]?.childId === aruzhan.value.id, 'group filter')

  const unpaid = listKindergartenFinanceForUser(persistence, ownerA, {
    period: '2026-09',
    paymentStatus: 'unpaid',
  })
  assert(unpaid.ok && unpaid.value.rows.length === 3, 'unpaid filter')

  const partialPay = createCareChargePaymentForUser(persistence, ownerA, {
    childId: aliya.value.id,
    careChargeId: septAliya.value.id,
    amount: 30_000,
  })
  assert(partialPay.ok, 'partial 30000')
  const afterPartial = listKindergartenFinanceForUser(persistence, ownerA, { period: '2026-09' })
  const aliyaRow = afterPartial.ok
    ? afterPartial.value.rows.find((row) => row.childId === aliya.value.id)
    : undefined
  assert(aliyaRow?.paid === 30_000 && aliyaRow.due === 20_000 && aliyaRow.paymentStatus === 'partial', 'partial status')
  assert(afterPartial.ok && afterPartial.value.paid === 30_000 && afterPartial.value.due === 95_000, 'period totals after partial')

  const over = createCareChargePaymentForUser(persistence, ownerA, {
    childId: aliya.value.id,
    careChargeId: septAliya.value.id,
    amount: 20_001,
  })
  assert(!over.ok && over.error.code === 'PAYMENT_LIMIT_EXCEEDED', 'overpayment rejected')

  const rest = createCareChargePaymentForUser(persistence, ownerA, {
    childId: aliya.value.id,
    careChargeId: septAliya.value.id,
    amount: 20_000,
  })
  const mirasPay = createCareChargePaymentForUser(persistence, ownerA, {
    childId: miras.value.id,
    careChargeId: septMiras.value.id,
    amount: 40_000,
  })
  assert(rest.ok && mirasPay.ok, 'full payments')
  const afterFull = listKindergartenFinanceForUser(persistence, ownerA, { period: '2026-09' })
  assert(afterFull.ok, 'after full')
  assert(
    afterFull.value.rows.find((row) => row.childId === aliya.value.id)?.paymentStatus === 'paid' &&
      afterFull.value.rows.find((row) => row.childId === miras.value.id)?.paymentStatus === 'paid' &&
      afterFull.value.rows.find((row) => row.childId === aruzhan.value.id)?.paymentStatus === 'unpaid',
    'paid/unpaid mix',
  )
  const paidOnly = listKindergartenFinanceForUser(persistence, ownerA, {
    period: '2026-09',
    paymentStatus: 'paid',
  })
  const partialOnly = listKindergartenFinanceForUser(persistence, ownerA, {
    period: '2026-09',
    paymentStatus: 'partial',
  })
  const unpaidOnly = listKindergartenFinanceForUser(persistence, ownerA, {
    period: '2026-09',
    paymentStatus: 'unpaid',
  })
  assert(paidOnly.ok && paidOnly.value.rows.length === 2, 'paid filter')
  assert(partialOnly.ok && partialOnly.value.rows.length === 0, 'no partial left')
  assert(unpaidOnly.ok && unpaidOnly.value.rows.length === 1, 'unpaid filter remaining')

  persistence.careCharges.update(septAruzhan.value.id, {
    status: 'cancelled',
    updatedAt: nowIso(),
  })
  const afterCancel = listKindergartenFinanceForUser(persistence, ownerA, { period: '2026-09' })
  assert(
    afterCancel.ok &&
      !afterCancel.value.rows.some((row) => row.childId === aruzhan.value.id) &&
      afterCancel.value.charged === 90_000,
    'cancelled charge excluded',
  )

  const childB = createChildForUser(persistence, ownerB, {
    firstName: 'Борис',
    lastName: 'Б',
    birthDate: '2020-01-01',
    status: 'attending',
    parentFullName: 'Борисов Б',
    parentPhone: '87002220000',
  })
  assert(childB.ok, 'child B')
  const chargeB = createCareChargeForUser(persistence, ownerB, {
    childId: childB.value.id,
    amount: 99_000,
    period: '2026-09',
  })
  assert(chargeB.ok, 'charge B')
  const fromA = listKindergartenFinanceForUser(persistence, ownerA, { period: '2026-09' })
  assert(fromA.ok && fromA.value.rows.every((row) => row.childId !== childB.value.id), 'org isolation list')
  const stolenList = listKindergartenFinanceForUser(persistence, ownerB, { period: '2026-09' })
  assert(stolenList.ok && stolenList.value.charged === 99_000, 'org B sees only own aggregate')
  const stolenPay = createCareChargePaymentForUser(persistence, ownerA, {
    childId: childB.value.id,
    careChargeId: chargeB.value.id,
    amount: 1000,
  })
  assert(!stolenPay.ok, 'cannot pay org B')
  const stolenCharge = createCareChargeForUser(persistence, ownerA, {
    childId: childB.value.id,
    amount: 1000,
    period: '2026-10',
  })
  assert(!stolenCharge.ok, 'cannot charge org B child')

  const accountantRead = listKindergartenFinanceForUser(persistence, accountant, { period: '2026-09' })
  assert(accountantRead.ok, 'accountant can read finance')
  const accountantPay = createCareChargePaymentForUser(persistence, accountant, {
    childId: aliya.value.id,
    careChargeId: septAliya.value.id,
    amount: 1,
  })
  assert(!accountantPay.ok && accountantPay.error.code === 'ACCESS_DENIED', 'accountant cannot pay')
  const warehouseRead = listKindergartenFinanceForUser(persistence, warehouse, { period: '2026-09' })
  assert(!warehouseRead.ok && warehouseRead.error.code === 'ACCESS_DENIED', 'warehouse rbac')

  const snapshot = persistence.capture()
  snapshot.restore()
  const restored = listKindergartenFinanceForUser(persistence, ownerA, { period: '2026-09' })
  assert(
    restored.ok &&
      restored.value.rows.find((row) => row.childId === aliya.value.id)?.due === 0 &&
      restored.value.rows.find((row) => row.childId === miras.value.id)?.due === 0,
    'persistence keeps paid charges',
  )
  assert(persistence.sales.list(orgA).length === 0, 'no Sale')
  assert(persistence.rentalBookings.list(orgA).length === 0, 'no RentalBooking')
  assert(!('tariff' in septAliya.value) && !('discount' in septAliya.value), 'no tariff/discount fields')

  const orgOff = 'org-fin-off'
  addOrg(persistence, orgOff, 'Off')
  seedEnabledBusinessModules(persistence, orgOff, 'seed', ['crm'])
  const ownerOff = addUser(persistence, orgOff, 'owner')
  const gated = listKindergartenFinanceForUser(persistence, ownerOff, { period: '2026-09' })
  assert(!gated.ok && gated.error.code === 'MODULE_NOT_ENABLED', 'module gating')

  console.log('kindergarten-finance.verify: ok')
}

runKindergartenFinanceChecks()
