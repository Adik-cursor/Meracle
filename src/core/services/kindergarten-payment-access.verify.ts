import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import {
  createCareChargeForUser,
  createCareChargePaymentForUser,
} from './care-finance'
import { createChildForUser } from './children'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { createUserForUser } from './users'

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

export function runKindergartenPaymentAccessChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-pay-a'
  const orgB = 'org-pay-b'
  addOrg(persistence, orgA, 'Ясмин')
  addOrg(persistence, orgB, 'Sad B')
  seedEnabledBusinessModules(persistence, orgA, 'seed', [
    'children',
    'attendance',
    'crm',
    'expenses',
  ])
  seedEnabledBusinessModules(persistence, orgB, 'seed', ['children', 'attendance', 'crm'])
  const ownerA = addUser(persistence, orgA, 'owner')
  const ownerB = addUser(persistence, orgB, 'owner')

  const admin = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Зарина',
    lastName: 'Админ',
    email: 'demo-user-003@example.com',
    role: 'kindergarten_admin',
    status: 'active',
    jobTitle: 'Заведующий',
  })
  assert(admin.ok, 'admin')

  const cook = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Асель',
    lastName: 'Повар',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Повар',
  })
  assert(cook.ok && cook.value.accountEnabled === false, 'cook has no account')

  const child = createChildForUser(persistence, admin.value, {
    firstName: 'Алияна',
    lastName: 'Садыкова',
    birthDate: '2020-01-15',
    status: 'attending',
    parentFullName: 'Садыкова Айгуль',
    parentPhone: '87001110001',
  })
  assert(child.ok, 'child')

  const charge = createCareChargeForUser(persistence, admin.value, {
    childId: child.value.id,
    amount: 50_000,
    period: '2026-09',
    description: 'Сентябрь',
  })
  assert(charge.ok, 'admin can create CareCharge')

  const paid = createCareChargePaymentForUser(persistence, admin.value, {
    childId: child.value.id,
    careChargeId: charge.value.id,
    amount: 20_000,
    method: 'cash',
  })
  assert(paid.ok, 'administrator can accept payment')
  assert(paid.value.careChargeId === charge.value.id, 'payment uses CareCharge')
  assert(!paid.value.saleId, 'no Sale')
  assert(!paid.value.rentalBookingId, 'no RentalBooking')

  const over = createCareChargePaymentForUser(persistence, admin.value, {
    childId: child.value.id,
    careChargeId: charge.value.id,
    amount: 40_000,
    method: 'cash',
  })
  assert(!over.ok && over.error.code === 'PAYMENT_LIMIT_EXCEEDED', 'overpayment blocked')

  const staffPay = createCareChargePaymentForUser(persistence, cook.value, {
    childId: child.value.id,
    careChargeId: charge.value.id,
    amount: 1_000,
    method: 'cash',
  })
  assert(!staffPay.ok && staffPay.error.code === 'ACCESS_DENIED', 'ordinary employee cannot pay')

  const childB = createChildForUser(persistence, ownerB, {
    firstName: 'Мирас',
    lastName: 'Беков',
    birthDate: '2019-05-01',
    status: 'attending',
    parentFullName: 'Беков Ерлан',
    parentPhone: '87001110002',
  })
  assert(childB.ok, 'child B')
  const chargeB = createCareChargeForUser(persistence, ownerB, {
    childId: childB.value.id,
    amount: 10_000,
    period: '2026-09',
  })
  assert(chargeB.ok, 'charge B')
  const stolen = createCareChargePaymentForUser(persistence, admin.value, {
    childId: childB.value.id,
    careChargeId: chargeB.value.id,
    amount: 1_000,
    method: 'cash',
  })
  assert(!stolen.ok, 'admin A cannot pay org B')

  const snap = persistence.capture()
  snap.restore()
  assert(persistence.payments.getById(paid.value.id)?.careChargeId === charge.value.id, 'F5 payment')

  console.log('kindergarten-payment-access.verify: ok')
}

runKindergartenPaymentAccessChecks()
