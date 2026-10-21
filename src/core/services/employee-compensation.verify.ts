import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { login } from './auth'
import {
  accrueEmployeeCompensationForUser,
  createEmployeeAdvanceForUser,
  getEmployeeCompensationForUser,
  payEmployeeCompensationRemainingForUser,
  salaryExpenseTotalForPeriod,
} from './employee-compensation'
import { listExpensesForUser } from './expenses'
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
  extra?: Partial<User>,
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
    ...extra,
  }
  persistence.users.create(user)
  return user
}

function runPayrollScenario(
  persistence: Persistence,
  owner: User,
  modules: Parameters<typeof seedEnabledBusinessModules>[3],
  label: string,
  withoutAccount: boolean,
): void {
  seedEnabledBusinessModules(persistence, owner.organizationId, 'seed', modules)
  const employee = addUser(persistence, owner.organizationId, 'office_employee', {
    firstName: 'Staff',
    lastName: label,
    jobTitle: label,
    salaryAmount: 250_000,
    accountEnabled: withoutAccount ? false : true,
    phone: '+77011111111',
  })
  const period = '2026-09'
  const accrued = accrueEmployeeCompensationForUser(
    persistence,
    owner,
    employee.id,
    period,
  )
  assert(accrued.ok && accrued.value.accruedAmount === 250_000, `${label} accrue`)
  assert(accrued.value.remainingAmount === 250_000, `${label} remaining after accrue`)
  const advance = createEmployeeAdvanceForUser(
    persistence,
    owner,
    employee.id,
    70_000,
    period,
  )
  assert(advance.ok && advance.value.advanceAmount === 70_000, `${label} advance`)
  assert(advance.value.remainingAmount === 180_000, `${label} remaining after advance`)
  assert(advance.value.paidAmount === 70_000, `${label} paid after advance`)

  const reread = getEmployeeCompensationForUser(
    persistence,
    owner,
    employee.id,
    period,
  )
  assert(reread.ok && reread.value.remainingAmount === 180_000, `${label} F5 remaining`)

  const rest = payEmployeeCompensationRemainingForUser(
    persistence,
    owner,
    employee.id,
    period,
  )
  assert(rest.ok && rest.value.paidAmount === 250_000, `${label} paid total`)
  assert(rest.value.remainingAmount === 0, `${label} remaining zero`)
  assert(rest.value.advanceAmount === 70_000, `${label} advance kept`)
  assert(rest.value.history.length === 2, `${label} history count`)
  assert(rest.value.history[0]?.kind === 'advance', `${label} history advance first`)
  assert(rest.value.history[1]?.kind === 'salary', `${label} history salary`)

  const salaryExpenses = salaryExpenseTotalForPeriod(
    persistence,
    owner.organizationId,
    period,
  )
  assert(salaryExpenses === 250_000, `${label} salary expense once`)
  const listed = listExpensesForUser(persistence, owner)
  assert(listed.ok, `${label} expenses list`)
  const payrollExpenses = listed.value.filter(
    (item) => item.compensationId === rest.value.compensationId,
  )
  assert(payrollExpenses.length === 1, `${label} one linked expense`)
  assert(payrollExpenses[0]?.amount === 250_000, `${label} expense amount`)

  const overpay = createEmployeeAdvanceForUser(
    persistence,
    owner,
    employee.id,
    1,
    period,
  )
  assert(!overpay.ok && overpay.error.code === 'PAYMENT_LIMIT_EXCEEDED', `${label} overpay blocked`)

  const october = getEmployeeCompensationForUser(
    persistence,
    owner,
    employee.id,
    '2026-10',
  )
  assert(october.ok && october.value.status === 'none', `${label} october isolated`)
  assert(october.value.remainingAmount === 0, `${label} october remaining`)

  if (withoutAccount) {
    assert(!login(persistence, employee.id).ok, `${label} no login`)
  }
}

export function runEmployeeCompensationChecks(): void {
  const persistence = createInMemoryPersistence()
  const kinder = 'org-comp-kinder'
  const rental = 'org-comp-rental'
  const dental = 'org-comp-dental'
  const other = 'org-comp-other'
  addOrg(persistence, kinder, 'Kinder')
  addOrg(persistence, rental, 'Rental')
  addOrg(persistence, dental, 'Dental')
  addOrg(persistence, other, 'Other')

  const kinderOwner = addUser(persistence, kinder, 'owner')
  const rentalOwner = addUser(persistence, rental, 'owner')
  const dentalOwner = addUser(persistence, dental, 'owner')
  const otherOwner = addUser(persistence, other, 'owner')

  runPayrollScenario(
    persistence,
    kinderOwner,
    ['children', 'attendance', 'crm', 'expenses', 'analytics'],
    'Воспитатель',
    true,
  )
  runPayrollScenario(
    persistence,
    rentalOwner,
    ['rental', 'warehouse', 'crm', 'expenses', 'analytics', 'attendance'],
    'Кладовщик',
    false,
  )
  runPayrollScenario(
    persistence,
    dentalOwner,
    ['sales', 'warehouse', 'crm', 'expenses', 'analytics', 'plans'],
    'Ассистент',
    false,
  )

  seedEnabledBusinessModules(persistence, other, 'seed', ['children', 'attendance', 'crm', 'expenses'])
  const stranger = persistence.users.list(kinder).find((user) => user.role === 'office_employee')
  assert(stranger, 'kinder employee exists')
  const cross = getEmployeeCompensationForUser(
    persistence,
    otherOwner,
    stranger.id,
    '2026-09',
  )
  assert(!cross.ok, 'cross-org compensation denied')

  const staff = persistence.users.list(kinder).find((user) => user.role === 'office_employee')
  assert(staff, 'staff')
  const selfPay = createEmployeeAdvanceForUser(persistence, staff, staff.id, 1_000, '2026-09')
  assert(!selfPay.ok && selfPay.error.code === 'ACCESS_DENIED', 'office employee cannot pay payroll')

  console.log('employee-compensation.verify: ok')
}

runEmployeeCompensationChecks()
