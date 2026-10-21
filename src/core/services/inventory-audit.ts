import type { Id, StockAudit, StockAuditItem, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { isNonNegativeQuantity, newId, nowIso } from './primitives'
import { isPhysicalProduct } from '../types/product'
import { requireActorInOrganization } from './access'
import { hasEffectiveWarehousePermission } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import {
  canCreateAudit,
  requireAccessibleWarehouse,
} from './warehouse-access'
import { completeAuditForUser } from './complete-audit'
import {
  buildExcelWorkbook,
  parseCsv,
  parseExcelWorkbook,
  type ExcelSheet,
} from '../utils/excel-workbook'

export type InventoryAuditView = {
  audit: StockAudit
  items: StockAuditItem[]
}

export type AuditActualWrite = {
  productId: Id
  actualQuantity: number
  note?: string
}

const AUDIT_HEADERS = [
  'Артикул',
  'Наименование',
  'Категория',
  'Размер',
  'Ед. измерения',
  'Склад',
  'Учётное количество',
  'Фактическое количество',
  'Разница',
  'Комментарий',
] as const

function requireWarehouseModule(persistence: Persistence, currentUser: User | null | undefined) {
  return requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
}

function requireAuditRead(
  persistence: Persistence,
  currentUser: User | null | undefined,
  auditId: Id,
): ServiceResult<{ actor: User; audit: StockAudit }> {
  const gated = requireWarehouseModule(persistence, currentUser)
  if (!gated.ok) {
    return gated
  }
  const actor = requireActorInOrganization(gated.value, gated.value.organizationId)
  if (!actor.ok) {
    return actor
  }
  const audit = persistence.stockAudits.getById(auditId)
  if (!audit || audit.organizationId !== actor.value.organizationId) {
    return fail({ code: 'AUDIT_NOT_FOUND' })
  }
  const warehouse = requireAccessibleWarehouse(persistence, actor.value, audit.warehouseId)
  if (!warehouse.ok) {
    return warehouse
  }
  const allowed = hasEffectiveWarehousePermission(actor.value, 'inventory.read')
  if (!allowed) {
    return fail({ code: 'FORBIDDEN' })
  }
  return ok({ actor: actor.value, audit })
}

export function startInventoryAuditForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  warehouseId: Id,
  note?: string,
): ServiceResult<StockAudit> {
  const gated = requireWarehouseModule(persistence, currentUser)
  if (!gated.ok) {
    return gated
  }
  const actor = requireActorInOrganization(gated.value, gated.value.organizationId)
  if (!actor.ok) {
    return actor
  }
  const warehouse = requireAccessibleWarehouse(persistence, actor.value, warehouseId)
  if (!warehouse.ok) {
    return warehouse
  }
  const allowed = canCreateAudit(actor.value, warehouse.value)
  if (!allowed.ok) {
    return fail({ code: 'FORBIDDEN' })
  }

  const organizationId = actor.value.organizationId
  const now = nowIso()
  const audit: StockAudit = {
    id: newId(),
    organizationId,
    warehouseId,
    status: 'in_progress',
    createdBy: actor.value.id,
    note: note?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }

  return persistence.runInTransaction(() => {
    persistence.stockAudits.create(audit)
    const stock = persistence.inventory
      .list(organizationId)
      .filter((item) => item.warehouseId === warehouseId)
    const products = persistence.products
      .list(organizationId)
      .filter((product) => isPhysicalProduct(product))

    const productIds = new Set<Id>()
    for (const item of stock) {
      productIds.add(item.productId)
    }
    for (const product of products) {
      productIds.add(product.id)
    }

    for (const productId of productIds) {
      const systemQuantity =
        persistence.inventory.getByWarehouseAndProduct(
          organizationId,
          warehouseId,
          productId,
        )?.quantity ?? 0
      const row: StockAuditItem = {
        id: newId(),
        organizationId,
        auditId: audit.id,
        warehouseId,
        productId,
        systemQuantity,
        createdAt: now,
        updatedAt: now,
      }
      persistence.stockAuditItems.create(row)
    }
    return ok(audit)
  })
}

export function listAuditsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<StockAudit[]> {
  const gated = requireWarehouseModule(persistence, currentUser)
  if (!gated.ok) {
    return gated
  }
  const actor = gated.value
  const audits = persistence.stockAudits
    .list(actor.organizationId)
    .filter((audit) => {
      const warehouse = persistence.warehouses.getById(audit.warehouseId)
      return warehouse
        ? requireAccessibleWarehouse(persistence, actor, audit.warehouseId).ok &&
          hasEffectiveWarehousePermission(actor, 'inventory.read')
        : false
    })
  return ok(audits)
}

export function getInventoryAuditForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  auditId: Id,
): ServiceResult<InventoryAuditView> {
  const loaded = requireAuditRead(persistence, currentUser, auditId)
  if (!loaded.ok) {
    return loaded
  }
  return ok({
    audit: loaded.value.audit,
    items: persistence.stockAuditItems.listByAuditId(auditId),
  })
}

function setActualOnItem(
  persistence: Persistence,
  item: StockAuditItem,
  actualQuantity: number,
  note?: string,
): ServiceResult<StockAuditItem> {
  if (!isNonNegativeQuantity(actualQuantity)) {
    return fail({
      code: 'INVALID_ACTUAL_QUANTITY',
      productId: item.productId,
      requestedQuantity: actualQuantity,
    })
  }
  const difference = actualQuantity - item.systemQuantity
  const updated = persistence.stockAuditItems.update(item.id, {
    actualQuantity,
    difference,
    note: note?.trim() || item.note,
    updatedAt: nowIso(),
  })
  if (!updated) {
    return fail({ code: 'AUDIT_NOT_FOUND' })
  }
  return ok(updated)
}

export function updateInventoryAuditActualsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  auditId: Id,
  lines: AuditActualWrite[],
): ServiceResult<InventoryAuditView> {
  const loaded = requireAuditRead(persistence, currentUser, auditId)
  if (!loaded.ok) {
    return loaded
  }
  const { actor, audit } = loaded.value
  if (audit.status === 'completed') {
    return fail({ code: 'AUDIT_ALREADY_COMPLETED' })
  }
  const warehouse = requireAccessibleWarehouse(persistence, actor, audit.warehouseId)
  if (!warehouse.ok) {
    return warehouse
  }
  const allowed = canCreateAudit(actor, warehouse.value)
  if (!allowed.ok) {
    return fail({ code: 'FORBIDDEN' })
  }

  return persistence.runInTransaction(() => {
    const items = persistence.stockAuditItems.listByAuditId(auditId)
    for (const line of lines) {
      const item = items.find((row) => row.productId === line.productId)
      if (!item) {
        return fail({ code: 'PRODUCT_NOT_FOUND', productId: line.productId })
      }
      const updated = setActualOnItem(persistence, item, line.actualQuantity, line.note)
      if (!updated.ok) {
        return updated
      }
    }
    persistence.stockAudits.update(auditId, { updatedAt: nowIso() })
    return getInventoryAuditForUser(persistence, actor, auditId)
  })
}

export function exportInventoryAuditExcelForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  auditId: Id,
): ServiceResult<{ filename: string; bytes: Uint8Array; sheet: ExcelSheet }> {
  const loaded = getInventoryAuditForUser(persistence, currentUser, auditId)
  if (!loaded.ok) {
    return loaded
  }
  const { audit, items } = loaded.value
  const warehouse = persistence.warehouses.getById(audit.warehouseId)
  const categories = persistence.productCategories.list(audit.organizationId)
  const rows = items.map((item) => {
    const product = persistence.products.getById(item.productId)
    const category = categories.find((entry) => entry.id === product?.categoryId)
    const actual =
      item.actualQuantity === undefined || item.actualQuantity === null
        ? ''
        : item.actualQuantity
    const difference =
      item.actualQuantity === undefined || item.actualQuantity === null
        ? ''
        : item.actualQuantity - item.systemQuantity
    return [
      product?.sku ?? '',
      product?.name ?? '',
      category?.name ?? '',
      product?.size ?? '',
      product?.unit ?? '',
      warehouse?.name ?? '',
      item.systemQuantity,
      actual,
      difference,
      item.note ?? '',
    ]
  })
  const sheet: ExcelSheet = {
    name: 'Ревизия',
    headers: [...AUDIT_HEADERS],
    rows,
  }
  return ok({
    filename: `revision-${auditId.slice(-6)}.xlsx`,
    bytes: buildExcelWorkbook([sheet]),
    sheet,
  })
}

function headerIndex(headers: readonly string[], name: string): number {
  return headers.findIndex((header) => header.trim().toLowerCase() === name.toLowerCase())
}

export function importInventoryAuditSheetForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  auditId: Id,
  sheet: ExcelSheet,
): ServiceResult<InventoryAuditView> {
  const skuIndex = headerIndex(sheet.headers, 'Артикул')
  const actualIndex = headerIndex(sheet.headers, 'Фактическое количество')
  const noteIndex = headerIndex(sheet.headers, 'Комментарий')
  if (skuIndex < 0 || actualIndex < 0) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const loaded = requireAuditRead(persistence, currentUser, auditId)
  if (!loaded.ok) {
    return loaded
  }
  if (loaded.value.audit.status === 'completed') {
    return fail({ code: 'AUDIT_ALREADY_COMPLETED' })
  }

  const lines: AuditActualWrite[] = []
  for (const row of sheet.rows) {
    const sku = String(row[skuIndex] ?? '').trim()
    const actualRaw = String(row[actualIndex] ?? '').trim()
    if (!sku || actualRaw === '') {
      continue
    }
    const actualQuantity = Number(actualRaw)
    if (!Number.isFinite(actualQuantity)) {
      return fail({ code: 'INVALID_ACTUAL_QUANTITY' })
    }
    const product = persistence.products
      .list(loaded.value.audit.organizationId)
      .find((item) => item.sku === sku)
    if (!product) {
      return fail({ code: 'PRODUCT_NOT_FOUND' })
    }
    lines.push({
      productId: product.id,
      actualQuantity,
      note: noteIndex >= 0 ? String(row[noteIndex] ?? '') : undefined,
    })
  }

  return updateInventoryAuditActualsForUser(
    persistence,
    currentUser,
    auditId,
    lines,
  )
}

export function importInventoryAuditExcelForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  auditId: Id,
  source: Uint8Array | string,
): ServiceResult<InventoryAuditView> {
  const sheet =
    typeof source === 'string'
      ? parseCsv(source)
      : (parseExcelWorkbook(source)[0] ?? parseCsv(''))
  return importInventoryAuditSheetForUser(persistence, currentUser, auditId, sheet)
}

export function completeInventoryAuditForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  auditId: Id,
): ServiceResult<StockAudit> {
  return completeAuditForUser(
    persistence,
    currentUser,
    currentUser?.organizationId ?? '',
    auditId,
  )
}
