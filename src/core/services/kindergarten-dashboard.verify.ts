import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { markAttendanceForUser } from './attendance'
import { createCareGroupForUser } from './care-groups'
import { createChildForUser } from './children'
import { getCompanyDashboardForUser } from './company-dashboard'
import { createExpenseForUser, todayExpenseDateInput } from './expenses'
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

export function runKindergartenDashboardChecks(): void {
  const persistence = createInMemoryPersistence()
  const org = 'org-kinder-dash'
  addOrg(persistence, org, 'Ясмин')
  persistence.organizations.update(org, { businessTypeId: 'kindergarten' })
  seedEnabledBusinessModules(persistence, org, 'seed', [
    'crm',
    'expenses',
    'analytics',
    'children',
    'attendance',
  ])
  const owner = addUser(persistence, org, 'owner')
  const empty = getCompanyDashboardForUser(persistence, owner)
  assert(empty.ok && empty.value.care, 'care dashboard without fake counts')
  assert(empty.value.care.enrolled === 0, 'empty enrolled is zero not fake')
  assert(empty.value.care.groups.length === 0, 'empty groups state')
  assert(empty.value.care.present === 0 && empty.value.care.absent === 0 && empty.value.care.unmarked === 0, 'empty child attendance is zero')
  assert(empty.value.care.staffEnrolled === 1, 'owner is a staff member')
  assert(empty.value.care.staffPresent === 0, 'no fake staff present')
  assert(empty.value.care.staffAbsent === 0, 'no fake staff absent')
  assert(empty.value.care.staffUnmarked === 1, 'unmarked staff without records')
  assert(empty.value.care.paidAmount === 0, 'empty paid is zero not missing')
  assert(empty.value.care.expenses === 0, 'empty expenses is zero not missing')
  assert(persistence.attendanceRecords.list(org).length === 0, 'no auto-created attendance records')
  assert(!empty.value.sales, 'no sales widget')
  assert(!empty.value.companyPlans, 'plan data is not loaded')
  assert(!empty.value.ownMotivation, 'own plan is not loaded')
  assert(empty.value.quickActions.addChild, 'add child available')
  assert(!empty.value.quickActions.newSale, 'no new sale')
  assert(empty.value.care.applicationsIncluded, 'CRM block when CRM on')
  assert(empty.value.care.expensesIncluded, 'finance included when expenses on')

  const group = createCareGroupForUser(persistence, owner, {
    name: 'Средняя',
    capacity: 10,
    status: 'active',
  })
  assert(group.ok, 'group')
  const child = createChildForUser(persistence, owner, {
    firstName: 'Саша',
    lastName: 'Л',
    birthDate: '2021-01-01',
    groupId: group.value.id,
    status: 'active',
  })
  assert(child.ok, 'child')
  assert(
    markAttendanceForUser(persistence, owner, {
      childId: child.value.id,
      date: todayExpenseDateInput(),
      status: 'present',
    }).ok,
    'child attendance',
  )
  assert(
    createExpenseForUser(persistence, owner, org, {
      category: 'salary',
      description: 'Зарплата',
      amount: 40_000,
      date: todayExpenseDateInput(),
    }).ok,
    'expense',
  )
  const filled = getCompanyDashboardForUser(persistence, owner)
  assert(filled.ok && filled.value.care?.enrolled === 1, 'real enrolled count')
  assert(filled.value.care?.groups[0]?.childCount === 1, 'group occupancy from children')
  assert(filled.value.care?.present === 1, 'child attendance present')
  assert(filled.value.care?.attendanceIncluded, 'child attendance block available')
  assert(filled.value.care?.expenses === 40_000, 'expenses displayed')
  assert(filled.value.care?.paidAmount === 0, 'paid stays real zero without care payments')
  assert(filled.value.care?.paymentsIncluded, 'care payments are readable without sales')
  assert(!filled.value.companyPlans && !filled.value.ownMotivation, 'plans still not loaded')
  assert(filled.value.care.staffEnrolled === 1, 'staff count is org users')
  assert(filled.value.care.staffUnmarked === 1, 'owner still unmarked')
  assert(
    persistence.attendanceRecords.list(org).every((item) => item.childId === child.value.id),
    'only real child mark exists, no fake staff records',
  )

  const teacher = addUser(persistence, org, 'sales_employee', { jobTitle: 'Воспитатель' })
  const cook = addUser(persistence, org, 'office_employee', { jobTitle: 'Повар' })
  assert(
    markAttendanceForUser(persistence, owner, {
      employeeId: teacher.id,
      date: todayExpenseDateInput(),
      status: 'present',
    }).ok,
    'staff present',
  )
  assert(
    markAttendanceForUser(persistence, owner, {
      employeeId: cook.id,
      date: todayExpenseDateInput(),
      status: 'absent',
    }).ok,
    'staff absent',
  )
  const staffDash = getCompanyDashboardForUser(persistence, owner)
  assert(staffDash.ok && staffDash.value.care?.staffEnrolled === 3, 'three org users')
  assert(staffDash.value.care?.staffPresent === 1, 'one staff present')
  assert(staffDash.value.care?.staffAbsent === 1, 'one staff absent')
  assert(staffDash.value.care?.staffUnmarked === 1, 'owner unmarked')
  assert(!staffDash.value.companyPlans, 'kindergarten dashboard still has no plan')

  const crmOff = 'org-kinder-crm-off'
  addOrg(persistence, crmOff, 'Сад без CRM')
  seedEnabledBusinessModules(persistence, crmOff, 'seed', [
    'expenses',
    'children',
    'attendance',
  ])
  const crmOffOwner = addUser(persistence, crmOff, 'owner')
  const crmOffDash = getCompanyDashboardForUser(persistence, crmOffOwner)
  assert(crmOffDash.ok && crmOffDash.value.care, 'care dashboard without CRM')
  assert(!crmOffDash.value.care.applicationsIncluded, 'CRM block hidden when CRM off')

  const financeOff = 'org-kinder-fin-off'
  addOrg(persistence, financeOff, 'Сад без финансов')
  seedEnabledBusinessModules(persistence, financeOff, 'seed', ['crm', 'children', 'attendance'])
  const financeOffOwner = addUser(persistence, financeOff, 'owner')
  const financeOffDash = getCompanyDashboardForUser(persistence, financeOffOwner)
  assert(financeOffDash.ok && financeOffDash.value.care, 'care dashboard without finance')
  assert(!financeOffDash.value.care.expensesIncluded, 'finance hidden when expenses off')

  const childrenOff = 'org-kinder-child-off'
  addOrg(persistence, childrenOff, 'Сад без детей')
  seedEnabledBusinessModules(persistence, childrenOff, 'seed', ['crm', 'expenses', 'attendance'])
  const childrenOffOwner = addUser(persistence, childrenOff, 'owner')
  const childrenOffDash = getCompanyDashboardForUser(persistence, childrenOffOwner)
  assert(childrenOffDash.ok && childrenOffDash.value.care, 'care dashboard without children module')
  assert(!childrenOffDash.value.care.childrenIncluded, 'groups/children hidden when children off')

  const attendanceOff = 'org-kinder-att-off'
  addOrg(persistence, attendanceOff, 'Сад без посещаемости')
  seedEnabledBusinessModules(persistence, attendanceOff, 'seed', ['crm', 'expenses', 'children'])
  const attendanceOffOwner = addUser(persistence, attendanceOff, 'owner')
  const attendanceOffDash = getCompanyDashboardForUser(persistence, attendanceOffOwner)
  assert(attendanceOffDash.ok && attendanceOffDash.value.care, 'care dashboard without attendance')
  assert(!attendanceOffDash.value.care.attendanceIncluded, 'attendance hidden when module off')

  const dental = 'org-dental-reg'
  addOrg(persistence, dental, 'Dental')
  seedEnabledBusinessModules(persistence, dental, 'seed', ['crm', 'sales', 'warehouse', 'analytics'])
  const dentalOwner = addUser(persistence, dental, 'owner')
  const dentalDash = getCompanyDashboardForUser(persistence, dentalOwner)
  assert(dentalDash.ok && !dentalDash.value.care, 'dental is not kindergarten dashboard')
  assert(dentalDash.value.sales, 'dental keeps sales')

  const rental = 'org-rental-reg'
  addOrg(persistence, rental, 'Rental')
  seedEnabledBusinessModules(persistence, rental, 'seed', ['crm', 'rental', 'expenses', 'analytics'])
  const rentalOwner = addUser(persistence, rental, 'owner')
  const rentalDash = getCompanyDashboardForUser(persistence, rentalOwner)
  assert(rentalDash.ok && rentalDash.value.rental, 'rental dashboard stays')
  assert(!rentalDash.value.care, 'rental is not care dashboard')

  console.log('kindergarten-dashboard.verify: ok')
}

runKindergartenDashboardChecks()
