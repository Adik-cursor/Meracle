import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import {
  accrueEmployeeCompensationForUser,
  createEmployeeAdvanceForUser,
  getEmployeeCompensationForUser,
  payEmployeeCompensationRemainingForUser,
  salaryExpenseTotalForPeriod,
} from './employee-compensation'
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

function addUser(persistence: Persistence, organizationId: Id, role: UserRole): User {
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

export function runEmployeeAdvanceChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgId = 'org-advance'
  addOrg(persistence, orgId, 'Advance Org')
  seedEnabledBusinessModules(persistence, orgId, 'seed', [
    'children',
    'attendance',
    'crm',
    'expenses',
  ])
  const owner = addUser(persistence, orgId, 'owner')
  const employee: User = {
    id: newId(),
    organizationId: orgId,
    email: 'demo-user-052@example.com',
    firstName: 'Айгуль',
    lastName: 'Воспитатель',
    role: 'office_employee',
    status: 'active',
    phone: '+77012223344',
    jobTitle: 'Воспитатель',
    salaryAmount: 250_000,
    accountEnabled: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  persistence.users.create(employee)
  const period = '2026-09'
  assert(
    accrueEmployeeCompensationForUser(persistence, owner, employee.id, period).ok,
    'accrue',
  )
  const afterAdvance = createEmployeeAdvanceForUser(
    persistence,
    owner,
    employee.id,
    70_000,
    period,
  )
  assert(afterAdvance.ok, 'advance')
  assert(afterAdvance.value.accruedAmount === 250_000, 'advance is not extra salary')
  assert(afterAdvance.value.remainingAmount === 180_000, 'remaining 180k')
  assert(
    salaryExpenseTotalForPeriod(persistence, orgId, period) === 250_000,
    'expense still 250k after advance',
  )
  assert(
    payEmployeeCompensationRemainingForUser(persistence, owner, employee.id, period).ok,
    'pay rest',
  )
  assert(
    salaryExpenseTotalForPeriod(persistence, orgId, period) === 250_000,
    'expense still 250k after rest',
  )
  const view = getEmployeeCompensationForUser(persistence, owner, employee.id, period)
  assert(view.ok && view.value.paidAmount === 250_000, 'cash out 250k')
  assert(view.value.accruedAmount === 250_000, 'accrual 250k')

  console.log('employee-advance.verify: ok')
}

runEmployeeAdvanceChecks()
