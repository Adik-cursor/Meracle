import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import type { Deal, Id, User, UserRole } from '../types'
import {
  createDealForUser,
  getDealForUser,
  listDealsForUser,
  searchDealsForUser,
} from './deals'
import { getFinancialAnalyticsForUser } from './financial-analytics'
import { listInventoryForUser } from './inventory'
import {
  createCompanyOrganizationForPlatformUser,
  disableModuleForPlatformUser,
  enableModuleForPlatformUser,
  isModuleEnabledForOrganization,
  seedEnabledBusinessModules,
} from './organization-modules'
import { ensureBusinessCatalog } from './business-catalog'
import { listSalesForUser } from './sales'
import { newId, nowIso } from './primitives'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function addUser(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
  extras: { platformRole?: 'platform_owner' } = {},
): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}-${newId()}@${organizationId}.local`,
    firstName: role,
    lastName: organizationId,
    role,
    status: 'active',
    ...extras,
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(user)
  return user
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

const emptyLookup = {
  getContact: () => undefined,
  getCompany: () => undefined,
}

export function runOrganizationModuleChecks(): void {
  const persistence = createInMemoryPersistence()
  ensureBusinessCatalog(persistence)
  const orgA = 'org-a'
  const orgB = 'org-b'
  addOrg(persistence, orgA, 'Dental Shop Kazakhstan')
  addOrg(persistence, orgB, 'Rental Company')

  const platformOwner = addUser(persistence, 'org-platform', 'office_employee', {
    platformRole: 'platform_owner',
  })
  const companyOwner = addUser(persistence, orgA, 'owner')
  const employee = addUser(persistence, orgA, 'sales_employee')
  const foreignOwner = addUser(persistence, orgB, 'owner')

  assert(
    !isModuleEnabledForOrganization(persistence, orgA, 'crm'),
    'missing module config is disabled',
  )

  denied(
    enableModuleForPlatformUser(persistence, companyOwner, orgA, 'crm'),
    'company owner cannot enable',
  )
  denied(
    enableModuleForPlatformUser(persistence, employee, orgA, 'crm'),
    'employee cannot enable',
  )
  denied(
    enableModuleForPlatformUser(persistence, foreignOwner, orgA, 'crm'),
    'foreign owner cannot enable org A',
  )
  denied(
    createCompanyOrganizationForPlatformUser(persistence, companyOwner, {
      name: 'Blocked Co',
      ownerFirstName: 'No',
      ownerLastName: 'Access',
      ownerEmail: 'demo-user-011@example.com',
      enabledModules: ['crm'],
    }),
    'company owner cannot create company',
  )
  denied(
    disableModuleForPlatformUser(persistence, companyOwner, orgA, 'crm'),
    'company owner cannot disable',
  )
  denied(
    disableModuleForPlatformUser(persistence, employee, orgA, 'crm'),
    'employee cannot disable',
  )

  const enabledCrm = enableModuleForPlatformUser(
    persistence,
    platformOwner,
    orgA,
    'crm',
  )
  assert(enabledCrm.ok, 'platform owner enables CRM for A')
  assert(
    isModuleEnabledForOrganization(persistence, orgA, 'crm'),
    'CRM enabled for A',
  )
  assert(
    !isModuleEnabledForOrganization(persistence, orgB, 'crm'),
    'CRM still disabled for B',
  )

  const enabledB = enableModuleForPlatformUser(
    persistence,
    platformOwner,
    orgB,
    'crm',
  )
  assert(enabledB.ok, 'platform owner enables CRM for B')

  seedEnabledBusinessModules(persistence, orgA, platformOwner.id, [
    'sales',
    'warehouse',
    'expenses',
    'analytics',
  ])

  const created = createDealForUser(
    persistence,
    companyOwner,
    orgA,
    {
      title: 'Deal keep',
      amount: 100,
      currency: 'KZT',
      companyId: null,
      contactId: null,
      status: 'new',
      assignedUserId: companyOwner.id,
    },
    emptyLookup,
  )
  assert(created.ok, 'create deal while CRM enabled')
  const deal = created.value as Deal

  const listed = listDealsForUser(persistence, companyOwner)
  assert(listed.ok && listed.value.some((item) => item.id === deal.id), 'owner sees deal')

  const employeeList = listDealsForUser(persistence, employee)
  assert(employeeList.ok, 'employee CRM list while enabled')

  const disabled = disableModuleForPlatformUser(
    persistence,
    platformOwner,
    orgA,
    'crm',
  )
  assert(disabled.ok, 'platform owner disables CRM')

  denied(listDealsForUser(persistence, companyOwner), 'owner deals closed')
  denied(listDealsForUser(persistence, employee), 'employee deals closed')
  denied(getDealForUser(persistence, companyOwner, deal.id), 'direct deal id closed')
  denied(
    searchDealsForUser(persistence, companyOwner, 'Deal', emptyLookup),
    'search closed',
  )

  const reenabled = enableModuleForPlatformUser(
    persistence,
    platformOwner,
    orgA,
    'crm',
  )
  assert(reenabled.ok, 'CRM re-enabled')
  const restored = getDealForUser(persistence, companyOwner, deal.id)
  assert(restored.ok && restored.value.id === deal.id, 'deal data remains')

  const salesOff = disableModuleForPlatformUser(
    persistence,
    platformOwner,
    orgA,
    'sales',
  )
  assert(salesOff.ok, 'sales off')
  denied(listSalesForUser(persistence, companyOwner), 'sales list closed')
  const salesOn = enableModuleForPlatformUser(
    persistence,
    platformOwner,
    orgA,
    'sales',
  )
  assert(salesOn.ok, 'sales on')
  const salesListed = listSalesForUser(persistence, companyOwner)
  assert(salesListed.ok, 'sales list after enable')

  const warehouse = persistence.warehouses.create({
    id: newId(),
    organizationId: orgA,
    name: 'WH A',
    status: 'active',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    branchId: newId(),
  })
  const warehouseOff = disableModuleForPlatformUser(
    persistence,
    platformOwner,
    orgA,
    'warehouse',
  )
  assert(warehouseOff.ok, 'warehouse off')
  denied(
    listInventoryForUser(persistence, companyOwner, warehouse.id),
    'inventory closed',
  )
  assert(
    enableModuleForPlatformUser(persistence, platformOwner, orgA, 'warehouse').ok,
    'warehouse on',
  )

  const analyticsOff = disableModuleForPlatformUser(
    persistence,
    platformOwner,
    orgA,
    'analytics',
  )
  assert(analyticsOff.ok, 'analytics off')
  const analyticsDenied = getFinancialAnalyticsForUser(
    persistence,
    companyOwner,
    { from: '2026-01-01', to: '2026-12-31' },
  )
  assert(
    !analyticsDenied.ok && analyticsDenied.error.code === 'MODULE_NOT_ENABLED',
    'analytics closed',
  )
  assert(
    enableModuleForPlatformUser(persistence, platformOwner, orgA, 'analytics')
      .ok,
    'analytics on',
  )

  const createdCompany = createCompanyOrganizationForPlatformUser(
    persistence,
    platformOwner,
    {
      name: 'Live Shop',
      ownerFirstName: 'New',
      ownerLastName: 'Owner',
      ownerEmail: 'demo-user-033@example.com',
      enabledModules: ['crm', 'sales', 'expenses', 'analytics'],
    },
  )
  assert(createdCompany.ok, 'platform creates company')
  assert(createdCompany.value.organization.name === 'Live Shop', 'company name')
  assert(createdCompany.value.owner?.email === 'demo-user-033@example.com', 'owner created')
  assert(
    isModuleEnabledForOrganization(
      persistence,
      createdCompany.value.organization.id,
      'crm',
    ),
    'created CRM on',
  )
  assert(
    !isModuleEnabledForOrganization(
      persistence,
      createdCompany.value.organization.id,
      'warehouse',
    ),
    'created warehouse off',
  )

  console.log('organization-modules.verify: ok')
}

function denied(
  result: { ok: boolean; error?: { code?: string } },
  message: string,
): void {
  assert(
    !result.ok &&
      (result.error?.code === 'ACCESS_DENIED' ||
        result.error?.code === 'MODULE_NOT_ENABLED'),
    message,
  )
}

runOrganizationModuleChecks()
