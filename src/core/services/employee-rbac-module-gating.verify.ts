import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { capabilitiesForModules } from '../../modules/company/permission-ui'
import {
  assignableEmployeeRolesForModules,
  createUserForUser,
  listUsersForUser,
} from './users'
import { isEmployeeRoleAvailableForModules } from './module-access'
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

export function runEmployeeRbacModuleGatingChecks(): void {
  const kinderModules = {
    sales: false,
    warehouses: false,
    children: true,
    attendance: true,
    rental: false,
    expenses: true,
    analytics: true,
    plans: false,
    crm: true,
  }
  const rentalModules = {
    sales: false,
    warehouses: true,
    children: false,
    rental: true,
    expenses: true,
    analytics: true,
    plans: false,
    crm: true,
  }
  const dentalModules = {
    sales: true,
    warehouses: true,
    children: false,
    rental: false,
    expenses: true,
    analytics: true,
    plans: true,
    crm: true,
  }
  const universalModules = {
    sales: false,
    warehouses: false,
    children: false,
    rental: false,
    expenses: true,
    crm: true,
  }

  assert(!isEmployeeRoleAvailableForModules('owner', kinderModules), 'owner is not an employee option')
  assert(!isEmployeeRoleAvailableForModules('sales_employee', kinderModules), 'kindergarten hides sales employee')
  assert(!isEmployeeRoleAvailableForModules('commercial_director', kinderModules), 'kindergarten hides commercial director')
  assert(!isEmployeeRoleAvailableForModules('branch_director', kinderModules), 'kindergarten hides branch director')
  assert(!isEmployeeRoleAvailableForModules('warehouse_manager', kinderModules), 'kindergarten hides warehouse manager')
  assert(isEmployeeRoleAvailableForModules('office_employee', kinderModules), 'kindergarten keeps office profile')
  assert(isEmployeeRoleAvailableForModules('accountant', kinderModules), 'kindergarten keeps accountant')
  assert(isEmployeeRoleAvailableForModules('kindergarten_admin', kinderModules), 'kindergarten admin available')

  assert(!isEmployeeRoleAvailableForModules('sales_employee', rentalModules), 'rental sales OFF hides sales roles')
  assert(isEmployeeRoleAvailableForModules('warehouse_manager', rentalModules), 'rental warehouse role available')
  assert(!isEmployeeRoleAvailableForModules('kindergarten_admin', rentalModules), 'rental has no kindergarten admin')

  assert(isEmployeeRoleAvailableForModules('sales_employee', dentalModules), 'dental sales roles available')
  assert(isEmployeeRoleAvailableForModules('warehouse_manager', dentalModules), 'dental warehouse role available')
  assert(!isEmployeeRoleAvailableForModules('kindergarten_admin', dentalModules), 'dental has no kindergarten admin')

  assert(!isEmployeeRoleAvailableForModules('sales_employee', universalModules), 'universal sales OFF')
  assert(!isEmployeeRoleAvailableForModules('warehouse_manager', universalModules), 'universal warehouse OFF')

  const kinderCaps = capabilitiesForModules(kinderModules)
  assert(
    !kinderCaps.some((item) => item.group === 'sales'),
    'Sales OFF hides sales permissions',
  )
  assert(
    !kinderCaps.some((item) => item.group === 'warehouse'),
    'Warehouse OFF hides warehouse permissions',
  )
  const rentalCaps = capabilitiesForModules(rentalModules)
  assert(!rentalCaps.some((item) => item.group === 'sales'), 'rental sales permissions hidden')
  assert(rentalCaps.some((item) => item.group === 'warehouse'), 'rental warehouse permissions shown')

  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-rbac-k', 'Сад')
  addOrg(persistence, 'org-rbac-r', 'Прокат')
  seedEnabledBusinessModules(persistence, 'org-rbac-k', 'seed', [
    'children',
    'attendance',
    'crm',
    'expenses',
    'analytics',
  ])
  seedEnabledBusinessModules(persistence, 'org-rbac-r', 'seed', [
    'rental',
    'warehouse',
    'crm',
    'expenses',
    'analytics',
  ])
  const ownerK = addUser(persistence, 'org-rbac-k', 'owner')
  const ownerR = addUser(persistence, 'org-rbac-r', 'owner')

  const kinderRoles = assignableEmployeeRolesForModules(ownerK, kinderModules)
  assert(!kinderRoles.includes('owner'), 'owner uniqueness: not in employee dropdown')
  assert(!kinderRoles.includes('sales_employee'), 'kindergarten dropdown has no sales employee')
  assert(kinderRoles.includes('office_employee'), 'kindergarten dropdown has office profile')

  const deniedSales = createUserForUser(persistence, ownerK, 'org-rbac-k', {
    firstName: 'Сауда',
    lastName: 'Қызмет',
    email: 'demo-user-045@example.com',
    role: 'sales_employee',
    status: 'active',
    jobTitle: 'Воспитатель',
  })
  assert(!deniedSales.ok && deniedSales.error.code === 'ACCESS_DENIED', 'service denies sales role when sales OFF')

  const secondOwner = createUserForUser(persistence, ownerK, 'org-rbac-k', {
    firstName: 'Екінші',
    lastName: 'Ие',
    email: 'demo-user-043@example.com',
    role: 'owner',
    status: 'active',
  })
  assert(!secondOwner.ok && secondOwner.error.code === 'ACCESS_DENIED', 'second owner rejected')

  const educator = createUserForUser(persistence, ownerK, 'org-rbac-k', {
    firstName: 'Айдана',
    lastName: 'Каримова',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Повар',
    accountEnabled: false,
  })
  assert(educator.ok && educator.value.accountEnabled === false, 'accountEnabled false preserved')
  assert(educator.value.role === 'office_employee', 'role preserved without account')
  assert(educator.value.jobTitle === 'Повар', 'jobTitle preserved')

  const leaked = createUserForUser(persistence, ownerK, 'org-rbac-r', {
    firstName: 'Чужой',
    lastName: 'Сотрудник',
    email: 'demo-user-055@example.com',
    role: 'office_employee',
    status: 'active',
  })
  assert(!leaked.ok, 'cannot create employee in another organization')

  const listedK = listUsersForUser(persistence, ownerK)
  const listedR = listUsersForUser(persistence, ownerR)
  assert(listedK.ok && listedK.value.every((item) => item.organizationId === 'org-rbac-k'), 'employees isolated A')
  assert(listedR.ok && listedR.value.every((item) => item.organizationId === 'org-rbac-r'), 'employees isolated B')

  console.log('employee-rbac-module-gating.verify: ok')
}

runEmployeeRbacModuleGatingChecks()
