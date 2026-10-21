import { defaultModules } from '../../core/config/default-organization'
import type { CarePermission, FinancialPermission, User, UserRole, WarehousePermission } from '../../core/types'
import { getFinancialPermissions } from '../../core/types/financial-permission'
import { getWarehousePermissions } from '../../core/types/warehouse-permission'
import { getCarePermissions } from '../../core/types/care-permission'
import { createInMemoryPersistence } from '../../core/repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../../core/repositories/persistence'
import {
  createExpenseForUser,
  listExpensesForUser,
} from '../../core/services/expenses'
import { getFinancialAnalyticsForUser } from '../../core/services/financial-analytics'
import { seedEnabledBusinessModules } from '../../core/services/organization-modules'
import { newId, nowIso } from '../../core/services/primitives'
import { COMPANY_NAV_PATHS, getVisibleCompanyRoutes, isRouteEnabled } from '../routes/app.routes'
import { getSidebarItems } from './workspace-nav'

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

function accessFor(
  role: UserRole,
  modules = defaultModules,
) {
  const currentUser = user(role)
  const financial = getFinancialPermissions(role)
  const warehouse = getWarehousePermissions(role)
  return {
    currentUser,
    modules,
    hasFinancialAccess: (permission: FinancialPermission) => financial.includes(permission),
    hasWarehouseAccess: (permission: WarehousePermission) => warehouse.includes(permission),
    hasCareAccess: (permission: CarePermission) => getCarePermissions(role).includes(permission),
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

function addUser(
  persistence: Persistence,
  organizationId: string,
  role: UserRole,
): User {
  const now = nowIso()
  const created: User = {
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
  persistence.users.create(created)
  return created
}

export function runPlatformUiIntegrityChecks(): void {
  const dental = getSidebarItems(accessFor('owner')).map((item) => item.id)
  assert(
    JSON.stringify(dental) ===
      JSON.stringify([
        'dashboard',
        'crm',
        'sales',
        'warehouse',
        'finance',
        'company',
        'settings',
      ]),
    '12/19 dental navigation',
  )
  assert(!dental.includes('rental'), '19 rental absent when rental off')

  const rental = getSidebarItems(
    accessFor('owner', { ...defaultModules, sales: false, rental: true }),
  ).map((item) => item.id)
  assert(
    JSON.stringify(rental) ===
      JSON.stringify([
        'dashboard',
        'crm',
        'rental',
        'warehouse',
        'finance',
        'company',
        'settings',
      ]),
    '12 rental company navigation',
  )
  assert(!rental.includes('sales'), '13 sales off hides sales')
  assert(rental.includes('rental'), '14 rental on shows rental')
  assert(rental.includes('warehouse'), '15 warehouse on shows warehouse')
  assert(rental.includes('finance'), '16 finance on shows finance')

  const crmOff = getSidebarItems(
    accessFor('owner', { ...defaultModules, crm: false, sales: false, rental: true }),
  ).map((item) => item.id)
  assert(!crmOff.includes('crm'), '17 crm off hides crm')

  const both = getSidebarItems(
    accessFor('owner', { ...defaultModules, rental: true }),
  ).map((item) => item.id)
  assert(both.includes('sales') && both.includes('rental'), '21 sales+rental both present')

  const companyTabs = getVisibleCompanyRoutes(defaultModules).map((route) => route.path)
  assert(companyTabs[0] === '/company', '9 primary company route')
  assert(!companyTabs.includes('/company/organization'), '8 no duplicate organization tab')
  assert(
    COMPANY_NAV_PATHS.filter((path) => path === '/company/organization').length === 0,
    '8 organization is not a user nav item',
  )
  const orgRoute = {
    path: '/company/organization' as const,
    labelKey: 'navOrganization' as const,
    module: 'crm' as const,
    enabled: true,
  }
  assert(isRouteEnabled(orgRoute, defaultModules), '10 compatibility route still exists')

  const persistence = createInMemoryPersistence()
  const orgA = 'org-ui-a'
  const orgB = 'org-ui-b'
  addOrg(persistence, orgA, 'A')
  addOrg(persistence, orgB, 'B')
  const ownerA = addUser(persistence, orgA, 'owner')
  const ownerB = addUser(persistence, orgB, 'owner')
  const employeeA = addUser(persistence, orgA, 'sales_employee')
  seedEnabledBusinessModules(persistence, orgA, ownerA.id, [
    'expenses',
    'analytics',
    'sales',
  ])
  seedEnabledBusinessModules(persistence, orgB, ownerB.id, ['expenses', 'analytics'])

  const created = createExpenseForUser(persistence, ownerA, orgA, {
    category: 'rent',
    description: 'E2E расход',
    amount: 50_000,
    date: nowIso().slice(0, 10),
    comment: 'E2E расход',
  })
  assert(created.ok, '1 expense create service')
  assert(persistence.expenses.getById(created.value.id)?.amount === 50_000, '2 expense saved')

  const listed = listExpensesForUser(persistence, ownerA)
  assert(listed.ok && listed.value.some((item) => item.id === created.value.id), '3 expense read')

  const snapshot = persistence.capture()
  snapshot.restore()
  assert(
    persistence.expenses.getById(created.value.id)?.description === 'E2E расход',
    '4 expense survives capture/restore (F5 persistence)',
  )

  const listedB = listExpensesForUser(persistence, ownerB)
  assert(listedB.ok && listedB.value.every((item) => item.id !== created.value.id), '5 org isolation')

  const denied = createExpenseForUser(persistence, employeeA, orgA, {
    category: 'rent',
    description: 'blocked',
    amount: 10,
    date: nowIso().slice(0, 10),
  })
  assert(!denied.ok && denied.error.code === 'ACCESS_DENIED', '6 permission enforcement')

  const analytics = getFinancialAnalyticsForUser(persistence, ownerA, {
    from: '2000-01-01T00:00:00.000Z',
    to: '2099-01-01T00:00:00.000Z',
  })
  assert(analytics.ok && analytics.value.kpis.expenses === 50_000, '7 analytics includes expense')

  const spoof = createExpenseForUser(persistence, ownerA, orgB, {
    category: 'rent',
    description: 'spoof',
    amount: 1,
    date: nowIso().slice(0, 10),
  })
  assert(!spoof.ok && spoof.error.code === 'ACCESS_DENIED', '11 orgId from actor, not foreign payload')

  console.log('platform-ui-integrity.verify: ok')
}

runPlatformUiIntegrityChecks()
