import { defaultModules } from '../../core/config/default-organization'
import type { CarePermission, FinancialPermission, User, UserRole, WarehousePermission } from '../../core/types'
import { getCarePermissions } from '../../core/types/care-permission'
import { getFinancialPermissions } from '../../core/types/financial-permission'
import { getWarehousePermissions } from '../../core/types/warehouse-permission'
import { createInMemoryPersistence } from '../../core/repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../../core/repositories/persistence'
import {
  isModuleEnabledForOrganization,
  listCompanyMotivationPlansForUser,
  seedEnabledBusinessModules,
} from '../../core/services'
import { navModulesForOrganization } from '../../core/services/organization-modules'
import { newId, nowIso } from '../../core/services/primitives'
import { getVisibleCompanyRoutes, isRouteEnabled } from '../routes/app.routes'
import { filterCompanyWorkspaceRoutes, getSidebarItems } from './workspace-nav'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function user(role: UserRole, organizationId = 'org-runtime'): User {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    id: `${organizationId}-${role}`,
    organizationId,
    email: `${role}@${organizationId}.local`,
    firstName: role,
    lastName: 'User',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
}

function addOrg(persistence: Persistence, id: string, name: string): void {
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

function addUser(persistence: Persistence, organizationId: string, role: UserRole): User {
  const now = nowIso()
  const created: User = {
    id: newId(),
    organizationId,
    email: `${role}-${newId()}@${organizationId}.local`,
    firstName: role,
    lastName: organizationId,
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(created)
  return created
}

function accessFor(
  role: UserRole,
  modules = defaultModules,
) {
  const currentUser = user(role)
  return {
    currentUser,
    modules,
    hasFinancialAccess: (permission: FinancialPermission) =>
      getFinancialPermissions(role).includes(permission),
    hasWarehouseAccess: (permission: WarehousePermission) =>
      getWarehousePermissions(role).includes(permission),
    hasCareAccess: (permission: CarePermission) => getCarePermissions(role).includes(permission),
  }
}

export function runKindergartenCompanyNavigationChecks(): void {
  const kinderModules = {
    ...defaultModules,
    sales: false,
    warehouses: false,
    rental: false,
    children: true,
    attendance: true,
    plans: false,
    expenses: true,
  }

  const kinderTabs = getVisibleCompanyRoutes(kinderModules).map((route) => route.path)
  assert(!kinderTabs.includes('/company/plans'), '1 Plans tab hidden when plans OFF')
  assert(!kinderTabs.includes('/company/departments'), 'kindergarten hides departments tab')
  assert(kinderTabs.includes('/company/employees'), 'employees remain')

  const kinderOwner = user('owner')
  const kinderNav = filterCompanyWorkspaceRoutes(
    kinderModules,
    kinderOwner,
    (permission) => getFinancialPermissions('owner').includes(permission),
  ).map((route) => route.path)
  assert(!kinderNav.includes('/company/plans'), '1 filter hides Plans')

  const plansRoute = {
    path: '/company/plans' as const,
    labelKey: 'dashboardPlans' as const,
    module: 'crm' as const,
    enabled: true,
  }
  assert(!isRouteEnabled(plansRoute, kinderModules), '2 /company/plans route disabled')
  assert(isRouteEnabled(plansRoute, defaultModules), '5 Plans ON keeps route')

  const dentalTabs = getVisibleCompanyRoutes(defaultModules).map((route) => route.path)
  assert(dentalTabs.includes('/company/plans'), '5 dental default still has Plans')
  assert(dentalTabs.includes('/company/departments'), '6 dental keeps departments')
  assert(dentalTabs.includes('/company/branches'), '6 dental keeps branches')

  const rentalModules = { ...defaultModules, rental: true, plans: true }
  const rentalTabs = getVisibleCompanyRoutes(rentalModules).map((route) => route.path)
  assert(rentalTabs.includes('/company/plans'), '6 rental Plans still available')

  const sidebar = getSidebarItems(accessFor('owner', kinderModules)).map((item) => item.id)
  assert(sidebar.includes('finance'), '4 Finance remains available')
  assert(sidebar.includes('company'), 'company remains')
  assert(!sidebar.includes('sales'), '6 kindergarten sales hidden')

  const persistence = createInMemoryPersistence()
  const orgOff = 'org-plans-off'
  const orgOn = 'org-plans-on'
  addOrg(persistence, orgOff, 'Ясмин')
  addOrg(persistence, orgOn, 'Dental Shop')
  seedEnabledBusinessModules(persistence, orgOff, 'seed', [
    'crm',
    'children',
    'attendance',
    'expenses',
    'analytics',
  ])
  seedEnabledBusinessModules(persistence, orgOn, 'seed')
  const ownerOff = addUser(persistence, orgOff, 'owner')
  const ownerOn = addUser(persistence, orgOn, 'owner')

  assert(!isModuleEnabledForOrganization(persistence, orgOff, 'plans'), '1 config plans OFF')
  assert(isModuleEnabledForOrganization(persistence, orgOff, 'expenses'), '4 finance/expenses ON')
  assert(isModuleEnabledForOrganization(persistence, orgOn, 'plans'), '5 dental plans ON')

  const navOff = navModulesForOrganization(persistence, orgOff)
  assert(navOff.plans !== true, '1 navModules plans false')
  assert(navOff.expenses === true, '4 navModules expenses true')
  const navOn = navModulesForOrganization(persistence, orgOn)
  assert(navOn.plans === true, '5 navModules plans true')

  const listedOff = listCompanyMotivationPlansForUser(persistence, ownerOff)
  assert(!listedOff.ok && listedOff.error.code === 'MODULE_NOT_ENABLED', '3 plans data not loaded')

  const listedOn = listCompanyMotivationPlansForUser(persistence, ownerOn)
  assert(listedOn.ok, '5 plans service works when ON')

  const listedCross = listCompanyMotivationPlansForUser(persistence, ownerOff)
  assert(!listedCross.ok, '7 isolation: off-org cannot load plans page data')

  console.log('kindergarten-company-navigation.verify: ok')
}

runKindergartenCompanyNavigationChecks()
