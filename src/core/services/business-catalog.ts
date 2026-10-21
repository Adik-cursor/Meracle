import type { BusinessTemplate } from '../types/business-template'
import type { BusinessType } from '../types/business-type'
import type { Id, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { nowIso } from './primitives'
import { requireCurrentUser } from './access'
import {
  BUSINESS_CATALOG_ORGANIZATION_ID,
  DEFAULT_BUSINESS_TEMPLATES,
  DEFAULT_BUSINESS_TYPES,
  UNIVERSAL_BUSINESS_TYPE_ID,
} from '../config/business-catalog'

function requirePlatformActor(
  currentUser: User | null | undefined,
): ServiceResult<User> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  if (actor.value.platformRole !== 'platform_owner') {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return actor
}

export function ensureBusinessCatalog(persistence: Persistence): void {
  const stamp = nowIso()
  const organizationId = BUSINESS_CATALOG_ORGANIZATION_ID

  for (const item of DEFAULT_BUSINESS_TYPES) {
    if (persistence.businessTypes.getById(item.id)) {
      continue
    }

    persistence.businessTypes.create({
      id: item.id,
      organizationId,
      name: item.name,
      description: item.description,
      active: item.active,
      createdAt: stamp,
      updatedAt: stamp,
    })
  }

  for (const item of DEFAULT_BUSINESS_TEMPLATES) {
    const existing = persistence.businessTemplates.getById(item.id)
    if (!existing) {
      persistence.businessTemplates.create({
        id: item.id,
        organizationId,
        businessTypeId: item.businessTypeId,
        name: item.name,
        description: item.description,
        moduleIds: [...item.moduleIds],
        active: item.active,
        createdAt: stamp,
        updatedAt: stamp,
      })
      continue
    }

    if (
      item.id === 'template-kindergarten' &&
      (!existing.moduleIds.includes('children') ||
        !existing.moduleIds.includes('attendance') ||
        existing.moduleIds.includes('sales'))
    ) {
      persistence.businessTemplates.update(item.id, {
        description: item.description,
        moduleIds: [...item.moduleIds],
        updatedAt: stamp,
      })
    }
  }
}

export function backfillOrganizationBusinessTypes(persistence: Persistence): void {
  ensureBusinessCatalog(persistence)

  for (const organization of persistence.organizations.listAll()) {
    if (organization.id === BUSINESS_CATALOG_ORGANIZATION_ID) {
      continue
    }

    if (organization.businessTypeId) {
      continue
    }

    persistence.organizations.update(organization.id, {
      businessTypeId: UNIVERSAL_BUSINESS_TYPE_ID,
      updatedAt: nowIso(),
    })
  }
}

export function requireActiveBusinessType(
  persistence: Persistence,
  businessTypeId: Id,
): ServiceResult<BusinessType> {
  const businessType = persistence.businessTypes.getById(businessTypeId)
  if (!businessType || !businessType.active) {
    return fail({ code: 'INVALID_INPUT' })
  }

  return ok(businessType)
}

export function recommendedTemplateForBusinessType(
  persistence: Persistence,
  businessTypeId: Id,
): BusinessTemplate | undefined {
  return persistence.businessTemplates
    .listAll()
    .find(
      (template) =>
        template.businessTypeId === businessTypeId && template.active,
    )
}

export function listBusinessTypesForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<BusinessType[]> {
  const actor = requirePlatformActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.businessTypes.listAll().filter((item) => item.active),
  )
}

export function listBusinessTemplatesForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<BusinessTemplate[]> {
  const actor = requirePlatformActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.businessTemplates.listAll().filter((item) => item.active),
  )
}

export { UNIVERSAL_BUSINESS_TYPE_ID }
