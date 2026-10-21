import type {
  Id,
  Organization,
  OrganizationModuleConfig,
  OrganizationModules,
  PlatformModuleKey,
  User,
} from '../types'
import { PLATFORM_MODULE_KEYS, isPlatformModuleKey } from '../types/platform-module'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { newId, nowIso } from './primitives'
import { requireCurrentUser } from './access'
import { requireCompanyWorkspaceAccess } from './organization-workspace'
import { createFirstOwner } from './users'
import {
  DEFAULT_COMPANY_ORGANIZATION_ID,
  PLATFORM_ORGANIZATION_ID,
} from '../config/platform'
import {
  requireActiveBusinessType,
  UNIVERSAL_BUSINESS_TYPE_ID,
} from './business-catalog'

export function isPlatformOwner(user: User | null | undefined): boolean {
  return user?.platformRole === 'platform_owner'
}

function findModuleConfig(
  persistence: Persistence,
  organizationId: Id,
  moduleKey: PlatformModuleKey,
): OrganizationModuleConfig | undefined {
  return persistence.organizationModuleConfigs
    .list(organizationId)
    .find((item) => item.moduleKey === moduleKey)
}

export function isModuleEnabledForOrganization(
  persistence: Persistence,
  organizationId: Id,
  moduleKey: PlatformModuleKey,
): boolean {
  return findModuleConfig(persistence, organizationId, moduleKey)?.status === 'enabled'
}

export function isModuleEnabledForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  moduleKey: PlatformModuleKey,
): boolean {
  if (!currentUser) {
    return false
  }

  return isModuleEnabledForOrganization(
    persistence,
    currentUser.organizationId,
    moduleKey,
  )
}

export function requireModuleEnabledForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  moduleKey: PlatformModuleKey,
): ServiceResult<User> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const workspace = requireCompanyWorkspaceAccess(persistence, actor.value)
  if (!workspace.ok) {
    return workspace
  }

  if (
    !isModuleEnabledForOrganization(
      persistence,
      actor.value.organizationId,
      moduleKey,
    )
  ) {
    return fail({ code: 'MODULE_NOT_ENABLED' })
  }

  return actor
}

export function requireSalesOrWarehouseModuleForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const workspace = requireCompanyWorkspaceAccess(persistence, actor.value)
  if (!workspace.ok) {
    return workspace
  }

  const orgId = actor.value.organizationId
  if (
    isModuleEnabledForOrganization(persistence, orgId, 'sales') ||
    isModuleEnabledForOrganization(persistence, orgId, 'warehouse')
  ) {
    return actor
  }

  return fail({ code: 'MODULE_NOT_ENABLED' })
}

export function navModulesForOrganization(
  persistence: Persistence,
  organizationId: Id,
): OrganizationModules {
  const crm = isModuleEnabledForOrganization(persistence, organizationId, 'crm')
  const sales = isModuleEnabledForOrganization(persistence, organizationId, 'sales')
  const warehouse = isModuleEnabledForOrganization(
    persistence,
    organizationId,
    'warehouse',
  )
  const expenses = isModuleEnabledForOrganization(
    persistence,
    organizationId,
    'expenses',
  )
  const analytics = isModuleEnabledForOrganization(
    persistence,
    organizationId,
    'analytics',
  )
  const rental = isModuleEnabledForOrganization(
    persistence,
    organizationId,
    'rental',
  )
  const children = isModuleEnabledForOrganization(
    persistence,
    organizationId,
    'children',
  )
  const attendance = isModuleEnabledForOrganization(
    persistence,
    organizationId,
    'attendance',
  )
  const plans = isModuleEnabledForOrganization(persistence, organizationId, 'plans')
  const packages = isModuleEnabledForOrganization(
    persistence,
    organizationId,
    'packages',
  )

  return {
    crm,
    contacts: crm,
    companies: crm,
    deals: crm,
    tasks: crm,
    activities: crm,
    warehouses: warehouse,
    reports: analytics,
    sales,
    expenses,
    analytics,
    rental,
    children,
    attendance,
    plans,
    packages,
  }
}

/** Existing orgs without a plans row: sales/rental keep Plans ON; others stay OFF. */
export function backfillPlansModuleConfig(
  persistence: Persistence,
  updatedBy: Id,
): void {
  for (const organization of persistence.organizations.listAll()) {
    if (!isCompanyOrganizationId(organization.id)) {
      continue
    }
    if (findModuleConfig(persistence, organization.id, 'plans')) {
      continue
    }
    const enable =
      isModuleEnabledForOrganization(persistence, organization.id, 'sales') ||
      isModuleEnabledForOrganization(persistence, organization.id, 'rental')
    upsertModuleConfig(
      persistence,
      organization.id,
      'plans',
      enable ? 'enabled' : 'disabled',
      updatedBy,
    )
  }
}

/** Existing orgs without an attendance row: sales/rental/children keep Attendance ON. */
export function backfillAttendanceModuleConfig(
  persistence: Persistence,
  updatedBy: Id,
): void {
  for (const organization of persistence.organizations.listAll()) {
    if (!isCompanyOrganizationId(organization.id)) {
      continue
    }
    if (findModuleConfig(persistence, organization.id, 'attendance')) {
      continue
    }
    const enable =
      isModuleEnabledForOrganization(persistence, organization.id, 'sales') ||
      isModuleEnabledForOrganization(persistence, organization.id, 'rental') ||
      isModuleEnabledForOrganization(persistence, organization.id, 'children')
    upsertModuleConfig(
      persistence,
      organization.id,
      'attendance',
      enable ? 'enabled' : 'disabled',
      updatedBy,
    )
  }
}

export type OrganizationModuleView = {
  moduleKey: PlatformModuleKey
  status: 'enabled' | 'disabled'
}

export type PlatformOrganizationView = {
  organization: Organization
  modules: OrganizationModuleView[]
  owner: User | null
  employeeCount: number
}

export type CreateCompanyOrganizationWrite = {
  name: string
  ownerFirstName: string
  ownerLastName: string
  ownerEmail: string
  enabledModules: readonly string[]
  businessTypeId?: string
}

function requireRegistryModuleKey(
  value: string,
): ServiceResult<PlatformModuleKey> {
  if (!isPlatformModuleKey(value)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  return ok(value)
}

function requireRegistryModuleKeys(
  values: readonly string[],
): ServiceResult<PlatformModuleKey[]> {
  const keys: PlatformModuleKey[] = []
  for (const value of values) {
    const key = requireRegistryModuleKey(value)
    if (!key.ok) {
      return key
    }
    keys.push(key.value)
  }

  return ok(keys)
}

function requirePlatformActor(
  currentUser: User | null | undefined,
): ServiceResult<User> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  if (!isPlatformOwner(actor.value)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return actor
}

function requirePlatformOrganization(
  persistence: Persistence,
  organizationId: Id,
): ServiceResult<Organization> {
  if (organizationId === PLATFORM_ORGANIZATION_ID) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const organization = persistence.organizations.getById(organizationId)
  if (!organization) {
    return fail({ code: 'ORGANIZATION_NOT_FOUND' })
  }

  return ok(organization)
}

function moduleViewsForOrganization(
  persistence: Persistence,
  organizationId: Id,
): OrganizationModuleView[] {
  return PLATFORM_MODULE_KEYS.map((moduleKey) => ({
    moduleKey,
    status: isModuleEnabledForOrganization(persistence, organizationId, moduleKey)
      ? 'enabled'
      : 'disabled',
  }))
}

function ownerForOrganization(
  persistence: Persistence,
  organizationId: Id,
): User | null {
  return (
    persistence.users.list(organizationId).find((user) => user.role === 'owner') ??
    null
  )
}

function toOrganizationView(
  persistence: Persistence,
  organization: Organization,
): PlatformOrganizationView {
  return {
    organization,
    modules: moduleViewsForOrganization(persistence, organization.id),
    owner: ownerForOrganization(persistence, organization.id),
    employeeCount: persistence.users.list(organization.id).length,
  }
}

export function listPlatformOrganizationsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<PlatformOrganizationView[]> {
  const actor = requirePlatformActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.organizations
      .listAll()
      .filter((organization) => organization.id !== PLATFORM_ORGANIZATION_ID)
      .map((organization) => toOrganizationView(persistence, organization)),
  )
}

export function getOrganizationModulesForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
): ServiceResult<PlatformOrganizationView> {
  const actor = requirePlatformActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  const organization = requirePlatformOrganization(persistence, organizationId)
  if (!organization.ok) {
    return organization
  }

  return ok(toOrganizationView(persistence, organization.value))
}

export function createCompanyOrganizationForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: CreateCompanyOrganizationWrite,
): ServiceResult<PlatformOrganizationView> {
  const actor = requirePlatformActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  const name = draft.name.trim()
  if (!name) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const modules = requireRegistryModuleKeys(draft.enabledModules)
  if (!modules.ok) {
    return modules
  }

  const businessType = requireActiveBusinessType(
    persistence,
    draft.businessTypeId?.trim() || UNIVERSAL_BUSINESS_TYPE_ID,
  )
  if (!businessType.ok) {
    return businessType
  }

  return persistence.runInTransaction(
    () => {
      const now = nowIso()
      const organizationId = newId()
      const organization = persistence.organizations.create({
        id: organizationId,
        organizationId,
        name,
        status: 'active',
        businessTypeId: businessType.value.id,
        createdAt: now,
        updatedAt: now,
      })

      const owner = createFirstOwner(persistence, organization.id, {
        firstName: draft.ownerFirstName,
        lastName: draft.ownerLastName,
        email: draft.ownerEmail,
      })
      if (!owner.ok) {
        return owner
      }

      const enabled = new Set(modules.value)
      for (const moduleKey of PLATFORM_MODULE_KEYS) {
        upsertModuleConfig(
          persistence,
          organization.id,
          moduleKey,
          enabled.has(moduleKey) ? 'enabled' : 'disabled',
          actor.value.id,
        )
      }

      return ok(toOrganizationView(persistence, organization))
    },
    { shouldCommit: (result) => result.ok },
  )
}

function recordModuleAudit(
  persistence: Persistence,
  actorUserId: Id,
  organizationId: Id,
  moduleKey: PlatformModuleKey,
  previous: 'enabled' | 'disabled',
  next: 'enabled' | 'disabled',
): void {
  const now = nowIso()
  persistence.accessChangeLogs.create({
    id: newId(),
    organizationId,
    actorUserId,
    targetOrganizationId: organizationId,
    field: `module.${moduleKey}`,
    previousValue: previous,
    nextValue: next,
    createdAt: now,
    updatedAt: now,
  })
}

function upsertModuleConfig(
  persistence: Persistence,
  organizationId: Id,
  moduleKey: PlatformModuleKey,
  status: 'enabled' | 'disabled',
  updatedBy: Id,
): OrganizationModuleConfig {
  const now = nowIso()
  const existing = findModuleConfig(persistence, organizationId, moduleKey)

  if (existing) {
    const updated = persistence.organizationModuleConfigs.update(existing.id, {
      status,
      enabledAt: status === 'enabled' ? now : existing.enabledAt,
      disabledAt: status === 'disabled' ? now : existing.disabledAt,
      updatedBy,
      updatedAt: now,
    })
    return updated ?? existing
  }

  const created: OrganizationModuleConfig = {
    id: newId(),
    organizationId,
    moduleKey,
    status,
    enabledAt: status === 'enabled' ? now : undefined,
    disabledAt: status === 'disabled' ? now : now,
    updatedBy,
    createdAt: now,
    updatedAt: now,
  }
  return persistence.organizationModuleConfigs.create(created)
}

function setModuleStatusForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  moduleKeyValue: string,
  status: 'enabled' | 'disabled',
): ServiceResult<OrganizationModuleConfig> {
  const actor = requirePlatformActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  const moduleKey = requireRegistryModuleKey(moduleKeyValue)
  if (!moduleKey.ok) {
    return moduleKey
  }

  const organization = requirePlatformOrganization(persistence, organizationId)
  if (!organization.ok) {
    return organization
  }

  const previous = isModuleEnabledForOrganization(
    persistence,
    organization.value.id,
    moduleKey.value,
  )
    ? 'enabled'
    : 'disabled'

  if (previous === status) {
    const current = findModuleConfig(persistence, organization.value.id, moduleKey.value)
    if (current) {
      return ok(current)
    }
  }

  const saved = upsertModuleConfig(
    persistence,
    organization.value.id,
    moduleKey.value,
    status,
    actor.value.id,
  )

  if (previous !== status) {
    recordModuleAudit(
      persistence,
      actor.value.id,
      organization.value.id,
      moduleKey.value,
      previous,
      status,
    )
  }

  return ok(saved)
}

export function enableModuleForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  moduleKey: string,
): ServiceResult<OrganizationModuleConfig> {
  return setModuleStatusForPlatformUser(
    persistence,
    currentUser,
    organizationId,
    moduleKey,
    'enabled',
  )
}

export function disableModuleForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  moduleKey: string,
): ServiceResult<OrganizationModuleConfig> {
  return setModuleStatusForPlatformUser(
    persistence,
    currentUser,
    organizationId,
    moduleKey,
    'disabled',
  )
}

export function listPlatformModuleLogsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<
  {
    id: Id
    organizationId: Id
    actorUserId: Id
    moduleKey: string
    previousValue: string
    nextValue: string
    createdAt: string
    field: string
  }[]
> {
  const actor = requirePlatformActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  const entries = persistence.accessChangeLogs
    .listAll()
    .filter(
      (entry) =>
        entry.field.startsWith('module.') || entry.field.startsWith('lifecycle.'),
    )
    .map((entry) => {
      const moduleKey = entry.field.startsWith('module.')
        ? entry.field.slice('module.'.length)
        : entry.field.slice('lifecycle.'.length)
      return {
        id: entry.id,
        organizationId: entry.targetOrganizationId ?? entry.organizationId,
        actorUserId: entry.actorUserId,
        moduleKey,
        previousValue: entry.previousValue,
        nextValue: entry.nextValue,
        createdAt: entry.createdAt,
        field: entry.field,
      }
    })
    .filter(
      (entry) =>
        entry.field.startsWith('lifecycle.') ||
        PLATFORM_MODULE_KEYS.includes(entry.moduleKey as PlatformModuleKey),
    )

  return ok(entries)
}

/** Bootstrap and verify fixtures only. Not a user-facing grant. */
export function seedEnabledBusinessModules(
  persistence: Persistence,
  organizationId: Id,
  updatedBy: Id,
  keys: readonly PlatformModuleKey[] = [
    'crm',
    'sales',
    'warehouse',
    'expenses',
    'analytics',
    'plans',
  ],
): void {
  for (const moduleKey of keys) {
    upsertModuleConfig(persistence, organizationId, moduleKey, 'enabled', updatedBy)
  }
}

export function isCompanyOrganizationId(organizationId: Id): boolean {
  return organizationId !== PLATFORM_ORGANIZATION_ID
}

export function defaultCompanyOrganizationId(): Id {
  return DEFAULT_COMPANY_ORGANIZATION_ID
}
