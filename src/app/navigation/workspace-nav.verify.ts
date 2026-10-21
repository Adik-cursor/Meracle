import { defaultModules } from '../../core/config/default-organization'
import type { CarePermission, FinancialPermission, User, UserRole, WarehousePermission } from '../../core/types'
import { getFinancialPermissions } from '../../core/types/financial-permission'
import { getWarehousePermissions } from '../../core/types/warehouse-permission'
import { getCarePermissions } from '../../core/types/care-permission'
import { getSidebarItems } from './workspace-nav'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function user(role: UserRole): User {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    id: role,
    organizationId: 'org-runtime',
    email: `${role}@local`,
    firstName: role,
    lastName: 'User',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
}

function accessFor(role: UserRole) {
  const currentUser = user(role)
  const financial = getFinancialPermissions(role)
  const warehouse = getWarehousePermissions(role)
  return {
    currentUser,
    modules: { ...defaultModules },
    hasFinancialAccess: (permission: FinancialPermission) => financial.includes(permission),
    hasWarehouseAccess: (permission: WarehousePermission) => warehouse.includes(permission),
    hasCareAccess: (permission: CarePermission) => getCarePermissions(role).includes(permission),
  }
}

export function runWorkspaceNavChecks(): void {
  const ownerItems = getSidebarItems(accessFor('owner')).map((item) => item.id)
  assert(
    JSON.stringify(ownerItems) ===
      JSON.stringify([
        'dashboard',
        'crm',
        'sales',
        'warehouse',
        'finance',
        'company',
        'settings',
      ]),
    'dental-style sidebar order with sales on and rental off',
  )
  assert(!ownerItems.includes('rental'), 'rental hidden when module off')

  const employeeItems = getSidebarItems(accessFor('sales_employee')).map((item) => item.id)
  assert(employeeItems.includes('dashboard'), 'employee dashboard')
  assert(employeeItems.includes('crm'), 'employee crm')
  assert(employeeItems.includes('sales'), 'employee sales')
  assert(employeeItems.includes('warehouse'), 'employee warehouse catalog access')
  assert(!employeeItems.includes('finance'), 'employee no finance without expenses.read')
  assert(!employeeItems.includes('company'), 'employee no company section')

  const managerItems = getSidebarItems(accessFor('sales_manager')).map((item) => item.id)
  assert(managerItems.includes('company'), 'manager company')
  assert(managerItems.includes('finance'), 'manager finance via expenses.read')

  const directorItems = getSidebarItems(accessFor('branch_director')).map((item) => item.id)
  assert(directorItems.includes('company'), 'director company')
  assert(directorItems.includes('finance'), 'director finance')

  const crmOff = getSidebarItems({
    ...accessFor('owner'),
    modules: { ...defaultModules, crm: false },
  }).map((item) => item.id)
  assert(!crmOff.includes('crm'), 'disabled CRM is absent from sidebar')

  const salesOff = getSidebarItems({
    ...accessFor('owner'),
    modules: { ...defaultModules, sales: false },
  }).map((item) => item.id)
  assert(!salesOff.includes('sales'), 'disabled sales is absent from sidebar')

  const rentalOn = getSidebarItems({
    ...accessFor('owner'),
    modules: { ...defaultModules, rental: true },
  }).map((item) => item.id)
  assert(rentalOn.includes('rental'), 'rental visible when module on')

  const rentalCompany = getSidebarItems({
    ...accessFor('owner'),
    modules: { ...defaultModules, rental: true, sales: false },
  }).map((item) => item.id)
  assert(
    JSON.stringify(rentalCompany) ===
      JSON.stringify([
        'dashboard',
        'crm',
        'rental',
        'warehouse',
        'finance',
        'company',
        'settings',
      ]),
    'rental company sidebar order',
  )
  assert(!rentalCompany.includes('sales'), 'rental company hides sales when sales off')

  const both = getSidebarItems({
    ...accessFor('owner'),
    modules: { ...defaultModules, rental: true, sales: true },
  }).map((item) => item.id)
  assert(both.includes('sales') && both.includes('rental'), 'sales+rental both present')
  assert(both.indexOf('sales') < both.indexOf('rental'), 'sales before rental')
  assert(both.indexOf('rental') < both.indexOf('warehouse'), 'rental before warehouse')
  assert(both.indexOf('warehouse') < both.indexOf('finance'), 'warehouse before finance')
  assert(both.indexOf('finance') < both.indexOf('company'), 'finance before company')

  const kindergarten = getSidebarItems({
    ...accessFor('owner'),
    modules: {
      ...defaultModules,
      sales: false,
      warehouses: false,
      rental: false,
      children: true,
      attendance: true,
    },
  }).map((item) => item.id)
  assert(
    JSON.stringify(kindergarten) ===
      JSON.stringify([
        'dashboard',
        'crm',
        'children',
        'attendance',
        'finance',
        'company',
        'settings',
      ]),
    'kindergarten sidebar order',
  )
  assert(!kindergarten.includes('sales'), 'kindergarten hides sales')
  assert(!kindergarten.includes('rental'), 'kindergarten hides rental')
  assert(!kindergarten.includes('warehouse'), 'kindergarten hides warehouse')
  assert(!kindergarten.includes('packages'), 'kindergarten hides packages')
  assert(!kindergarten.includes('analytics'), 'kindergarten has no analytics sidebar item')

  const kindergartenFinance = getSidebarItems({
    ...accessFor('owner'),
    modules: {
      ...defaultModules,
      sales: false,
      warehouses: false,
      rental: false,
      expenses: false,
      children: true,
      attendance: true,
    },
  }).map((item) => item.id)
  assert(kindergartenFinance.includes('finance'), 'children module shows finance without expenses')

  const kindergartenWarehouse = getSidebarItems({
    ...accessFor('warehouse_manager'),
    modules: {
      ...defaultModules,
      sales: false,
      warehouses: false,
      rental: false,
      expenses: false,
      children: true,
      attendance: true,
    },
  }).map((item) => item.id)
  assert(!kindergartenWarehouse.includes('finance'), 'warehouse without children.read has no kindergarten finance')

  const platformOwner = getSidebarItems({
    ...accessFor('owner'),
    currentUser: { ...user('owner'), platformRole: 'platform_owner' },
  }).map((item) => item.id)
  assert(
    JSON.stringify(platformOwner) ===
      JSON.stringify(['platform-dashboard', 'platform-companies', 'platform-log', 'settings']),
    'platform owner sidebar is platform workspace only',
  )
  assert(!platformOwner.includes('sales'), 'platform owner has no sales')
  assert(!platformOwner.includes('crm'), 'platform owner has no company CRM')
  assert(!platformOwner.includes('warehouse'), 'platform owner has no warehouse')
  assert(!platformOwner.includes('children'), 'platform owner has no children')
  assert(!platformOwner.includes('attendance'), 'platform owner has no attendance')
  assert(!platformOwner.includes('finance'), 'platform owner has no finance')
  assert(!platformOwner.includes('rental'), 'platform owner has no rental')

  console.log('workspace-nav.verify: ok')
}

runWorkspaceNavChecks()
