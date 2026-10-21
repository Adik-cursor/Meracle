import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { getCompanyDashboardForUser } from './company-dashboard'
import { createCareChargeForUser, createCareChargePaymentForUser } from './care-finance'
import { createChildForUser } from './children'
import { createExpenseForUser } from './expenses'
import { currentMotivationPeriodKey } from './employee-motivation'
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

export function runKindergartenDashboardFinanceChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-kdf-a'
  const orgB = 'org-kdf-b'
  addOrg(persistence, orgA, 'Ясмин')
  addOrg(persistence, orgB, 'Other')
  seedEnabledBusinessModules(persistence, orgA, 'seed', [
    'children',
    'attendance',
    'crm',
    'expenses',
    'analytics',
  ])
  seedEnabledBusinessModules(persistence, orgB, 'seed', ['children', 'attendance', 'crm', 'expenses'])
  const ownerA = addUser(persistence, orgA, 'owner')
  const ownerB = addUser(persistence, orgB, 'owner')
  const period = currentMotivationPeriodKey()

  const child = createChildForUser(persistence, ownerA, {
    firstName: 'Ая',
    lastName: 'К',
    birthDate: '2020-01-01',
    status: 'attending',
    parentFullName: 'Мама К',
    parentPhone: '87002223344',
  })
  assert(child.ok, 'child')
  const charge = createCareChargeForUser(persistence, ownerA, {
    childId: child.value.id,
    amount: 150_000,
    period,
    description: 'Сентябрь',
  })
  assert(charge.ok, 'CareCharge exists')
  const paid = createCareChargePaymentForUser(persistence, ownerA, {
    childId: child.value.id,
    careChargeId: charge.value.id,
    amount: 150_000,
    method: 'cash',
  })
  assert(paid.ok && paid.value.status === 'completed', 'completed Payment exists')
  assert(
    createExpenseForUser(persistence, ownerA, orgA, {
      category: 'rent',
      description: 'Аренда',
      amount: 160_000,
      date: `${period}-10`,
    }).ok,
    'expense',
  )

  const dash = getCompanyDashboardForUser(persistence, ownerA, period)
  assert(dash.ok && dash.value.care, 'dashboard')
  assert(dash.value.care.paymentsIncluded, 'payments included without sales')
  assert(dash.value.care.paidAmount === 150_000, 'Dashboard paid includes CareCharge payment')
  assert(dash.value.care.expenses === 160_000, 'expenses remain correct')
  assert(dash.value.care.netResult === -10_000, 'net = paid - expenses')
  assert(!dash.value.sales, 'no Sale required')

  const otherMonth = getCompanyDashboardForUser(persistence, ownerA, '2020-01')
  assert(otherMonth.ok && otherMonth.value.care?.paidAmount === 0, 'other month has no this payment')

  const childB = createChildForUser(persistence, ownerB, {
    firstName: 'Бек',
    lastName: 'Б',
    birthDate: '2019-01-01',
    status: 'attending',
    parentFullName: 'Папа Б',
    parentPhone: '87003334455',
  })
  assert(childB.ok, 'org B child')
  const chargeB = createCareChargeForUser(persistence, ownerB, {
    childId: childB.value.id,
    amount: 80_000,
    period,
  })
  assert(chargeB.ok, 'org B charge')
  assert(
    createCareChargePaymentForUser(persistence, ownerB, {
      childId: childB.value.id,
      careChargeId: chargeB.value.id,
      amount: 80_000,
    }).ok,
    'org B payment',
  )
  const dashA = getCompanyDashboardForUser(persistence, ownerA, period)
  assert(dashA.ok && dashA.value.care?.paidAmount === 150_000, 'org A paid not mixed with B')

  const sibling = createChildForUser(persistence, ownerA, {
    firstName: 'Дани',
    lastName: 'К',
    birthDate: '2021-02-02',
    status: 'attending',
    parentFullName: 'Мама К',
    parentPhone: '87002223344',
  })
  assert(sibling.ok, 'second child')
  const charge2 = createCareChargeForUser(persistence, ownerA, {
    childId: sibling.value.id,
    amount: 50_000,
    period,
  })
  assert(charge2.ok, 'second charge')
  assert(
    createCareChargePaymentForUser(persistence, ownerA, {
      childId: sibling.value.id,
      careChargeId: charge2.value.id,
      amount: 20_000,
    }).ok,
    'partial payment',
  )
  const withPartial = getCompanyDashboardForUser(persistence, ownerA, period)
  assert(withPartial.ok && withPartial.value.care?.paidAmount === 170_000, 'partial added')

  persistence.careCharges.update(charge2.value.id, { status: 'cancelled' })
  const afterCancelCharge = getCompanyDashboardForUser(persistence, ownerA, period)
  assert(
    afterCancelCharge.ok && afterCancelCharge.value.care?.paidAmount === 150_000,
    'cancelled charge payments excluded',
  )

  const none = createChildForUser(persistence, ownerA, {
    firstName: 'Без',
    lastName: 'Оплаты',
    birthDate: '2022-02-02',
    status: 'attending',
    parentFullName: 'Опекун',
    parentPhone: '87004445566',
  })
  assert(none.ok, 'child without payment')
  const unpaidCharge = createCareChargeForUser(persistence, ownerA, {
    childId: none.value.id,
    amount: 10_000,
    period,
  })
  assert(unpaidCharge.ok, 'unpaid charge')
  const still = getCompanyDashboardForUser(persistence, ownerA, period)
  assert(still.ok && still.value.care?.paidAmount === 150_000, 'unpaid charge does not add paid')

  const snap = persistence.capture()
  snap.restore()
  const after = getCompanyDashboardForUser(persistence, ownerA, period)
  assert(after.ok && after.value.care?.paidAmount === 150_000, 'F5 paid persists')

  console.log('kindergarten-dashboard-finance.verify: ok')
}

runKindergartenDashboardFinanceChecks()
