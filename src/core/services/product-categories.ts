import type { Id, ProductCategory, ProductCategoryStatus, User } from '../types'
import type { SupplyContractProfile } from '../types/supply-contract'
import { normalizeSupplyContractProfile } from '../types/supply-contract'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import {
  canWriteMotivation,
  hasEffectiveWarehousePermission,
  requireCurrentUser,
} from './access'
import { requireSalesOrWarehouseModuleForUser } from './organization-modules'
import { newId, nowIso, optionalText } from './primitives'

export type ProductCategoryWrite = {
  name: string
  status: ProductCategoryStatus
  description?: string
  supplyProfile?: SupplyContractProfile
}

function requireCatalogManager(actor: User): ServiceResult<User> {
  if (!hasEffectiveWarehousePermission(actor, 'products.manage')) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return ok(actor)
}

function requireCategory(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult<ProductCategory> {
  const category = persistence.productCategories.getById(id)
  if (!category) {
    return fail({ code: 'CATEGORY_NOT_FOUND' })
  }

  if (!belongsToOrganization(category, organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(category)
}

export function requireActiveCategoryInOrganization(
  persistence: Persistence,
  organizationId: Id,
  categoryId: Id,
): ServiceResult<ProductCategory> {
  const category = requireCategory(persistence, organizationId, categoryId)
  if (!category.ok) {
    return category
  }

  if (category.value.status !== 'active') {
    return fail({ code: 'CATEGORY_INACTIVE' })
  }

  return category
}

export function listProductCategoriesForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  options?: { activeOnly?: boolean },
): ServiceResult<ProductCategory[]> {
  const actor = requireSalesOrWarehouseModuleForUser(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  const canList =
    hasEffectiveWarehousePermission(actor.value, 'products.read') ||
    canWriteMotivation(actor.value) ||
    actor.value.role === 'accountant'
  if (!canList) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const rows = persistence.productCategories
    .list(actor.value.organizationId)
    .filter((category) => (options?.activeOnly ? category.status === 'active' : true))
    .sort((left, right) => left.name.localeCompare(right.name, 'ru'))

  return ok(rows)
}

export function createProductCategoryForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: ProductCategoryWrite,
): ServiceResult<ProductCategory> {
  const gated = requireSalesOrWarehouseModuleForUser(persistence, currentUser)
  if (!gated.ok) {
    return gated
  }

  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const allowed = requireCatalogManager(actor.value)
  if (!allowed.ok) {
    return allowed
  }

  const name = draft.name.trim()
  if (!name) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const now = nowIso()
  return ok(
    persistence.productCategories.create({
      id: newId(),
      organizationId: actor.value.organizationId,
      name,
      status: draft.status === 'inactive' ? 'inactive' : 'active',
      description: optionalText(draft.description),
      supplyProfile: draft.supplyProfile
        ? normalizeSupplyContractProfile(draft.supplyProfile)
        : undefined,
      createdBy: actor.value.id,
      createdAt: now,
      updatedAt: now,
    }),
  )
}

export function updateProductCategoryForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
  draft: ProductCategoryWrite,
): ServiceResult<ProductCategory> {
  const gated = requireSalesOrWarehouseModuleForUser(persistence, currentUser)
  if (!gated.ok) {
    return gated
  }

  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const allowed = requireCatalogManager(actor.value)
  if (!allowed.ok) {
    return allowed
  }

  const existing = requireCategory(
    persistence,
    actor.value.organizationId,
    id,
  )
  if (!existing.ok) {
    return existing
  }

  const name = draft.name.trim()
  if (!name) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const updated = persistence.productCategories.update(id, {
    name,
    status: draft.status === 'inactive' ? 'inactive' : 'active',
    description: optionalText(draft.description),
    supplyProfile: draft.supplyProfile
      ? normalizeSupplyContractProfile(draft.supplyProfile)
      : undefined,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'CATEGORY_NOT_FOUND' })
  }

  return ok(updated)
}
