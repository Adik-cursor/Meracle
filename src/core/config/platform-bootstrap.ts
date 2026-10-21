import type { Organization, User } from '../types'
import type { Persistence } from '../repositories/persistence'
import { defaultOrganization } from './default-organization'
import {
  DEFAULT_COMPANY_ORGANIZATION_ID,
  DEMO_SECOND_ORGANIZATION_ID,
  PLATFORM_ORGANIZATION_ID,
  PLATFORM_OWNER_USER_ID,
} from './platform'
import {
  backfillAttendanceModuleConfig,
  backfillPlansModuleConfig,
  seedEnabledBusinessModules,
} from '../services/organization-modules'
import {
  backfillOrganizationBusinessTypes,
  ensureBusinessCatalog,
} from '../services/business-catalog'
import { nowIso } from '../services/primitives'

function ensureOrganization(
  persistence: Persistence,
  organization: Organization,
): void {
  if (persistence.organizations.getById(organization.id)) {
    return
  }

  persistence.organizations.create(organization)
}

export function bootstrapPlatformPersistence(
  persistence: Persistence,
  options: { createPlatformOwner?: boolean } = {},
): void {
  const now = nowIso()
  const createPlatformOwner = options.createPlatformOwner ?? true

  ensureOrganization(persistence, {
    ...defaultOrganization,
    id: DEFAULT_COMPANY_ORGANIZATION_ID,
    organizationId: DEFAULT_COMPANY_ORGANIZATION_ID,
  })

  ensureOrganization(persistence, {
    id: PLATFORM_ORGANIZATION_ID,
    organizationId: PLATFORM_ORGANIZATION_ID,
    name: 'Platform',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })

  ensureOrganization(persistence, {
    id: DEMO_SECOND_ORGANIZATION_ID,
    organizationId: DEMO_SECOND_ORGANIZATION_ID,
    name: 'Rental Company',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })

  if (createPlatformOwner && !persistence.users.getById(PLATFORM_OWNER_USER_ID)) {
    const owner: User = {
      id: PLATFORM_OWNER_USER_ID,
      organizationId: PLATFORM_ORGANIZATION_ID,
      email: 'platform@crm.local',
      firstName: 'Platform',
      lastName: 'Owner',
      role: 'office_employee',
      platformRole: 'platform_owner',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    persistence.users.create(owner)
  }

  const companyConfigs = persistence.organizationModuleConfigs.list(
    DEFAULT_COMPANY_ORGANIZATION_ID,
  )
  if (companyConfigs.length === 0) {
    seedEnabledBusinessModules(
      persistence,
      DEFAULT_COMPANY_ORGANIZATION_ID,
      createPlatformOwner ? PLATFORM_OWNER_USER_ID : 'demo-seed',
    )
  }

  ensureBusinessCatalog(persistence)
  backfillOrganizationBusinessTypes(persistence)
  const actorId = createPlatformOwner ? PLATFORM_OWNER_USER_ID : 'demo-seed'
  backfillPlansModuleConfig(persistence, actorId)
  backfillAttendanceModuleConfig(persistence, actorId)
}
