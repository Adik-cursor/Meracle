import { isPlatformModuleKey, PLATFORM_MODULE_KEYS } from '../types/platform-module'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import type { Id, User, UserRole } from '../types'
import type { DomainErrorCode } from '../types/domain-error'
import { DEFAULT_BUSINESS_TEMPLATES, DEFAULT_BUSINESS_TYPES } from '../config/business-catalog'
import { newId, nowIso } from './primitives'
import {
  backfillOrganizationBusinessTypes,
  ensureBusinessCatalog,
  listBusinessTemplatesForPlatformUser,
  listBusinessTypesForPlatformUser,
  recommendedTemplateForBusinessType,
} from './business-catalog'
import {
  createCompanyOrganizationForPlatformUser,
  disableModuleForPlatformUser,
  enableModuleForPlatformUser,
  isModuleEnabledForOrganization,
  seedEnabledBusinessModules,
} from './organization-modules'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function denied(
  result: { ok: boolean; error?: { code: DomainErrorCode } },
  code: DomainErrorCode,
  message: string,
): void {
  assert(!result.ok && result.error?.code === code, message)
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

export function runBusinessTemplateChecks(): void {
  assert(DEFAULT_BUSINESS_TYPES.some((item) => item.id === 'universal'), 'universal type')
  assert(DEFAULT_BUSINESS_TYPES.some((item) => item.id === 'dental'), 'dental type')
  assert(
    DEFAULT_BUSINESS_TEMPLATES.every((template) =>
      template.moduleIds.every((key) => isPlatformModuleKey(key)),
    ),
    'templates use registry module ids',
  )

  const seeded = createInMemoryPersistence()
  assert(seeded.businessTypes.listAll().length === 0, 'catalog empty before seed')
  ensureBusinessCatalog(seeded)
  assert(
    seeded.businessTypes.listAll().length === DEFAULT_BUSINESS_TYPES.length,
    'ensure creates missing types',
  )
  assert(
    seeded.businessTemplates.listAll().length === DEFAULT_BUSINESS_TEMPLATES.length,
    'ensure creates missing templates',
  )

  const persistence = createInMemoryPersistence()
  const orgA = 'org-bt-a'
  const orgB = 'org-bt-b'
  addOrg(persistence, orgA, 'Existing Shop')
  addOrg(persistence, orgB, 'Other Co')
  addOrg(persistence, 'org-platform', 'Platform')

  const platformOwner = addUser(persistence, 'org-platform', 'office_employee', {
    platformRole: 'platform_owner',
  })
  const companyOwner = addUser(persistence, orgA, 'owner')
  const employee = addUser(persistence, orgA, 'sales_employee')
  const ownerB = addUser(persistence, orgB, 'owner')

  seedEnabledBusinessModules(persistence, orgA, platformOwner.id, ['crm', 'sales'])
  assert(isModuleEnabledForOrganization(persistence, orgA, 'crm'), 'existing crm')
  assert(isModuleEnabledForOrganization(persistence, orgA, 'sales'), 'existing sales')
  assert(!isModuleEnabledForOrganization(persistence, orgA, 'warehouse'), 'existing warehouse off')

  backfillOrganizationBusinessTypes(persistence)
  assert(
    persistence.organizations.getById(orgA)?.businessTypeId === 'universal',
    'existing org typed universal',
  )
  assert(isModuleEnabledForOrganization(persistence, orgA, 'crm'), 'backfill keeps crm')
  assert(isModuleEnabledForOrganization(persistence, orgA, 'sales'), 'backfill keeps sales')
  assert(
    !isModuleEnabledForOrganization(persistence, orgA, 'warehouse'),
    'backfill does not enable warehouse',
  )

  const dentalTypeStamp = persistence.businessTypes.getById('dental')?.updatedAt
  const dentalTemplateStamp = persistence.businessTemplates.getById(
    'template-dental',
  )?.updatedAt
  const versionAfterCatalog = persistence.getVersion()
  ensureBusinessCatalog(persistence)
  assert(
    persistence.getVersion() === versionAfterCatalog,
    'second ensure does not notify',
  )
  assert(
    persistence.businessTypes.getById('dental')?.updatedAt === dentalTypeStamp,
    'existing type unchanged',
  )
  assert(
    persistence.businessTemplates.getById('template-dental')?.updatedAt ===
      dentalTemplateStamp,
    'existing template unchanged',
  )

  const types = listBusinessTypesForPlatformUser(persistence, platformOwner)
  assert(types.ok && types.value.some((item) => item.id === 'dental'), 'platform lists types')
  assert(persistence.getVersion() === versionAfterCatalog, 'list types is read-only')
  denied(
    listBusinessTypesForPlatformUser(persistence, companyOwner),
    'ACCESS_DENIED',
    'company owner cannot list types',
  )
  assert(persistence.getVersion() === versionAfterCatalog, 'denied list does not mutate')

  const templates = listBusinessTemplatesForPlatformUser(persistence, platformOwner)
  assert(templates.ok, 'platform lists templates')
  assert(
    persistence.getVersion() === versionAfterCatalog,
    'list templates is read-only',
  )
  const kinderTemplate = recommendedTemplateForBusinessType(persistence, 'kindergarten')
  assert(kinderTemplate, 'kindergarten template')
  assert(kinderTemplate.moduleIds.includes('children'), 'kindergarten recommends children')
  assert(kinderTemplate.moduleIds.includes('attendance'), 'kindergarten recommends attendance')
  assert(!kinderTemplate.moduleIds.includes('sales'), 'kindergarten does not recommend sales')
  assert(!kinderTemplate.moduleIds.includes('rental'), 'kindergarten does not recommend rental')
  assert(!kinderTemplate.moduleIds.includes('warehouse'), 'kindergarten does not recommend warehouse')
  assert(!kinderTemplate.moduleIds.includes('plans'), 'kindergarten does not recommend plans')

  const dentalTemplate = recommendedTemplateForBusinessType(persistence, 'dental')
  assert(dentalTemplate, 'dental template')
  assert(dentalTemplate.moduleIds.includes('crm'), 'dental recommends crm')
  assert(dentalTemplate.moduleIds.includes('sales'), 'dental recommends sales')
  assert(dentalTemplate.moduleIds.includes('attendance'), 'dental recommends attendance')

  const rentalTemplate = recommendedTemplateForBusinessType(persistence, 'costume_rental')
  assert(rentalTemplate, 'rental template')
  assert(rentalTemplate.moduleIds.includes('attendance'), 'rental recommends attendance')
  assert(rentalTemplate.moduleIds.includes('rental'), 'rental recommends rental')
  assert(!rentalTemplate.moduleIds.includes('sales'), 'rental does not recommend sales')
  assert(!rentalTemplate.moduleIds.includes('plans'), 'rental does not recommend plans')

  const recommended = [...dentalTemplate.moduleIds]
  const withoutWarehouse = recommended.filter((key) => key !== 'warehouse')
  const withRental = [...new Set([...withoutWarehouse, 'rental'])]

  const created = createCompanyOrganizationForPlatformUser(persistence, platformOwner, {
    name: 'Dental Shop Kazakhstan',
    ownerFirstName: 'Dana',
    ownerLastName: 'Owner',
    ownerEmail: 'demo-user-021@example.com',
    businessTypeId: 'dental',
    enabledModules: withRental,
  })
  assert(created.ok, 'create dental company')
  const companyId = created.value.organization.id
  assert(created.value.organization.businessTypeId === 'dental', 'stores business type')
  assert(
    isModuleEnabledForOrganization(persistence, companyId, 'crm'),
    'final config has crm',
  )
  assert(
    isModuleEnabledForOrganization(persistence, companyId, 'sales'),
    'final config has sales',
  )
  assert(
    !isModuleEnabledForOrganization(persistence, companyId, 'warehouse'),
    'removed warehouse before create',
  )
  assert(
    isModuleEnabledForOrganization(persistence, companyId, 'rental'),
    'added rental beyond template',
  )

  const defaultsOnly = createCompanyOrganizationForPlatformUser(
    persistence,
    platformOwner,
    {
      name: 'Dental Defaults',
      ownerFirstName: 'Ali',
      ownerLastName: 'Owner',
      ownerEmail: 'demo-user-006@example.com',
      businessTypeId: 'dental',
      enabledModules: recommended,
    },
  )
  assert(defaultsOnly.ok, 'create from recommended')
  for (const key of PLATFORM_MODULE_KEYS) {
    const expected = recommended.includes(key)
    assert(
      isModuleEnabledForOrganization(persistence, defaultsOnly.value.organization.id, key) ===
        expected,
      `recommended ${key}`,
    )
  }

  denied(
    createCompanyOrganizationForPlatformUser(persistence, companyOwner, {
      name: 'Nope',
      ownerFirstName: 'No',
      ownerLastName: 'Owner',
      ownerEmail: 'demo-user-034@example.com',
      businessTypeId: 'dental',
      enabledModules: ['crm'],
    }),
    'ACCESS_DENIED',
    'company owner cannot create',
  )
  denied(
    createCompanyOrganizationForPlatformUser(persistence, platformOwner, {
      name: 'Bad Module',
      ownerFirstName: 'No',
      ownerLastName: 'Owner',
      ownerEmail: 'demo-user-009@example.com',
      businessTypeId: 'dental',
      enabledModules: ['crm', 'dental_packages'],
    }),
    'INVALID_INPUT',
    'unknown module id rejected',
  )
  denied(
    createCompanyOrganizationForPlatformUser(persistence, platformOwner, {
      name: 'Bad Type',
      ownerFirstName: 'No',
      ownerLastName: 'Owner',
      ownerEmail: 'demo-user-010@example.com',
      businessTypeId: 'spaceship',
      enabledModules: ['crm'],
    }),
    'INVALID_INPUT',
    'unknown business type rejected',
  )

  denied(
    enableModuleForPlatformUser(persistence, companyOwner, companyId, 'analytics'),
    'ACCESS_DENIED',
    'company owner cannot enable after create',
  )
  denied(
    disableModuleForPlatformUser(persistence, employee, companyId, 'crm'),
    'ACCESS_DENIED',
    'employee cannot disable',
  )
  denied(
    enableModuleForPlatformUser(persistence, ownerB, companyId, 'analytics'),
    'ACCESS_DENIED',
    'cross-org owner cannot mutate',
  )
  denied(
    enableModuleForPlatformUser(persistence, platformOwner, companyId, 'implants'),
    'INVALID_INPUT',
    'unknown module after create',
  )

  assert(
    enableModuleForPlatformUser(persistence, platformOwner, companyId, 'warehouse').ok,
    'platform enables warehouse later',
  )
  assert(
    isModuleEnabledForOrganization(persistence, companyId, 'warehouse'),
    'warehouse on after toggle',
  )
  assert(
    disableModuleForPlatformUser(persistence, platformOwner, companyId, 'rental').ok,
    'platform disables rental later',
  )
  assert(
    !isModuleEnabledForOrganization(persistence, companyId, 'rental'),
    'rental off after toggle',
  )

  const beforeTemplateChange = {
    crm: isModuleEnabledForOrganization(persistence, companyId, 'crm'),
    sales: isModuleEnabledForOrganization(persistence, companyId, 'sales'),
    warehouse: isModuleEnabledForOrganization(persistence, companyId, 'warehouse'),
    rental: isModuleEnabledForOrganization(persistence, companyId, 'rental'),
  }
  persistence.businessTemplates.update('template-dental', {
    moduleIds: ['crm'],
    updatedAt: nowIso(),
  })
  ensureBusinessCatalog(persistence)
  assert(
    isModuleEnabledForOrganization(persistence, companyId, 'crm') === beforeTemplateChange.crm,
    'template upsert keeps crm',
  )
  assert(
    isModuleEnabledForOrganization(persistence, companyId, 'sales') ===
      beforeTemplateChange.sales,
    'template upsert keeps sales',
  )
  assert(
    isModuleEnabledForOrganization(persistence, companyId, 'warehouse') ===
      beforeTemplateChange.warehouse,
    'template upsert keeps warehouse',
  )
  assert(
    isModuleEnabledForOrganization(persistence, companyId, 'rental') ===
      beforeTemplateChange.rental,
    'template upsert keeps rental',
  )

  console.log('business-templates.verify: ok')
}

runBusinessTemplateChecks()
