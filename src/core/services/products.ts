import type { Id, Product, ProductItemType, ProductStatus, User } from '../types'
import { fail, ok, okVoid, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import { canReadProduct, requireAccessibleWarehouse } from './warehouse-access'
import {
  hasEffectiveWarehousePermission,
  requireActorInOrganization,
} from './access'
import { nowIso, newId, optionalText } from './primitives'
import { isPhysicalProduct, normalizeBasePrice, normalizeProductItemType, parseProductImageUrl } from '../types/product'
import { setStock } from './inventory'
import { createMovements } from './stock-movements'
import { applyIncomingCost } from './receive-stock'
import { requireSalesOrWarehouseModuleForUser } from './organization-modules'
import { requireActiveCategoryInOrganization } from './product-categories'

export type ProductWrite = {
  name: string
  sku: string
  barcode?: string
  description?: string
  unit: string
  itemType: ProductItemType
  basePrice: number
  costPrice: number
  status: ProductStatus
  warehouseId?: Id
  initialQuantity?: number
  categoryId?: Id
  imageUrl?: string
}

function requireProduct(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult<Product> {
  const product = persistence.products.getById(id)

  if (!product) {
    return fail({ code: 'PRODUCT_NOT_FOUND' })
  }

  if (!belongsToOrganization(product, organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(product)
}

function requireProductImageUrl(
  value: unknown,
): ServiceResult<string | undefined> {
  const parsed = parseProductImageUrl(value)
  if (parsed === null) {
    return fail({ code: 'INVALID_INPUT' })
  }

  return ok(parsed)
}

export function createProduct(
  persistence: Persistence,
  organizationId: Id,
  draft: ProductWrite,
): ServiceResult<Product> {
  const name = draft.name.trim()
  const sku = draft.sku.trim()
  const barcode = draft.barcode?.trim() || undefined
  const unit = draft.unit.trim()
  const itemType = normalizeProductItemType(draft.itemType)
  const basePrice = normalizeBasePrice(draft.basePrice)
  const costPrice = normalizeBasePrice(draft.costPrice)

  if (!name || !sku || !unit) {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (
    barcode &&
    persistence.products
      .list(organizationId)
      .some((product) => product.barcode?.trim() === barcode)
  ) {
    return fail({ code: 'INVALID_INPUT' })
  }

  let categoryId: Id | undefined
  if (draft.categoryId) {
    const category = requireActiveCategoryInOrganization(
      persistence,
      organizationId,
      draft.categoryId,
    )
    if (!category.ok) {
      return category
    }

    categoryId = category.value.id
  }

  const image = requireProductImageUrl(draft.imageUrl)
  if (!image.ok) {
    return image
  }

  const now = nowIso()
  const product: Product = {
    id: newId(),
    organizationId,
    name,
    sku,
    barcode,
    description: optionalText(draft.description),
    unit,
    itemType,
    basePrice,
    costPrice,
    status: draft.status,
    categoryId,
    imageUrl: image.value,
    createdAt: now,
    updatedAt: now,
  }

  return ok(persistence.products.create(product))
}

export function updateProduct(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  draft: ProductWrite,
): ServiceResult<Product> {
  const existing = requireProduct(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const name = draft.name.trim()
  const sku = draft.sku.trim()
  const barcode = draft.barcode?.trim() || undefined
  const unit = draft.unit.trim()
  const itemType = normalizeProductItemType(draft.itemType)
  const basePrice = normalizeBasePrice(draft.basePrice)
  const costPrice = normalizeBasePrice(draft.costPrice)

  if (!name || !sku || !unit) {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (
    barcode &&
    persistence.products
      .list(organizationId)
      .some(
        (product) =>
          product.id !== id && product.barcode?.trim() === barcode,
      )
  ) {
    return fail({ code: 'INVALID_INPUT' })
  }

  let categoryId: Id | undefined = existing.value.categoryId
  if (draft.categoryId) {
    const category = requireActiveCategoryInOrganization(
      persistence,
      organizationId,
      draft.categoryId,
    )
    if (!category.ok) {
      return category
    }

    categoryId = category.value.id
  }

  let imageUrl = existing.value.imageUrl
  if ('imageUrl' in draft) {
    const image = requireProductImageUrl(draft.imageUrl)
    if (!image.ok) {
      return image
    }
    imageUrl = image.value
  }

  const updated = persistence.products.update(id, {
    name,
    sku,
    barcode,
    description: optionalText(draft.description),
    unit,
    itemType,
    basePrice,
    costPrice,
    status: draft.status,
    categoryId,
    imageUrl,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'PRODUCT_NOT_FOUND' })
  }

  return ok(updated)
}

export function setProductStatus(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  status: ProductStatus,
): ServiceResult {
  const existing = requireProduct(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const updated = persistence.products.update(id, {
    status,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'PRODUCT_NOT_FOUND' })
  }

  return okVoid()
}

export function listProductsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<Product[]> {
  const actor = requireSalesOrWarehouseModuleForUser(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.products
      .list(actor.value.organizationId)
      .filter((product) => canReadProduct(actor.value, product).ok),
  )
}

export function createProductForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: ProductWrite,
): ServiceResult<Product> {
  const gated = requireSalesOrWarehouseModuleForUser(persistence, currentUser)
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  if (!hasEffectiveWarehousePermission(actor.value, 'products.manage')) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const preview = canReadProduct(actor.value, {
    id: '',
    organizationId,
    name: draft.name,
    sku: draft.sku,
    unit: draft.unit,
    itemType: normalizeProductItemType(draft.itemType),
    basePrice: normalizeBasePrice(draft.basePrice),
    costPrice: normalizeBasePrice(draft.costPrice),
    status: draft.status,
    createdAt: '',
    updatedAt: '',
    categoryId: draft.categoryId,
  })
  if (!preview.ok) {
    return preview
  }

  const itemType = normalizeProductItemType(draft.itemType)
  const isProduct = isPhysicalProduct({ itemType })
  const warehouseId = isProduct ? draft.warehouseId : undefined
  const initialQuantity =
    isProduct && warehouseId
      ? (draft.initialQuantity ?? 0)
      : undefined

  if (isProduct && warehouseId) {
    if (
      initialQuantity === undefined ||
      !Number.isFinite(initialQuantity) ||
      initialQuantity < 0
    ) {
      return fail({
        code: 'INVALID_QUANTITY',
        warehouseId,
        requestedQuantity: initialQuantity,
      })
    }

    const warehouse = requireAccessibleWarehouse(
      persistence,
      actor.value,
      warehouseId,
    )
    if (!warehouse.ok) {
      return warehouse
    }

    if (warehouse.value.organizationId !== actor.value.organizationId) {
      return fail({ code: 'ORGANIZATION_MISMATCH' })
    }
  }

  return persistence.runInTransaction(() => {
    const created = createProduct(persistence, organizationId, {
      ...draft,
      itemType,
      warehouseId: undefined,
      initialQuantity: undefined,
    })
    if (!created.ok) {
      return created
    }

    if (!isProduct || !warehouseId || initialQuantity === undefined) {
      return created
    }

    const stocked = setStock(
      persistence,
      organizationId,
      warehouseId,
      created.value.id,
      initialQuantity,
      created.value.costPrice,
    )
    if (!stocked.ok) {
      return stocked
    }

    if (initialQuantity === 0) {
      return created
    }

    const costed = applyIncomingCost(
      persistence,
      organizationId,
      warehouseId,
      created.value.id,
      initialQuantity,
      created.value.costPrice,
      0,
      0,
    )
    if (!costed.ok) {
      return costed
    }

    const moved = createMovements(
      persistence,
      organizationId,
      actor.value.id,
      [
        {
          warehouseId,
          productId: created.value.id,
          type: 'receipt',
          quantity: initialQuantity,
          note: 'initial_stock',
        },
      ],
    )
    if (!moved.ok) {
      return moved
    }

    return created
  })
}

export function updateProductForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  draft: ProductWrite,
): ServiceResult<Product> {
  const gated = requireSalesOrWarehouseModuleForUser(persistence, currentUser)
  if (!gated.ok) {
    return gated
  }

  const existing = requireProduct(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  if (!hasEffectiveWarehousePermission(actor.value, 'products.manage')) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const allowed = canReadProduct(actor.value, existing.value)
  if (!allowed.ok) {
    return allowed
  }

  return updateProduct(persistence, organizationId, id, draft)
}

export function setProductStatusForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  status: ProductStatus,
): ServiceResult {
  const gated = requireSalesOrWarehouseModuleForUser(persistence, currentUser)
  if (!gated.ok) {
    return gated
  }

  const existing = requireProduct(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const allowed = canReadProduct(currentUser, existing.value)
  if (!allowed.ok) {
    return allowed
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  if (!hasEffectiveWarehousePermission(actor.value, 'products.manage')) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return setProductStatus(persistence, organizationId, id, status)
}
