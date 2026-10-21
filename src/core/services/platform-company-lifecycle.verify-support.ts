import type { Id, User } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { PLATFORM_ORGANIZATION_ID } from '../config/platform'
import { newId, nowIso } from './primitives'
import { seedEnabledBusinessModules } from './organization-modules'
import { createSaleForUser } from './sales'
import { setStock } from './inventory'

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function seedLifecycleWorld() {
  const persistence = createInMemoryPersistence()
  const now = nowIso()
  persistence.organizations.create({
    id: PLATFORM_ORGANIZATION_ID,
    organizationId: PLATFORM_ORGANIZATION_ID,
    name: 'Platform',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const platformOwner: User = {
    id: newId(),
    organizationId: PLATFORM_ORGANIZATION_ID,
    email: 'owner@platform',
    firstName: 'Platform',
    lastName: 'Owner',
    role: 'office_employee',
    platformRole: 'platform_owner',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(platformOwner)

  const orgId: Id = 'org-life-dsk'
  persistence.organizations.create({
    id: orgId,
    organizationId: orgId,
    name: 'DSK',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  seedEnabledBusinessModules(persistence, orgId, platformOwner.id, [
    'crm',
    'sales',
    'warehouse',
  ])
  const companyOwner: User = {
    id: newId(),
    organizationId: orgId,
    email: 'owner@dsk',
    firstName: 'DSK',
    lastName: 'Owner',
    role: 'owner',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(companyOwner)
  const employee: User = {
    id: newId(),
    organizationId: orgId,
    email: 'emp@dsk',
    firstName: 'Akonia',
    lastName: 'Kosherbai',
    role: 'sales_employee',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(employee)

  const otherId: Id = 'org-life-dentis'
  persistence.organizations.create({
    id: otherId,
    organizationId: otherId,
    name: 'Dentis',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  seedEnabledBusinessModules(persistence, otherId, platformOwner.id, ['crm'])
  persistence.users.create({
    id: newId(),
    organizationId: otherId,
    email: 'owner@dentis',
    firstName: 'Dentis',
    lastName: 'Owner',
    role: 'owner',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })

  return { persistence, platformOwner, companyOwner, employee, orgId, otherId }
}

export function seedSaleInOrg(persistence: Persistence, owner: User, organizationId: Id) {
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
  persistence.users.update(owner.id, { warehouseId, branchId })
  const productId = newId()
  persistence.products.create({
    id: productId,
    organizationId,
    name: 'Товар',
    sku: 'SKU',
    unit: 'шт',
    itemType: 'product',
    basePrice: 100,
    costPrice: 40,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  setStock(persistence, organizationId, warehouseId, productId, 10)
  const actor = persistence.users.getById(owner.id)
  const sale = createSaleForUser(persistence, actor, organizationId, 'KZT', {
    warehouseId,
    discount: 0,
    items: [{ productId, quantity: 1, unitPrice: 100, discount: 0 }],
  })
  assert(sale.ok, 'seed sale')
  return sale.value.sale
}
