import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { createChildForUser } from './children'
import { createCareGroupForUser } from './care-groups'
import {
  getCompanyDashboardForUser,
  resolveDashboardSections,
  type DashboardSectionFlags,
} from './company-dashboard'
import { navModulesForOrganization, seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function addOrg(persistence: Persistence, id: Id, name: string, businessTypeId?: string): void {
  const now = nowIso()
  persistence.organizations.create({
    id,
    organizationId: id,
    name,
    status: 'active',
    businessTypeId,
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

function flagsOf(persistence: Persistence, organizationId: Id): DashboardSectionFlags {
  return resolveDashboardSections(navModulesForOrganization(persistence, organizationId))
}

function structureKey(flags: DashboardSectionFlags): string {
  return [
    flags.sales,
    flags.rental,
    flags.children,
    flags.attendance,
    flags.expenses,
    flags.warehouse,
    flags.crm,
    flags.plans,
    flags.analytics,
  ].map((on) => (on ? '1' : '0')).join('')
}

export function runDashboardCompositionChecks(): void {
  const persistence = createInMemoryPersistence()

  const rentalKeys = ['crm', 'warehouse', 'expenses', 'analytics', 'rental'] as const
  addOrg(persistence, 'org-rent-a', 'Rental A', 'rental')
  addOrg(persistence, 'org-rent-b', 'Rental B', 'rental')
  addOrg(persistence, 'org-rent-c', 'Rental C', 'universal')
  seedEnabledBusinessModules(persistence, 'org-rent-a', 'seed', rentalKeys)
  seedEnabledBusinessModules(persistence, 'org-rent-b', 'seed', rentalKeys)
  seedEnabledBusinessModules(persistence, 'org-rent-c', 'seed', rentalKeys)
  const rentA = addUser(persistence, 'org-rent-a', 'owner')
  const rentB = addUser(persistence, 'org-rent-b', 'owner')
  const rentC = addUser(persistence, 'org-rent-c', 'owner')

  assert(
    structureKey(flagsOf(persistence, 'org-rent-a')) ===
      structureKey(flagsOf(persistence, 'org-rent-b')) &&
      structureKey(flagsOf(persistence, 'org-rent-b')) ===
        structureKey(flagsOf(persistence, 'org-rent-c')),
    'same module config yields the same dashboard section flags',
  )
  assert(flagsOf(persistence, 'org-rent-a').rental, 'rental section follows rental module')
  assert(!flagsOf(persistence, 'org-rent-a').children, 'rental config does not force children')
  assert(!flagsOf(persistence, 'org-rent-a').sales, 'rental config does not force sales')

  const dashA = getCompanyDashboardForUser(persistence, rentA)
  const dashB = getCompanyDashboardForUser(persistence, rentB)
  const dashC = getCompanyDashboardForUser(persistence, rentC)
  assert(dashA.ok && dashB.ok && dashC.ok, 'rental dashboards load')
  assert(dashA.value.rental && dashB.value.rental && dashC.value.rental, 'rental view follows module')
  assert(!dashA.value.care && !dashB.value.care && !dashC.value.care, 'rental orgs do not get care view')
  assert(!dashA.value.sales && !dashB.value.sales && !dashC.value.sales, 'sales view follows sales module off')

  const kinderKeys = ['crm', 'expenses', 'analytics', 'children', 'attendance'] as const
  addOrg(persistence, 'org-kinder-a', 'Сад Север', 'kindergarten')
  addOrg(persistence, 'org-kinder-b', 'Сад Юг', 'kindergarten')
  seedEnabledBusinessModules(persistence, 'org-kinder-a', 'seed', kinderKeys)
  seedEnabledBusinessModules(persistence, 'org-kinder-b', 'seed', kinderKeys)
  const kinderOwnerA = addUser(persistence, 'org-kinder-a', 'owner')
  const kinderOwnerB = addUser(persistence, 'org-kinder-b', 'owner')
  const group = createCareGroupForUser(persistence, kinderOwnerA, {
    name: 'Старшая',
    capacity: 8,
    status: 'active',
  })
  assert(group.ok, 'group in org A')
  const child = createChildForUser(persistence, kinderOwnerA, {
    firstName: 'Мира',
    lastName: 'К',
    birthDate: '2020-05-01',
    groupId: group.value.id,
    status: 'active',
  })
  assert(child.ok, 'child in org A')

  assert(
    structureKey(flagsOf(persistence, 'org-kinder-a')) ===
      structureKey(flagsOf(persistence, 'org-kinder-b')),
    'two kindergartens with the same modules share dashboard structure',
  )
  const kinderDashA = getCompanyDashboardForUser(persistence, kinderOwnerA)
  const kinderDashB = getCompanyDashboardForUser(persistence, kinderOwnerB)
  assert(kinderDashA.ok && kinderDashB.ok, 'kindergarten dashboards load')
  assert(kinderDashA.value.care && kinderDashB.value.care, 'care view follows children/attendance modules')
  assert(
    kinderDashA.value.care.childrenIncluded && kinderDashB.value.care.childrenIncluded,
    'children section included from module config',
  )
  assert(kinderDashA.value.care.enrolled === 1, 'org A care data is org-local')
  assert(kinderDashB.value.care.enrolled === 0, 'org B care data stays empty')
  assert(!kinderDashA.value.sales && !kinderDashA.value.rental, 'kindergarten config does not force sales/rental')

  addOrg(persistence, 'org-dental', 'Dental Clinic', 'dental')
  seedEnabledBusinessModules(persistence, 'org-dental', 'seed', [
    'crm',
    'sales',
    'warehouse',
    'analytics',
  ])
  const dentalOwner = addUser(persistence, 'org-dental', 'owner')
  const dentalDash = getCompanyDashboardForUser(persistence, dentalOwner)
  assert(dentalDash.ok && dentalDash.value.sales, 'dental sales section follows sales module')
  assert(!dentalDash.value.care, 'dental without children/attendance is not a care dashboard')
  assert(!dentalDash.value.rental, 'dental without rental is not a rental dashboard')
  assert(
    structureKey(flagsOf(persistence, 'org-dental')) !==
      structureKey(flagsOf(persistence, 'org-kinder-a')),
    'different module configs produce different dashboard structures',
  )

  addOrg(persistence, 'org-named-kinder', 'Детский сад', 'kindergarten')
  seedEnabledBusinessModules(persistence, 'org-named-kinder', 'seed', [
    'crm',
    'sales',
    'warehouse',
    'analytics',
  ])
  const namedOwner = addUser(persistence, 'org-named-kinder', 'owner')
  const namedDash = getCompanyDashboardForUser(persistence, namedOwner)
  assert(namedDash.ok && namedDash.value.sales, 'businessType kindergarten without children is not care')
  assert(!namedDash.value.care, 'dashboard ignores company name and businessType after creation')

  addOrg(persistence, 'org-same-type-a', 'Universal A', 'universal')
  addOrg(persistence, 'org-same-type-b', 'Universal B', 'universal')
  seedEnabledBusinessModules(persistence, 'org-same-type-a', 'seed', ['crm', 'sales', 'plans'])
  seedEnabledBusinessModules(persistence, 'org-same-type-b', 'seed', ['crm', 'rental', 'expenses'])
  const uniA = addUser(persistence, 'org-same-type-a', 'owner')
  const uniB = addUser(persistence, 'org-same-type-b', 'owner')
  assert(
    structureKey(flagsOf(persistence, 'org-same-type-a')) !==
      structureKey(flagsOf(persistence, 'org-same-type-b')),
    'same businessType with different modules yields different dashboards',
  )
  const uniDashA = getCompanyDashboardForUser(persistence, uniA)
  const uniDashB = getCompanyDashboardForUser(persistence, uniB)
  assert(uniDashA.ok && uniDashA.value.sales && !uniDashA.value.rental, 'universal A follows sales modules')
  assert(uniDashB.ok && uniDashB.value.rental && !uniDashB.value.sales, 'universal B follows rental modules')

  addOrg(persistence, 'org-mixed', 'Rental plus children', 'rental')
  seedEnabledBusinessModules(persistence, 'org-mixed', 'seed', [
    'rental',
    'children',
    'attendance',
    'expenses',
  ])
  const mixedOwner = addUser(persistence, 'org-mixed', 'owner')
  const mixedDash = getCompanyDashboardForUser(persistence, mixedOwner)
  assert(mixedDash.ok && mixedDash.value.rental && mixedDash.value.care, 'mixed config composes rental and care')
  assert(flagsOf(persistence, 'org-mixed').rental && flagsOf(persistence, 'org-mixed').children, 'mixed flags')

  const attendanceOnly = 'org-att-only'
  addOrg(persistence, attendanceOnly, 'Staff attendance', 'dental')
  seedEnabledBusinessModules(persistence, attendanceOnly, 'seed', ['attendance', 'crm', 'sales'])
  const attOwner = addUser(persistence, attendanceOnly, 'owner')
  const attDash = getCompanyDashboardForUser(persistence, attOwner)
  assert(attDash.ok && attDash.value.care, 'attendance module still composes care staff block')
  assert(!attDash.value.care.childrenIncluded, 'staff attendance does not invent children KPIs')
  assert(attDash.value.care.attendanceIncluded, 'staff attendance follows attendance module')
  assert(attDash.value.sales, 'dental plus attendance keeps sales')

  const plansOff = 'org-plans-toggle'
  addOrg(persistence, plansOff, 'Plans off', 'universal')
  seedEnabledBusinessModules(persistence, plansOff, 'seed', ['crm', 'sales', 'warehouse'])
  const plansOwner = addUser(persistence, plansOff, 'owner')
  const plansDash = getCompanyDashboardForUser(persistence, plansOwner)
  assert(plansDash.ok && !plansDash.value.companyPlans, 'Plans OFF hides plan sections')
  assert(flagsOf(persistence, plansOff).plans === false, 'plans flag off')

  const financeOff = 'org-fin-toggle'
  addOrg(persistence, financeOff, 'Finance off', 'universal')
  seedEnabledBusinessModules(persistence, financeOff, 'seed', ['crm', 'sales'])
  assert(flagsOf(persistence, financeOff).expenses === false, 'Finance OFF hides finance flag')

  const snap = persistence.capture()
  snap.restore()
  const persisted = getCompanyDashboardForUser(persistence, rentA)
  assert(
    flagsOf(persistence, 'org-rent-a').rental &&
      persisted.ok &&
      persisted.value.rental,
    'F5 persistence keeps rental dashboard structure',
  )

  console.log('dashboard-composition.verify: ok')
}

runDashboardCompositionChecks()
