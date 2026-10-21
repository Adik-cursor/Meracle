import type {
  Id,
  ImplantPackage,
  ImplantPackageBalance,
  ImplantPackageMovement,
  ImplantPackageMovementType,
  ImplantPackageStatus,
  User,
} from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { isNonNegativeQuantity, newId, nowIso, optionalText } from './primitives'
import { requireActorInOrganization } from './access'
import { hasEffectiveWarehousePermission } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import { applyStockDeltas } from './inventory'
import { createMovements } from './stock-movements'
import { requireAccessibleWarehouse } from './warehouse-access'
import { getCustomerDisplayName } from '../../modules/crm/customers/customer-name'
import { userDisplayName } from '../../modules/crm/users/user-name'
import { isSalePayment } from '../types/payment'

export type ImplantPackageWrite = {
  customerId: Id
  name: string
  price: number
  currency: string
  totalImplants: number
  status?: ImplantPackageStatus
  startDate: string
  endDate?: string
  responsibleEmployeeId?: Id
  notes?: string
}

export type ImplantPackageMovementWrite = {
  packageId: Id
  productId: Id
  warehouseId?: Id
  movementType: ImplantPackageMovementType
  quantity: number
  note?: string
}

export type ImplantPackageRow = {
  pkg: ImplantPackage
  balance: ImplantPackageBalance
  customerName: string
  contractNumber: string
  responsibleName: string
}

export type ImplantPackageMovementRow = {
  movement: ImplantPackageMovement
  productName: string
  size: string
  customerName: string
  packageName: string
  performedByName: string
}

function requirePackagesActor(
  persistence: Persistence,
  currentUser: User | null | undefined,
) {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'packages')
  if (!gated.ok) {
    return gated
  }
  return requireActorInOrganization(gated.value, gated.value.organizationId)
}

function movementsOf(
  persistence: Persistence,
  organizationId: Id,
  packageId: Id,
): ImplantPackageMovement[] {
  return persistence.implantPackageMovements
    .list(organizationId)
    .filter((item) => item.packageId === packageId)
}

function sumType(
  movements: ImplantPackageMovement[],
  type: ImplantPackageMovementType,
): number {
  return movements
    .filter((item) => item.movementType === type)
    .reduce((sum, item) => sum + item.quantity, 0)
}

export function computePackageBalance(
  persistence: Persistence,
  pkg: ImplantPackage,
): ImplantPackageBalance {
  const movements = movementsOf(persistence, pkg.organizationId, pkg.id)
  const issued = sumType(movements, 'issued')
  const used = sumType(movements, 'used')
  const returned = sumType(movements, 'returned')
  const paid = persistence.payments
    .list(pkg.organizationId)
    .filter(
      (payment) =>
        isSalePayment(payment) &&
        payment.status === 'completed' &&
        persistence.sales.getById(payment.saleId)?.packageId === pkg.id,
    )
    .reduce((sum, payment) => sum + payment.amount, 0)
  const remaining = pkg.totalImplants - issued
  return {
    total: pkg.totalImplants,
    issued,
    used,
    returned,
    remaining,
    paid,
    debt: Math.max(0, pkg.price - paid),
  }
}

function toRow(
  persistence: Persistence,
  pkg: ImplantPackage,
): ImplantPackageRow {
  const customer = persistence.customers.getById(pkg.customerId)
  const contacts = persistence.contacts.list(pkg.organizationId)
  const contract = pkg.contractId
    ? persistence.packageContracts.getById(pkg.contractId)
    : undefined
  const responsible = pkg.responsibleEmployeeId
    ? persistence.users.getById(pkg.responsibleEmployeeId)
    : undefined
  return {
    pkg,
    balance: computePackageBalance(persistence, pkg),
    customerName: customer
      ? getCustomerDisplayName(customer, contacts, [])
      : '',
    contractNumber: contract?.contractNumber ?? '',
    responsibleName: responsible ? userDisplayName(responsible) : '',
  }
}

export function createImplantPackageForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: ImplantPackageWrite,
): ServiceResult<ImplantPackage> {
  const actor = requirePackagesActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  const organizationId = actor.value.organizationId
  const customer = persistence.customers.getById(draft.customerId)
  if (!customer || customer.organizationId !== organizationId) {
    return fail({ code: 'CUSTOMER_NOT_FOUND' })
  }
  const name = draft.name.trim()
  if (!name) {
    return fail({ code: 'INVALID_INPUT' })
  }
  if (!Number.isFinite(draft.price) || draft.price < 0) {
    return fail({ code: 'INVALID_INPUT' })
  }
  if (!isNonNegativeQuantity(draft.totalImplants) || draft.totalImplants <= 0) {
    return fail({ code: 'INVALID_INPUT' })
  }
  if (draft.responsibleEmployeeId) {
    const employee = persistence.users.getById(draft.responsibleEmployeeId)
    if (!employee || employee.organizationId !== organizationId) {
      return fail({ code: 'USER_NOT_FOUND' })
    }
  }
  const now = nowIso()
  const pkg: ImplantPackage = {
    id: newId(),
    organizationId,
    customerId: draft.customerId,
    name,
    price: draft.price,
    currency: draft.currency.trim() || 'KZT',
    totalImplants: draft.totalImplants,
    status: draft.status ?? 'draft',
    startDate: draft.startDate,
    endDate: optionalText(draft.endDate),
    responsibleEmployeeId: draft.responsibleEmployeeId,
    notes: optionalText(draft.notes),
    createdAt: now,
    updatedAt: now,
  }
  return ok(persistence.implantPackages.create(pkg))
}

export function updateImplantPackageForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  packageId: Id,
  patch: Partial<ImplantPackageWrite> & { status?: ImplantPackageStatus; contractId?: Id },
): ServiceResult<ImplantPackage> {
  const actor = requirePackagesActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  const existing = persistence.implantPackages.getById(packageId)
  if (!existing || existing.organizationId !== actor.value.organizationId) {
    return fail({ code: 'PACKAGE_NOT_FOUND' })
  }
  const updated = persistence.implantPackages.update(packageId, {
    ...patch,
    name: patch.name?.trim() ?? existing.name,
    notes: patch.notes !== undefined ? optionalText(patch.notes) : existing.notes,
    updatedAt: nowIso(),
  })
  if (!updated) {
    return fail({ code: 'PACKAGE_NOT_FOUND' })
  }
  return ok(updated)
}

export function listImplantPackagesForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  filter?: { status?: ImplantPackageStatus },
): ServiceResult<ImplantPackageRow[]> {
  const actor = requirePackagesActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  const rows = persistence.implantPackages
    .list(actor.value.organizationId)
    .filter((pkg) => (filter?.status ? pkg.status === filter.status : true))
    .map((pkg) => toRow(persistence, pkg))
  return ok(rows)
}

export function getImplantPackageForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  packageId: Id,
): ServiceResult<ImplantPackageRow> {
  const actor = requirePackagesActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  const pkg = persistence.implantPackages.getById(packageId)
  if (!pkg || pkg.organizationId !== actor.value.organizationId) {
    return fail({ code: 'PACKAGE_NOT_FOUND' })
  }
  return ok(toRow(persistence, pkg))
}

export function recordImplantPackageMovementForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: ImplantPackageMovementWrite,
): ServiceResult<ImplantPackageMovement> {
  const actor = requirePackagesActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  const organizationId = actor.value.organizationId
  const pkg = persistence.implantPackages.getById(draft.packageId)
  if (!pkg || pkg.organizationId !== organizationId) {
    return fail({ code: 'PACKAGE_NOT_FOUND' })
  }
  if (pkg.status === 'cancelled' || pkg.status === 'completed') {
    return fail({ code: 'PACKAGE_INVALID_STATUS' })
  }
  if (!isNonNegativeQuantity(draft.quantity) || draft.quantity <= 0) {
    return fail({ code: 'INVALID_QUANTITY' })
  }
  const product = persistence.products.getById(draft.productId)
  if (!product || product.organizationId !== organizationId) {
    return fail({ code: 'PRODUCT_NOT_FOUND' })
  }

  const balance = computePackageBalance(persistence, pkg)
  if (draft.movementType === 'issued' && balance.remaining < draft.quantity) {
    return fail({ code: 'INVALID_QUANTITY' })
  }

  const now = nowIso()
  const movement: ImplantPackageMovement = {
    id: newId(),
    organizationId,
    packageId: pkg.id,
    productId: draft.productId,
    warehouseId: draft.warehouseId,
    movementType: draft.movementType,
    quantity: draft.quantity,
    date: now,
    performedBy: actor.value.id,
    note: optionalText(draft.note),
    createdAt: now,
    updatedAt: now,
  }

  const needsWarehouse =
    draft.movementType === 'issued' ||
    draft.movementType === 'returned' ||
    draft.movementType === 'written_off'

  return persistence.runInTransaction(() => {
    if (needsWarehouse) {
      if (!draft.warehouseId) {
        return fail({ code: 'WAREHOUSE_NOT_FOUND' })
      }
      const warehouse = requireAccessibleWarehouse(
        persistence,
        actor.value,
        draft.warehouseId,
      )
      if (!warehouse.ok) {
        return warehouse
      }
      if (!hasEffectiveWarehousePermission(actor.value, 'inventory.adjust')) {
        return fail({ code: 'FORBIDDEN' })
      }
      const delta =
        draft.movementType === 'issued' || draft.movementType === 'written_off'
          ? -draft.quantity
          : draft.quantity
      const stocked = applyStockDeltas(persistence, organizationId, [
        {
          warehouseId: draft.warehouseId,
          productId: draft.productId,
          delta,
        },
      ])
      if (!stocked.ok) {
        return stocked
      }
      const moved = createMovements(persistence, organizationId, actor.value.id, [
        {
          warehouseId: draft.warehouseId,
          productId: draft.productId,
          type:
            draft.movementType === 'issued'
              ? 'shipment'
              : draft.movementType === 'returned'
                ? 'return'
                : 'adjustment',
          quantity: draft.quantity,
          note: `package:${pkg.id}:${draft.movementType}`,
        },
      ])
      if (!moved.ok) {
        return moved
      }
    }

    persistence.implantPackageMovements.create(movement)
    if (pkg.status === 'draft' && draft.movementType === 'issued') {
      persistence.implantPackages.update(pkg.id, {
        status: 'active',
        updatedAt: now,
      })
    }
    return ok(movement)
  })
}

export function listImplantPackageMovementsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  packageId?: Id,
): ServiceResult<ImplantPackageMovementRow[]> {
  const actor = requirePackagesActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  const organizationId = actor.value.organizationId
  const rows = persistence.implantPackageMovements
    .list(organizationId)
    .filter((item) => (packageId ? item.packageId === packageId : true))
    .map((movement) => {
      const pkg = persistence.implantPackages.getById(movement.packageId)
      const product = persistence.products.getById(movement.productId)
      const customer = pkg
        ? persistence.customers.getById(pkg.customerId)
        : undefined
      const performer = persistence.users.getById(movement.performedBy)
      return {
        movement,
        productName: product?.name ?? '',
        size: product?.size ?? '',
        customerName: customer
          ? getCustomerDisplayName(
              customer,
              persistence.contacts.list(organizationId),
              [],
            )
          : '',
        packageName: pkg?.name ?? '',
        performedByName: performer ? userDisplayName(performer) : '',
      }
    })
  return ok(rows)
}
