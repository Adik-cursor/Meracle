import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'
import { createSaleForUser } from './sales'
import { setStock } from './inventory'

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function setupSalesOrg(orgId: Id, name: string) {
  const persistence = createInMemoryPersistence()
  addOrg(persistence, orgId, name)
  seedEnabledBusinessModules(persistence, orgId, 'seed', ['sales', 'warehouse', 'crm'])
  const owner = addUser(persistence, orgId, 'owner')
  const seeded = seedSale(persistence, orgId, owner)
  const sale = persistence.sales.getById(seeded.saleId)
  assert(sale?.customerId, 'seeded customer')
  return {
    persistence,
    orgId,
    owner: persistence.users.getById(owner.id) as User,
    ...seeded,
    customerId: sale.customerId,
  }
}

export function addRoleUser(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
  warehouseId?: Id,
): User {
  const user = addUser(persistence, organizationId, role)
  const warehouse = warehouseId
    ? persistence.warehouses.getById(warehouseId)
    : undefined
  persistence.users.update(user.id, {
    warehouseId: warehouse?.id,
    branchId: warehouse?.branchId,
  })
  return persistence.users.getById(user.id) as User
}

export function createDiscountedSale(
  persistence: Persistence,
  owner: User,
  organizationId: Id,
  warehouseId: Id,
  productId: Id,
  customerId: Id,
) {
  setStock(persistence, organizationId, warehouseId, productId, 10)
  const created = createSaleForUser(persistence, owner, organizationId, 'KZT', {
    warehouseId,
    discount: 0,
    customerId,
    items: [
      { productId, quantity: 1, unitPrice: 100_000, discount: 0 },
      { productId, quantity: 1, unitPrice: 150_000, discount: 20_000 },
    ],
  })
  assert(created.ok, 'discounted sale')
  return created.value.sale
}

export function setupRentalOrg() {
  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-rent-debt', 'Rental')
  seedEnabledBusinessModules(persistence, 'org-rent-debt', 'seed', [
    'crm',
    'warehouse',
    'rental',
  ])
  const owner = addUser(persistence, 'org-rent-debt', 'owner')
  return { persistence, owner }
}

export function setupKindergartenOrg() {
  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-kg-debt', 'Kindergarten')
  seedEnabledBusinessModules(persistence, 'org-kg-debt', 'seed', ['crm', 'children'])
  const owner = addUser(persistence, 'org-kg-debt', 'owner')
  return { persistence, owner }
}
