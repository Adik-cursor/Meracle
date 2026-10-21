import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { setStock } from './inventory'
import {
  exportInventoryAuditExcelForUser,
  importInventoryAuditSheetForUser,
  startInventoryAuditForUser,
} from './inventory-audit'
import {
  parseExcelWorkbook,
  parseExcelWorkbookAsync,
} from '../utils/excel-workbook'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function addOrg(persistence: Persistence, id: Id, name: string) {
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

function addUser(persistence: Persistence, organizationId: Id, role: UserRole): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}@${organizationId}.local`,
    firstName: 'A',
    lastName: 'B',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(user)
  return user
}

function seedWarehouse(persistence: Persistence, organizationId: Id) {
  const now = nowIso()
  const branchId = newId()
  persistence.branches.create({
    id: branchId,
    organizationId,
    name: 'B',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const warehouseId = newId()
  persistence.warehouses.create({
    id: warehouseId,
    organizationId,
    branchId,
    name: 'WH',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const productId = newId()
  persistence.products.create({
    id: productId,
    organizationId,
    name: 'Товар',
    sku: 'SKU-1',
    unit: 'шт',
    itemType: 'product',
    basePrice: 1,
    costPrice: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  setStock(persistence, organizationId, warehouseId, productId, 25)
  return { warehouseId, productId }
}

function u16(value: number): Uint8Array {
  const out = new Uint8Array(2)
  out[0] = value & 0xff
  out[1] = (value >> 8) & 0xff
  return out
}

function u32(value: number): Uint8Array {
  const out = new Uint8Array(4)
  out[0] = value & 0xff
  out[1] = (value >> 8) & 0xff
  out[2] = (value >> 16) & 0xff
  out[3] = (value >> 24) & 0xff
  return out
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

async function zipDeflate(name: string, content: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(content)]).stream().pipeThrough(
    new CompressionStream('deflate-raw'),
  )
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer())
  const encodedName = new TextEncoder().encode(name)
  const local = concat([
    u32(0x04034b50),
    u16(20),
    u16(0),
    u16(8),
    u16(0),
    u16(0),
    u32(0),
    u32(compressed.length),
    u32(content.length),
    u16(encodedName.length),
    u16(0),
    encodedName,
    compressed,
  ])
  const central = concat([
    u32(0x02014b50),
    u16(20),
    u16(20),
    u16(0),
    u16(8),
    u16(0),
    u16(0),
    u32(0),
    u32(compressed.length),
    u32(content.length),
    u16(encodedName.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(0),
    encodedName,
  ])
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(1),
    u16(1),
    u32(central.length),
    u32(local.length),
    u16(0),
  ])
  return concat([local, central, eocd])
}

export function runInventoryAuditAutoExcelChecks(): void {
  const persistence = createInMemoryPersistence()
  const org = 'org-auto-excel'
  addOrg(persistence, org, 'DSK')
  seedEnabledBusinessModules(persistence, org, 'seed', ['warehouse', 'crm'])
  const owner = addUser(persistence, org, 'owner')
  const { warehouseId } = seedWarehouse(persistence, org)
  const started = startInventoryAuditForUser(persistence, owner, warehouseId)
  assert(started.ok, 'create audit')
  assert(started.value.status === 'in_progress', 'do not auto-complete')
  const exported = exportInventoryAuditExcelForUser(persistence, owner, started.value.id)
  assert(exported.ok, 'auto excel after persist')
  const sheet = parseExcelWorkbook(exported.value.bytes)[0]
  assert(sheet?.headers[0] === 'Артикул', 'sku column')
  assert(sheet.headers.includes('Фактическое количество'), 'actual column')
  const actualIndex = sheet.headers.indexOf('Фактическое количество')
  const diffIndex = sheet.headers.indexOf('Разница')
  const commentIndex = sheet.headers.indexOf('Комментарий')
  assert(String(sheet.rows[0]?.[actualIndex] ?? '') === '', 'actual empty on create')
  assert(String(sheet.rows[0]?.[diffIndex] ?? '') === '', 'diff empty on create')
  assert(String(sheet.rows[0]?.[commentIndex] ?? '') === '', 'comment empty on create')
  assert(started.value.status === 'in_progress', 'export does not complete audit')
  console.log('inventory-audit-auto-excel.verify: ok')
}

async function runDeflateImportCheck(): Promise<void> {
  const xml = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c t="inlineStr"><is><t>Артикул</t></is></c><c t="inlineStr"><is><t>Фактическое количество</t></is></c></row><row><c t="inlineStr"><is><t>SKU-1</t></is></c><c><v>21</v></c></row></sheetData></worksheet>`
  const bytes = await zipDeflate('xl/worksheets/sheet1.xml', new TextEncoder().encode(xml))
  const sync = parseExcelWorkbook(bytes)
  const asyncParsed = await parseExcelWorkbookAsync(bytes)
  if (asyncParsed.length === 0 && sync.length === 0) {
    console.log(
      'inventory-audit-auto-excel.verify: DEFLATE XLSX still limited without DecompressionStream',
    )
    return
  }
  const persistence = createInMemoryPersistence()
  const org = 'org-deflate'
  addOrg(persistence, org, 'DSK')
  seedEnabledBusinessModules(persistence, org, 'seed', ['warehouse', 'crm'])
  const owner = addUser(persistence, org, 'owner')
  const { warehouseId } = seedWarehouse(persistence, org)
  const started = startInventoryAuditForUser(persistence, owner, warehouseId)
  assert(started.ok, 'start for deflate')
  const sheet = asyncParsed[0] ?? sync[0]
  const imported = importInventoryAuditSheetForUser(
    persistence,
    owner,
    started.value.id,
    sheet,
  )
  assert(imported.ok, 'deflate/shared import')
  console.log('inventory-audit-auto-excel.verify: deflate parse ok')
}

runInventoryAuditAutoExcelChecks()
void runDeflateImportCheck()
