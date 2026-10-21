import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { resolveAnalyticsOverviewBlocks } from './analytics-overview'
import { getCareOperationsSnapshotForUser } from './care-analytics'
import { getFinancialAnalyticsForUser, resolveAnalyticsRange } from './financial-analytics'
import { isModuleEnabledForUser, seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { getRentalAnalyticsForUser } from './rental-analytics'
import { todayExpenseDateInput } from './expenses'

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

function overview(
  modules: Parameters<typeof resolveAnalyticsOverviewBlocks>[0],
  canCare: boolean,
) {
  return resolveAnalyticsOverviewBlocks(modules, {
    canSalesAnalytics: true,
    canExpenseAnalytics: true,
    canRentalAnalytics: true,
    canCareAnalytics: canCare,
  })
}

export function runAnalyticsModuleGatingChecks(): void {
  const kindergarten = overview(
    { sales: false, expenses: true, rental: false, children: true, attendance: true },
    true,
  )
  assert(kindergarten.care && !kindergarten.sales && !kindergarten.rental, 'kindergarten blocks')

  const rental = overview(
    { sales: false, expenses: true, rental: true, children: false, attendance: true },
    true,
  )
  assert(rental.rental && !rental.care && !rental.sales, 'rental has no kindergarten block')

  const dental = overview(
    { sales: true, expenses: true, rental: false, children: false, attendance: true },
    true,
  )
  assert(dental.sales && !dental.care && !dental.rental, 'dental has no kindergarten block')

  const universal = overview(
    { sales: true, expenses: true, rental: false, children: false, attendance: true },
    true,
  )
  assert(!universal.care && universal.sales, 'universal has no kindergarten block')

  const salesOff = overview(
    { sales: false, expenses: true, rental: false, children: false, attendance: false },
    false,
  )
  assert(!salesOff.sales, 'Sales OFF hides sales analytics')

  const rentalOff = overview(
    { sales: true, expenses: true, rental: false, children: false, attendance: false },
    false,
  )
  assert(!rentalOff.rental, 'Rental OFF hides rental analytics')

  const childrenOff = overview(
    { sales: true, expenses: true, rental: false, children: false, attendance: true },
    true,
  )
  assert(!childrenOff.care, 'Children OFF hides children analytics')

  const persistence = createInMemoryPersistence()
  const kinderOrg = 'org-amg-kinder'
  const rentalOrg = 'org-amg-rental'
  const dentalOrg = 'org-amg-dental'
  const universalOrg = 'org-amg-universal'
  addOrg(persistence, kinderOrg, 'Ясмин')
  addOrg(persistence, rentalOrg, 'Rental')
  addOrg(persistence, dentalOrg, 'Dental')
  addOrg(persistence, universalOrg, 'CRM Platform')
  seedEnabledBusinessModules(persistence, kinderOrg, 'seed', [
    'children',
    'attendance',
    'crm',
    'expenses',
    'analytics',
  ])
  seedEnabledBusinessModules(persistence, rentalOrg, 'seed', [
    'rental',
    'crm',
    'expenses',
    'analytics',
    'attendance',
  ])
  seedEnabledBusinessModules(persistence, dentalOrg, 'seed', [
    'sales',
    'warehouse',
    'crm',
    'expenses',
    'analytics',
    'attendance',
  ])
  seedEnabledBusinessModules(persistence, universalOrg, 'seed', [
    'crm',
    'sales',
    'warehouse',
    'expenses',
    'analytics',
    'attendance',
  ])
  const kinderOwner = addUser(persistence, kinderOrg, 'owner')
  const rentalOwner = addUser(persistence, rentalOrg, 'owner')
  const dentalOwner = addUser(persistence, dentalOrg, 'owner')
  const universalOwner = addUser(persistence, universalOrg, 'owner')

  assert(isModuleEnabledForUser(persistence, kinderOwner, 'children'), 'kinder children ON')
  assert(!isModuleEnabledForUser(persistence, rentalOwner, 'children'), 'rental children OFF')
  assert(!isModuleEnabledForUser(persistence, dentalOwner, 'children'), 'dental children OFF')
  assert(!isModuleEnabledForUser(persistence, universalOwner, 'children'), 'universal children OFF')

  const kinderSnap = getCareOperationsSnapshotForUser(
    persistence,
    kinderOwner,
    todayExpenseDateInput(),
  )
  assert(kinderSnap.ok && kinderSnap.value.childrenIncluded, 'kindergarten snapshot includes children')

  const rentalSnap = getCareOperationsSnapshotForUser(
    persistence,
    rentalOwner,
    todayExpenseDateInput(),
  )
  assert(rentalSnap.ok && !rentalSnap.value.childrenIncluded, 'rental snapshot has no children analytics')

  const dentalSnap = getCareOperationsSnapshotForUser(
    persistence,
    dentalOwner,
    todayExpenseDateInput(),
  )
  assert(dentalSnap.ok && !dentalSnap.value.childrenIncluded, 'dental snapshot has no children analytics')

  const universalSnap = getCareOperationsSnapshotForUser(
    persistence,
    universalOwner,
    todayExpenseDateInput(),
  )
  assert(
    universalSnap.ok && !universalSnap.value.childrenIncluded,
    'universal snapshot has no children analytics',
  )

  const range = resolveAnalyticsRange('month', nowIso())
  const rentalAnalytics = getRentalAnalyticsForUser(persistence, rentalOwner, rentalOrg, {
    at: nowIso(),
    range,
  })
  assert(rentalAnalytics.ok, 'rental analytics available')
  const rentalSales = getFinancialAnalyticsForUser(persistence, rentalOwner, range)
  assert(rentalSales.ok && rentalSales.value.kpis.salesCount === 0, 'rental sales KPIs stay empty')

  const analyticsOff = 'org-amg-off'
  addOrg(persistence, analyticsOff, 'No analytics')
  seedEnabledBusinessModules(persistence, analyticsOff, 'seed', ['crm', 'sales'])
  const offOwner = addUser(persistence, analyticsOff, 'owner')
  assert(!isModuleEnabledForUser(persistence, offOwner, 'analytics'), 'analytics module off')

  console.log('analytics-module-gating.verify: ok')
}

runAnalyticsModuleGatingChecks()
