import type { Branch, Contact, Customer, Id, Product, User, UserRole, Warehouse } from '../types'
import type { DomainErrorCode } from '../types/domain-error'
import { deriveRentalBookingViewStatus } from '../types/rental-booking'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { setStock } from './inventory'
import { createPaymentForUser, listPaymentsForUser } from './create-payment'
import { newId, nowIso } from './primitives'
import {
  availableRentalQuantity,
  getRentalAvailabilityForUser,
} from './rental-availability'
import { rentalProductLockKey } from './rental-access'
import { getRentalAnalyticsForUser } from './rental-analytics'
import {
  cancelRentalBookingForUser,
  createAndReserveRentalBookingForUser,
  createRentalBookingForUser,
  getRentalBookingForUser,
  issueRentalBookingForUser,
  listRentalBookingsForCustomerForUser,
  listRentalBookingsForUser,
  reserveRentalBookingForUser,
  returnRentalBookingForUser,
} from './rental-bookings'
import { listRentalRemindersForUser } from './rental-reminders'
import {
  createPersonCustomerForRentalBookingForUser,
  createPersonCustomerForUser,
  findCustomerByContactPhone,
  listContactsForUser,
  type PersonCustomerResult,
} from './contacts'
import type { RentalPartyLookup } from './rental-party'
import { createRentalUnitForUser } from './rental-units'
import { createRentalBookingPaymentForUser } from './rental-payments'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function denied(
  result: { ok: boolean; error?: { code: DomainErrorCode } },
  code: DomainErrorCode,
  message: string,
): void {
  assert(!result.ok && result.error?.code === code, message)
}

function addOrg(persistence: Persistence, id: Id, name: string): void {
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

function addUser(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
  extra?: Partial<User>,
): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}-${newId()}@${organizationId}.local`,
    firstName: role,
    lastName: 'User',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...extra,
  }
  persistence.users.create(user)
  return user
}

function addBranch(
  persistence: Persistence,
  organizationId: Id,
  name: string,
): Branch {
  const now = nowIso()
  return persistence.branches.create({
    id: newId(),
    organizationId,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

function addWarehouse(
  persistence: Persistence,
  organizationId: Id,
  branchId: Id,
  name: string,
): Warehouse {
  const now = nowIso()
  return persistence.warehouses.create({
    id: newId(),
    organizationId,
    branchId,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

function addProduct(
  persistence: Persistence,
  organizationId: Id,
  name: string,
): Product {
  const now = nowIso()
  return persistence.products.create({
    id: newId(),
    organizationId,
    name,
    sku: `sku-${newId()}`,
    unit: 'pcs',
    itemType: 'product',
    basePrice: 100,
    costPrice: 50,
    status: 'active',
    imageUrl: 'data:image/png;base64,aaa',
    createdAt: now,
    updatedAt: now,
  })
}

const contacts = new Map<Id, Pick<Contact, 'organizationId' | 'phone' | 'firstName' | 'lastName'>>()

function lookup(): RentalPartyLookup {
  return {
    getContact: (id) => contacts.get(id),
    getCompany: () => undefined,
  }
}

function addCustomer(
  persistence: Persistence,
  organizationId: Id,
  phone = '+77001234567',
): Customer {
  const now = nowIso()
  const contactId = newId()
  contacts.set(contactId, {
    organizationId,
    phone,
    firstName: 'Client',
    lastName: 'One',
  })
  return persistence.customers.create({
    id: newId(),
    organizationId,
    type: 'contact',
    contactId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

function addCustomerWithoutPhone(
  persistence: Persistence,
  organizationId: Id,
): Customer {
  const now = nowIso()
  const contactId = newId()
  contacts.set(contactId, {
    organizationId,
    phone: '',
    firstName: 'No',
    lastName: 'Phone',
  })
  return persistence.customers.create({
    id: newId(),
    organizationId,
    type: 'contact',
    contactId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

function stockOf(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
  productId: Id,
): number {
  return (
    persistence.inventory.getByWarehouseAndProduct(
      organizationId,
      warehouseId,
      productId,
    )?.quantity ?? 0
  )
}

function bookingDraft(
  customerId: Id,
  warehouseId: Id,
  productId: Id,
  quantity: number,
  startAt: string,
  endAt: string,
  extra?: { subtotal?: number; total?: number; deposit?: number; prepayment?: number },
) {
  return {
    customerId,
    warehouseId,
    startAt,
    endAt,
    items: [{ productId, quantity }],
    ...extra,
  }
}

const existingStart = '2026-09-14T10:00:00.000Z'
const existingEnd = '2026-09-16T18:00:00.000Z'
const overlapStart = '2026-09-15T00:00:00.000Z'
const overlapEnd = '2026-09-17T00:00:00.000Z'
const afterBoundaryEnd = '2026-09-18T18:00:00.000Z'
const qtyStart = '2026-11-20T12:00:00.000Z'
const qtyEnd = '2026-11-22T12:00:00.000Z'
const qtyNextStart = '2026-11-23T12:00:00.000Z'
const qtyNextEnd = '2026-11-25T12:00:00.000Z'

export function runRentalChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-rental-a'
  const orgB = 'org-rental-b'
  const orgOff = 'org-rental-off'
  addOrg(persistence, orgA, 'Rental A')
  addOrg(persistence, orgB, 'Rental B')
  addOrg(persistence, orgOff, 'Rental Off')

  const ownerA = addUser(persistence, orgA, 'owner')
  const ownerB = addUser(persistence, orgB, 'owner')
  const ownerOff = addUser(persistence, orgOff, 'owner')
  const officeA = addUser(persistence, orgA, 'office_employee')
  const accountantA = addUser(persistence, orgA, 'accountant')
  const salesEmployeeA = addUser(persistence, orgA, 'sales_employee')
  const salesManagerA = addUser(persistence, orgA, 'sales_manager')
  const branchDirectorA = addUser(persistence, orgA, 'branch_director')
  const commercialDirectorA = addUser(persistence, orgA, 'commercial_director')
  seedEnabledBusinessModules(persistence, orgA, ownerA.id, ['rental'])
  seedEnabledBusinessModules(persistence, orgB, ownerB.id, ['rental'])

  const branchA = addBranch(persistence, orgA, 'Branch A')
  const branchB = addBranch(persistence, orgB, 'Branch B')
  const warehouseA = addWarehouse(persistence, orgA, branchA.id, 'WH A')
  const warehouseA2 = addWarehouse(persistence, orgA, branchA.id, 'WH A2')
  const warehouseB = addWarehouse(persistence, orgB, branchB.id, 'WH B')
  const warehouseManagerA = addUser(persistence, orgA, 'warehouse_manager', {
    branchId: branchA.id,
    warehouseId: warehouseA.id,
  })
  const productA = addProduct(persistence, orgA, 'Костюм 0723 — размер 50')
  const productB = addProduct(persistence, orgB, 'Foreign costume')
  const customerA = addCustomer(persistence, orgA)
  const customerA2 = addCustomer(persistence, orgA, '+77001230002')
  const customerA3 = addCustomer(persistence, orgA, '+77001230003')
  const customerNoPhone = addCustomerWithoutPhone(persistence, orgA)
  const customerCompany = persistence.customers.create({
    id: newId(),
    organizationId: orgA,
    type: 'company',
    status: 'active',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })
  const customerB = addCustomer(persistence, orgB)
  const customerCountStart = persistence.customers.list(orgA).length
  const warehouseCountStart = persistence.warehouses.list(orgA).length

  assert(setStock(persistence, orgA, warehouseA.id, productA.id, 3).ok, 'stock A = 3')
  assert(setStock(persistence, orgA, warehouseA2.id, productA.id, 2).ok, 'stock A2 = 2')
  assert(setStock(persistence, orgB, warehouseB.id, productB.id, 5).ok, 'stock B')
  assert(Boolean(productA.imageUrl), 'Q. product photo lives on Product')

  denied(
    createAndReserveRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      bookingDraft(customerA.id, warehouseA.id, productB.id, 1, existingStart, existingEnd),
      lookup(),
    ),
    'PRODUCT_NOT_FOUND',
    '3. foreign product denied',
  )
  denied(
    createAndReserveRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      bookingDraft(customerA.id, warehouseB.id, productA.id, 1, existingStart, existingEnd),
      lookup(),
    ),
    'WAREHOUSE_ORGANIZATION_MISMATCH',
    '4. foreign warehouse denied',
  )

  const bookingB = createRentalBookingForUser(
    persistence,
    ownerB,
    orgB,
    bookingDraft(customerB.id, warehouseB.id, productB.id, 1, existingStart, existingEnd),
    lookup(),
  )
  assert(bookingB.ok, 'create booking B')
  denied(
    getRentalBookingForUser(persistence, ownerA, bookingB.value.id),
    'ACCESS_DENIED',
    '5. foreign booking denied',
  )

  denied(
    createRentalBookingForUser(
      persistence,
      ownerOff,
      orgOff,
      bookingDraft(customerA.id, warehouseA.id, productA.id, 1, existingStart, existingEnd),
      lookup(),
    ),
    'MODULE_NOT_ENABLED',
    'N. rental module disabled',
  )

  denied(
    createRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      bookingDraft(customerNoPhone.id, warehouseA.id, productA.id, 1, existingStart, existingEnd),
      lookup(),
    ),
    'CUSTOMER_PHONE_REQUIRED',
    'P. phone required',
  )
  denied(
    createRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      bookingDraft(customerCompany.id, warehouseA.id, productA.id, 1, existingStart, existingEnd),
      lookup(),
    ),
    'CUSTOMER_PHONE_REQUIRED',
    'P. company customer has no rental phone',
  )
  denied(
    createRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      bookingDraft(customerB.id, warehouseA.id, productA.id, 1, existingStart, existingEnd),
      lookup(),
    ),
    'ORGANIZATION_MISMATCH',
    'L. foreign customer denied',
  )

  const versionBefore = persistence.getVersion()
  const open = getRentalAvailabilityForUser(persistence, ownerA, {
    organizationId: orgA,
    productId: productA.id,
    warehouseId: warehouseA.id,
    startAt: existingStart,
    endAt: existingEnd,
  })
  assert(open.ok && open.value.available === 3, 'unit-free stock available = 3')
  assert(
    persistence.getVersion() === versionBefore,
    'G/X. availability read does not bump version',
  )

  const draftBooking = createRentalBookingForUser(
    persistence,
    ownerA,
    orgA,
    {
      ...bookingDraft(customerA.id, warehouseA.id, productA.id, 1, existingStart, existingEnd),
      subtotal: 100,
      total: 100,
      deposit: 50,
    },
    lookup(),
  )
  assert(draftBooking.ok && draftBooking.value.status === 'draft', 'A. draft booking')
  assert(draftBooking.value.prepayment === 50, 'A. legacy deposit write maps to prepayment')
  assert(draftBooking.value.paidAmount === 0, 'AH. no payment on draft')
  assert(persistence.sales.list(orgA).length === 0, 'AH. no Sale on draft')
  const stillOpen = getRentalAvailabilityForUser(persistence, ownerA, {
    organizationId: orgA,
    productId: productA.id,
    warehouseId: warehouseA.id,
    startAt: overlapStart,
    endAt: overlapEnd,
  })
  assert(stillOpen.ok && stillOpen.value.available === 3, '10. draft does not block')

  persistence.rentalBookings.update(draftBooking.value.id, { status: 'reserved' })
  const blockedReserved = getRentalAvailabilityForUser(persistence, ownerA, {
    organizationId: orgA,
    productId: productA.id,
    warehouseId: warehouseA.id,
    startAt: overlapStart,
    endAt: overlapEnd,
  })
  assert(blockedReserved.ok && blockedReserved.value.available === 2, 'H. reserved overlap books 1')

  const boundary = getRentalAvailabilityForUser(persistence, ownerA, {
    organizationId: orgA,
    productId: productA.id,
    warehouseId: warehouseA.id,
    startAt: existingEnd,
    endAt: afterBoundaryEnd,
  })
  assert(boundary.ok && boundary.value.available === 3, 'I. boundary endAt === startAt allows')

  persistence.rentalBookings.update(draftBooking.value.id, { status: 'issued' })
  const blockedIssued = getRentalAvailabilityForUser(persistence, ownerA, {
    organizationId: orgA,
    productId: productA.id,
    warehouseId: warehouseA.id,
    startAt: overlapStart,
    endAt: overlapEnd,
  })
  assert(blockedIssued.ok && blockedIssued.value.available === 2, '12. issued blocks')

  persistence.rentalBookings.update(draftBooking.value.id, { status: 'cancelled' })
  const afterCancel = getRentalAvailabilityForUser(persistence, ownerA, {
    organizationId: orgA,
    productId: productA.id,
    warehouseId: warehouseA.id,
    startAt: overlapStart,
    endAt: overlapEnd,
  })
  assert(afterCancel.ok && afterCancel.value.available === 3, '13. cancelled does not block')

  persistence.rentalBookings.update(draftBooking.value.id, { status: 'returned' })
  const afterReturn = getRentalAvailabilityForUser(persistence, ownerA, {
    organizationId: orgA,
    productId: productA.id,
    warehouseId: warehouseA.id,
    startAt: overlapStart,
    endAt: overlapEnd,
  })
  assert(afterReturn.ok && afterReturn.value.available === 3, '14. returned does not block')

  const issuedNow = createRentalBookingForUser(
    persistence,
    ownerA,
    orgA,
    bookingDraft(customerA.id, warehouseA.id, productA.id, 1, existingStart, existingEnd),
    lookup(),
  )
  assert(issuedNow.ok, 'booking for view status')
  persistence.rentalBookings.update(issuedNow.value.id, { status: 'issued' })
  const activeView = getRentalBookingForUser(
    persistence,
    ownerA,
    issuedNow.value.id,
    '2026-09-15T12:00:00.000Z',
  )
  assert(
    activeView.ok &&
      activeView.value.status === 'issued' &&
      activeView.value.viewStatus === 'active',
    'F. active is read-time',
  )
  const overdueView = getRentalBookingForUser(
    persistence,
    ownerA,
    issuedNow.value.id,
    '2026-09-16T18:00:00.000Z',
  )
  assert(
    overdueView.ok &&
      overdueView.value.status === 'issued' &&
      overdueView.value.viewStatus === 'overdue',
    'F. overdue is read-time',
  )
  const stored = persistence.rentalBookings.getById(issuedNow.value.id)
  assert(stored?.status === 'issued', 'F. persisted status stays issued')
  assert(
    deriveRentalBookingViewStatus(stored, '2026-09-15T12:00:00.000Z') ===
      'active',
    'F. derive helper',
  )

  const spoofed = getRentalAvailabilityForUser(persistence, ownerA, {
    organizationId: orgB,
    productId: productB.id,
    warehouseId: warehouseB.id,
    startAt: existingStart,
    endAt: existingEnd,
  })
  denied(spoofed, 'ACCESS_DENIED', 'K. payload org B denied for owner A')

  denied(
    listRentalBookingsForUser(persistence, officeA, orgA),
    'ACCESS_DENIED',
    'O. office cannot read rental',
  )
  const accountantRead = listRentalBookingsForUser(persistence, accountantA, orgA)
  assert(accountantRead.ok, 'O. accountant can read')
  denied(
    createRentalBookingForUser(
      persistence,
      accountantA,
      orgA,
      bookingDraft(customerA.id, warehouseA.id, productA.id, 1, existingStart, existingEnd),
      lookup(),
    ),
    'ACCESS_DENIED',
    'O. accountant cannot create booking',
  )

  const bookingsBeforeFail = persistence.rentalBookings.list(orgA).length
  denied(
    createRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      {
        customerId: customerA.id,
        warehouseId: warehouseA.id,
        startAt: existingStart,
        endAt: existingEnd,
        items: [
          { productId: productA.id, quantity: 1 },
          { productId: productB.id, quantity: 1 },
        ],
      },
      lookup(),
    ),
    'PRODUCT_NOT_FOUND',
    'J. mixed-org products denied',
  )
  assert(
    persistence.rentalBookings.list(orgA).length === bookingsBeforeFail,
    'J. failed create is atomic',
  )

  const movementsBeforeLifecycle = persistence.stockMovements.list(orgA).length
  const lifecycle = createRentalBookingForUser(
    persistence,
    ownerA,
    orgA,
    {
      ...bookingDraft(
        customerA.id,
        warehouseA.id,
        productA.id,
        1,
        '2026-09-20T10:00:00.000Z',
        '2026-09-21T10:00:00.000Z',
      ),
      subtotal: 200,
      total: 200,
      deposit: 80,
    },
    lookup(),
  )
  assert(lifecycle.ok, 'A. lifecycle draft')
  const reserved = reserveRentalBookingForUser(
    persistence,
    ownerA,
    lifecycle.value.id,
    lookup(),
  )
  assert(reserved.ok && reserved.value.status === 'reserved', 'B. reserve')
  assert(reserved.value.prepayment === 80, 'B. prepayment is agreed amount')
  assert(reserved.value.depositHeld === 0, 'B. reserve does not hold deposit')
  assert(persistence.sales.list(orgA).length === 0, 'AH. no Sale on reserve')
  assert(stockOf(persistence, orgA, warehouseA.id, productA.id) === 3, 'B. reserve does not change stock')
  denied(
    reserveRentalBookingForUser(
      persistence,
      ownerA,
      lifecycle.value.id,
      lookup(),
    ),
    'RENTAL_INVALID_STATUS',
    'AA. second reserve denied',
  )

  denied(
    issueRentalBookingForUser(persistence, accountantA, lifecycle.value.id),
    'ACCESS_DENIED',
    'O. accountant cannot issue',
  )

  const issued = issueRentalBookingForUser(
    persistence,
    ownerA,
    lifecycle.value.id,
  )
  assert(issued.ok && issued.value.status === 'issued', 'D. issue')
  assert(issued.value.issuedBy === ownerA.id, 'D. issuedBy')
  assert(stockOf(persistence, orgA, warehouseA.id, productA.id) === 3, 'S. issue does not decrement Product stock')
  denied(
    cancelRentalBookingForUser(persistence, ownerA, lifecycle.value.id),
    'RENTAL_INVALID_STATUS',
    'AB. issued cannot cancel',
  )

  const returned = returnRentalBookingForUser(
    persistence,
    ownerA,
    lifecycle.value.id,
    'ok',
  )
  assert(returned.ok && returned.value.status === 'returned', 'E. return')
  assert(returned.value.prepayment === 80, 'E. return does not change prepayment')
  assert(returned.value.depositReturned === 0, 'E. return does not refund prepayment')
  assert(stockOf(persistence, orgA, warehouseA.id, productA.id) === 3, 'T. return does not change stock')
  assert(
    persistence.stockMovements.list(orgA).length === movementsBeforeLifecycle,
    'T. return does not create stock movement',
  )
  denied(
    cancelRentalBookingForUser(persistence, ownerA, lifecycle.value.id),
    'RENTAL_INVALID_STATUS',
    'AB. returned cannot cancel',
  )
  denied(
    returnRentalBookingForUser(
      persistence,
      ownerA,
      lifecycle.value.id,
      'ok',
    ),
    'RENTAL_INVALID_STATUS',
    'AB. cannot return twice',
  )

  const problemDraft = createRentalBookingForUser(
    persistence,
    ownerA,
    orgA,
    bookingDraft(
      customerA.id,
      warehouseA.id,
      productA.id,
      1,
      '2026-09-22T10:00:00.000Z',
      '2026-09-23T10:00:00.000Z',
    ),
    lookup(),
  )
  assert(problemDraft.ok, 'problem draft')
  assert(
    reserveRentalBookingForUser(
      persistence,
      ownerA,
      problemDraft.value.id,
      lookup(),
    ).ok,
    'problem reserve',
  )
  assert(
    issueRentalBookingForUser(persistence, ownerA, problemDraft.value.id).ok,
    'problem issue',
  )
  const damaged = returnRentalBookingForUser(
    persistence,
    ownerA,
    problemDraft.value.id,
    'damaged',
    'tear',
  )
  assert(damaged.ok && damaged.value.returnCondition === 'damaged', 'U. damaged return')
  assert(stockOf(persistence, orgA, warehouseA.id, productA.id) === 3, 'U. damaged return does not change stock')

  const cancelDraft = createRentalBookingForUser(
    persistence,
    ownerA,
    orgA,
    bookingDraft(
      customerA.id,
      warehouseA.id,
      productA.id,
      1,
      '2026-09-24T10:00:00.000Z',
      '2026-09-25T10:00:00.000Z',
    ),
    lookup(),
  )
  assert(cancelDraft.ok, 'cancel draft')
  const cancelled = cancelRentalBookingForUser(
    persistence,
    ownerA,
    cancelDraft.value.id,
  )
  assert(cancelled.ok && cancelled.value.status === 'cancelled', 'C. cancel draft')

  const ownBooking = getRentalBookingForUser(
    persistence,
    warehouseManagerA,
    lifecycle.value.id,
  )
  assert(ownBooking.ok, 'M. warehouse manager can read own warehouse booking')

  const otherWhBooking = createRentalBookingForUser(
    persistence,
    ownerA,
    orgA,
    bookingDraft(
      customerA.id,
      warehouseA2.id,
      productA.id,
      1,
      '2026-09-26T10:00:00.000Z',
      '2026-09-27T10:00:00.000Z',
    ),
    lookup(),
  )
  assert(otherWhBooking.ok, 'booking on WH A2')
  denied(
    getRentalBookingForUser(persistence, warehouseManagerA, otherWhBooking.value.id),
    'ACCESS_DENIED',
    'M. warehouse scope hides other warehouse booking',
  )

  const scenarioA = createAndReserveRentalBookingForUser(
    persistence,
    ownerA,
    orgA,
    bookingDraft(customerA.id, warehouseA.id, productA.id, 2, qtyStart, qtyEnd),
    lookup(),
  )
  assert(scenarioA.ok && scenarioA.value.status === 'reserved', 'scenario 1 A qty 2')
  const scenarioB = createAndReserveRentalBookingForUser(
    persistence,
    ownerA,
    orgA,
    bookingDraft(customerA2.id, warehouseA.id, productA.id, 1, qtyStart, qtyEnd),
    lookup(),
  )
  assert(scenarioB.ok, 'scenario 1 B qty 1')
  denied(
    createAndReserveRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      bookingDraft(customerA3.id, warehouseA.id, productA.id, 1, qtyStart, qtyEnd),
      lookup(),
    ),
    'RENTAL_QUANTITY_UNAVAILABLE',
    'scenario 1 C insufficient',
  )

  const nonOverlap = createAndReserveRentalBookingForUser(
    persistence,
    ownerA,
    orgA,
    bookingDraft(customerA.id, warehouseA.id, productA.id, 3, qtyNextStart, qtyNextEnd),
    lookup(),
  )
  assert(nonOverlap.ok, 'scenario 2 non-overlapping qty 3')

  const oneClientTwo = createAndReserveRentalBookingForUser(
    persistence,
    ownerA,
    orgA,
    bookingDraft(
      customerA.id,
      warehouseA.id,
      productA.id,
      2,
      '2026-12-01T12:00:00.000Z',
      '2026-12-02T12:00:00.000Z',
    ),
    lookup(),
  )
  assert(oneClientTwo.ok && oneClientTwo.value.items[0]?.quantity === 2, 'scenario 3 one client qty 2')

  const tripleStart = '2026-12-10T12:00:00.000Z'
  const tripleEnd = '2026-12-12T12:00:00.000Z'
  assert(
    createAndReserveRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      bookingDraft(customerA.id, warehouseA.id, productA.id, 1, tripleStart, tripleEnd),
      lookup(),
    ).ok,
    'scenario 4 client 1',
  )
  assert(
    createAndReserveRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      bookingDraft(customerA2.id, warehouseA.id, productA.id, 1, tripleStart, tripleEnd),
      lookup(),
    ).ok,
    'scenario 4 client 2',
  )
  assert(
    createAndReserveRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      bookingDraft(customerA3.id, warehouseA.id, productA.id, 1, tripleStart, tripleEnd),
      lookup(),
    ).ok,
    'scenario 4 client 3',
  )

  const splitStart = '2026-12-20T12:00:00.000Z'
  const splitEnd = '2026-12-22T12:00:00.000Z'
  assert(
    createAndReserveRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      bookingDraft(customerA.id, warehouseA.id, productA.id, 2, splitStart, splitEnd),
      lookup(),
    ).ok,
    'scenario 5 qty 2',
  )
  assert(
    createAndReserveRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      bookingDraft(customerA2.id, warehouseA.id, productA.id, 1, splitStart, splitEnd),
      lookup(),
    ).ok,
    'scenario 5 qty 1',
  )

  const lockKey = rentalProductLockKey(orgA, warehouseA.id, productA.id)
  assert(persistence.locks.tryAcquire(lockKey), 'concurrent lock acquired')
  denied(
    createAndReserveRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      bookingDraft(
        customerA.id,
        warehouseA.id,
        productA.id,
        2,
        '2027-01-01T12:00:00.000Z',
        '2027-01-03T12:00:00.000Z',
      ),
      lookup(),
    ),
    'RENTAL_QUANTITY_UNAVAILABLE',
    'scenario 10 concurrent lock blocks second writer',
  )
  persistence.locks.release(lockKey)
  const concurrentA = createAndReserveRentalBookingForUser(
    persistence,
    ownerA,
    orgA,
    bookingDraft(
      customerA.id,
      warehouseA.id,
      productA.id,
      2,
      '2027-01-01T12:00:00.000Z',
      '2027-01-03T12:00:00.000Z',
    ),
    lookup(),
  )
  assert(concurrentA.ok, 'scenario 10 first 2 succeeds')
  denied(
    createAndReserveRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      bookingDraft(
        customerA2.id,
        warehouseA.id,
        productA.id,
        2,
        '2027-01-01T12:00:00.000Z',
        '2027-01-03T12:00:00.000Z',
      ),
      lookup(),
    ),
    'RENTAL_QUANTITY_UNAVAILABLE',
    'scenario 10 second 2 denied',
  )

  const legacyUnit = createRentalUnitForUser(persistence, ownerA, orgA, {
    productId: productA.id,
    warehouseId: warehouseA.id,
    code: 'legacy-001',
  })
  assert(legacyUnit.ok, 'legacy unit kept for old data')
  const now = nowIso()
  const legacyBooking = persistence.rentalBookings.create({
    id: newId(),
    organizationId: orgA,
    customerId: customerA.id,
    warehouseId: warehouseA.id,
    startAt: '2027-02-01T12:00:00.000Z',
    endAt: '2027-02-03T12:00:00.000Z',
    status: 'reserved',
    subtotal: 0,
    discount: 0,
    total: 0,
    deposit: 0,
    depositHeld: 0,
    depositReturned: 0,
    paidAmount: 0,
    createdBy: ownerA.id,
    createdAt: now,
    updatedAt: now,
  })
  persistence.rentalBookingItems.create({
    id: newId(),
    organizationId: orgA,
    bookingId: legacyBooking.id,
    productId: '',
    unitId: legacyUnit.value.id,
    quantity: 0,
    createdAt: now,
    updatedAt: now,
  })
  persistence.rentalBookingItems.create({
    id: newId(),
    organizationId: orgA,
    bookingId: legacyBooking.id,
    productId: '',
    unitId: legacyUnit.value.id,
    quantity: 0,
    createdAt: now,
    updatedAt: now,
  })
  const migrated = getRentalBookingForUser(persistence, ownerA, legacyBooking.id)
  assert(
    migrated.ok &&
      migrated.value.items.length === 1 &&
      migrated.value.items[0]?.productId === productA.id &&
      migrated.value.items[0]?.quantity === 2,
    'legacy unit items group by productId with quantity 2',
  )
  assert(
    availableRentalQuantity(persistence, {
      organizationId: orgA,
      productId: productA.id,
      warehouseId: warehouseA.id,
      startAt: '2027-02-01T12:00:00.000Z',
      endAt: '2027-02-03T12:00:00.000Z',
    }) === 1,
    'legacy grouped quantity blocks availability',
  )

  const snapshotLegacy = persistence.capture()
  snapshotLegacy.restore()
  const restoredLegacy = getRentalBookingForUser(persistence, ownerA, legacyBooking.id)
  assert(
    restoredLegacy.ok &&
      restoredLegacy.value.items[0]?.productId === productA.id &&
      restoredLegacy.value.items[0]?.quantity === 2,
    'F5 migrate restores productId + quantity',
  )

  const readVersion = persistence.getVersion()
  const reminders = listRentalRemindersForUser(
    persistence,
    ownerA,
    orgA,
    '2026-09-14T12:00:00.000Z',
  )
  assert(reminders.ok, 'Y. reminders read')
  const analytics = getRentalAnalyticsForUser(
    persistence,
    ownerA,
    orgA,
    '2026-09-16T18:00:00.000Z',
  )
  assert(analytics.ok && analytics.value.totals.bookings > 0, 'V. analytics reads rental')
  assert(analytics.value.overdue.length >= 1, 'V. overdue in analytics')
  assert(analytics.value.byCustomer.length >= 1, 'V. customer report')
  assert(analytics.value.byProduct.some((row) => row.quantity >= 2), 'V. quantity counted')
  assert(
    persistence.getVersion() === readVersion,
    'W/Y. analytics and reminders do not mutate',
  )

  const history = listRentalBookingsForCustomerForUser(
    persistence,
    ownerA,
    orgA,
    customerA.id,
  )
  assert(history.ok && history.value.length > 0, 'customer rental history')

  const audits = persistence.accessChangeLogs
    .list(orgA)
    .filter((entry) => entry.field.startsWith('rental.booking.'))
  assert(
    audits.some((entry) => entry.nextValue === 'reserved') &&
      audits.some((entry) => entry.nextValue === 'issued') &&
      audits.some((entry) => entry.nextValue === 'returned') &&
      audits.some((entry) => entry.nextValue === 'cancelled'),
    'AC. audit entries for reserve/issue/return/cancel',
  )

  assert(
    persistence.customers.list(orgA).length === customerCountStart,
    'AD. no duplicate Customer',
  )
  assert(
    persistence.warehouses.list(orgA).length === warehouseCountStart,
    'AE. no duplicate Warehouse',
  )
  assert(persistence.sales.list(orgA).length === 0, 'AH. still no automatic Sale')

  const payable = createRentalBookingForUser(
    persistence,
    ownerA,
    orgA,
    {
      ...bookingDraft(
        customerA.id,
        warehouseA.id,
        productA.id,
        1,
        '2026-10-01T10:00:00.000Z',
        '2026-10-02T10:00:00.000Z',
      ),
      subtotal: 50,
      total: 50,
      prepayment: 30,
    },
    lookup(),
  )
  assert(payable.ok && payable.value.paidAmount === 0, 'payable draft unpaid')

  denied(
    createRentalBookingPaymentForUser(persistence, accountantA, {
      organizationId: orgA,
      rentalBookingId: payable.value.id,
      amount: 10,
      method: 'cash',
      currency: 'KZT',
    }),
    'ACCESS_DENIED',
    'accountant cannot take rental payment',
  )
  denied(
    createRentalBookingPaymentForUser(persistence, ownerB, {
      organizationId: orgA,
      rentalBookingId: payable.value.id,
      amount: 10,
      method: 'cash',
      currency: 'KZT',
    }),
    'ACCESS_DENIED',
    '10. cross-org payment denied',
  )
  denied(
    createRentalBookingPaymentForUser(persistence, ownerA, {
      organizationId: orgA,
      rentalBookingId: bookingB.value.id,
      amount: 10,
      method: 'cash',
      currency: 'KZT',
    }),
    'ORGANIZATION_MISMATCH',
    '11. cross-org booking payment denied',
  )
  denied(
    createRentalBookingPaymentForUser(persistence, ownerA, {
      organizationId: orgA,
      rentalBookingId: payable.value.id,
      amount: 80,
      method: 'cash',
      currency: 'KZT',
    }),
    'PAYMENT_LIMIT_EXCEEDED',
    '8. overpayment denied',
  )

  const firstPay = createRentalBookingPaymentForUser(persistence, ownerA, {
    organizationId: orgA,
    rentalBookingId: payable.value.id,
    amount: 30,
    method: 'cash',
    currency: 'KZT',
  })
  assert(firstPay.ok && firstPay.value.rentalBookingId === payable.value.id, '1/2. rental payment linked')
  assert(!firstPay.value.saleId, '3. payment has no saleId')
  assert(persistence.sales.list(orgA).length === 0, '3. Sale not created')
  const afterPartial = getRentalBookingForUser(persistence, ownerA, payable.value.id)
  assert(
    afterPartial.ok &&
      afterPartial.value.prepayment === 30 &&
      afterPartial.value.paidAmount === 30,
    '4/6. prepayment stays 30, paidAmount from payments',
  )
  assert(
    afterPartial.value.total - afterPartial.value.paidAmount === 20,
    '5. balance 20',
  )
  assert(
    persistence.rentalBookings.getById(payable.value.id)?.paidAmount === 0,
    '16. persisted paidAmount is not the source of truth',
  )
  persistence.rentalBookings.update(payable.value.id, { paidAmount: 50000 })
  const notSpoofed = getRentalBookingForUser(persistence, ownerA, payable.value.id)
  assert(
    notSpoofed.ok && notSpoofed.value.paidAmount === 30,
    '16/17. spoofed paidAmount ignored',
  )

  const secondPay = createRentalBookingPaymentForUser(persistence, ownerA, {
    organizationId: orgA,
    rentalBookingId: payable.value.id,
    amount: 20,
    method: 'card',
    currency: 'KZT',
  })
  assert(secondPay.ok && secondPay.value.id !== firstPay.value.id, '23. second explicit payment is new record')
  const afterFull = getRentalBookingForUser(persistence, ownerA, payable.value.id)
  assert(
    afterFull.ok &&
      afterFull.value.prepayment === 30 &&
      afterFull.value.paidAmount === 50 &&
      afterFull.value.total - afterFull.value.paidAmount === 0,
    '7. full payment, prepayment unchanged',
  )
  assert(persistence.sales.list(orgA).length === 0, '7. Sale still not created')
  denied(
    createRentalBookingPaymentForUser(persistence, ownerA, {
      organizationId: orgA,
      rentalBookingId: payable.value.id,
      amount: 1,
      method: 'cash',
      currency: 'KZT',
    }),
    'PAYMENT_LIMIT_EXCEEDED',
    '8. no overpayment after full',
  )

  assert(
    reserveRentalBookingForUser(
      persistence,
      ownerA,
      payable.value.id,
      lookup(),
    ).ok,
    'payable reserve after payments',
  )
  assert(
    issueRentalBookingForUser(persistence, ownerA, payable.value.id).ok,
    'payable issue',
  )
  const afterReturnPaid = returnRentalBookingForUser(
    persistence,
    ownerA,
    payable.value.id,
    'ok',
  )
  assert(
    afterReturnPaid.ok &&
      afterReturnPaid.value.prepayment === 30 &&
      afterReturnPaid.value.paidAmount === 50 &&
      afterReturnPaid.value.total - afterReturnPaid.value.paidAmount === 0 &&
      afterReturnPaid.value.depositReturned === 0,
    '11. return OK does not change prepayment or paidAmount',
  )
  assert(persistence.sales.list(orgA).length === 0, '11. no Sale on rental return')
  assert(
    persistence.payments.listByRentalBookingId(orgA, payable.value.id).length === 2,
    '11. no refund payment created',
  )
  assert(stockOf(persistence, orgA, warehouseA.id, productA.id) === 3, 'scenario 6 stock still 3')

  const cancelledPay = createRentalBookingForUser(
    persistence,
    ownerA,
    orgA,
    {
      ...bookingDraft(
        customerA.id,
        warehouseA.id,
        productA.id,
        1,
        '2026-10-03T10:00:00.000Z',
        '2026-10-04T10:00:00.000Z',
      ),
      subtotal: 10,
      total: 10,
    },
    lookup(),
  )
  assert(cancelledPay.ok, 'cancel-pay draft')
  assert(
    cancelRentalBookingForUser(persistence, ownerA, cancelledPay.value.id).ok,
    'cancel payable',
  )
  denied(
    createRentalBookingPaymentForUser(persistence, ownerA, {
      organizationId: orgA,
      rentalBookingId: cancelledPay.value.id,
      amount: 10,
      method: 'cash',
      currency: 'KZT',
    }),
    'RENTAL_INVALID_STATUS',
    '9. cancelled booking payment denied',
  )

  const paidAnalyticsVersion = persistence.getVersion()
  const paidAnalytics = getRentalAnalyticsForUser(
    persistence,
    ownerA,
    orgA,
    '2026-10-01T12:00:00.000Z',
  )
  assert(
    paidAnalytics.ok && paidAnalytics.value.totals.paidAmount === 50,
    '14. analytics paid from payments',
  )
  const payableRow = paidAnalytics.ok
    ? paidAnalytics.value.rows.find((row) => row.bookingId === payable.value.id)
    : undefined
  assert(
    payableRow?.prepayment === 30 && payableRow.paidAmount === 50,
    '13. prepayment is agreed amount, paidAmount from payments',
  )
  assert(
    persistence.getVersion() === paidAnalyticsVersion,
    '15. analytics does not mutate',
  )
  assert(
    persistence.accessChangeLogs
      .list(orgA)
      .some((entry) => entry.field.includes(`${payable.value.id}.payment`)),
    'payment audit',
  )

  seedEnabledBusinessModules(persistence, orgA, ownerA.id, ['sales'])
  const saleNow = nowIso()
  const sale = persistence.sales.create({
    id: newId(),
    organizationId: orgA,
    warehouseId: warehouseA.id,
    status: 'completed',
    currency: 'KZT',
    subtotal: 40,
    discount: 0,
    total: 40,
    createdAt: saleNow,
    updatedAt: saleNow,
  })
  const salePayment = createPaymentForUser(persistence, ownerA, {
    organizationId: orgA,
    createdBy: ownerA.id,
    saleId: sale.id,
    amount: 15,
    method: 'cash',
  })
  assert(salePayment.ok && salePayment.value.saleId === sale.id, '18. sale payment still works')
  const listedSalePayments = listPaymentsForUser(persistence, ownerA)
  assert(
    listedSalePayments.ok &&
      listedSalePayments.value.some((item) => item.id === salePayment.value.id) &&
      !listedSalePayments.value.some((item) => item.id === firstPay.value.id),
    '18. sale payment list excludes rental payments',
  )
  const rentalStill = getRentalBookingForUser(persistence, ownerA, payable.value.id)
  assert(rentalStill.ok && rentalStill.value.paidAmount === 50, 'rental paid unchanged by sale payment')

  const snapshot = persistence.capture()
  snapshot.restore()
  assert(
    persistence.rentalBookings.list(orgA).length > 0 &&
      persistence.rentalUnits.list(orgA).length > 0 &&
      persistence.rentalBookingItems.list(orgA).length > 0 &&
      persistence.payments.list(orgA).length >= 3,
    '22. capture/restore keeps rental payments',
  )

  denied(
    createPersonCustomerForUser(persistence, officeA, {
      fullName: 'Офис Клиент',
      phone: '+77001112233',
    }),
    'MODULE_NOT_ENABLED',
    '12. CRM person create still requires crm module',
  )
  denied(
    createPersonCustomerForUser(persistence, ownerA, {
      fullName: 'CRM Gate',
      phone: '+77001110000',
    }),
    'MODULE_NOT_ENABLED',
    '12. rental owner without crm cannot use CRM customer service',
  )
  denied(
    createPersonCustomerForUser(persistence, ownerOff, {
      fullName: 'Off Client',
      phone: '+77004445566',
    }),
    'MODULE_NOT_ENABLED',
    '12/18. crm module gate',
  )
  denied(
    createPersonCustomerForRentalBookingForUser(persistence, ownerOff, {
      fullName: 'Off Client',
      phone: '+77004445566',
    }),
    'MODULE_NOT_ENABLED',
    'rental customer: no rental module',
  )

  const rentalPersonByRole: Array<[User, string, string]> = [
    [ownerA, 'Айдар Багым', '+7 777 123 45 67'],
    [salesEmployeeA, 'Продавец Клиент', '+77005550202'],
    [salesManagerA, 'Менеджер Клиент', '+77005550303'],
    [branchDirectorA, 'Директор Филиала', '+77005550404'],
    [commercialDirectorA, 'Коммерческий Директор', '+77005550505'],
    [warehouseManagerA, 'Склад Клиент', '+77005550101'],
    [officeA, 'Офис Клиент', '+77001112233'],
    [accountantA, 'Бухгалтер Клиент', '+77001113344'],
  ]
  const createdByRole: PersonCustomerResult[] = []
  for (const [actor, fullName, phone] of rentalPersonByRole) {
    const created = createPersonCustomerForRentalBookingForUser(persistence, actor, {
      fullName,
      phone,
    })
    assert(
      created.ok &&
        created.value.status === 'created' &&
        created.value.customer.organizationId === orgA &&
        created.value.contact.organizationId === orgA,
      `rental ${actor.role} can create customer from booking without CRM`,
    )
    createdByRole.push(created.value)
  }
  const createdPerson = createdByRole[0]
  assert(createdPerson, 'owner customer exists')
  assert(
    createdByRole[6]?.contact.phone === '+77001112233',
    'office_employee can create customer from rental booking',
  )
  assert(
    createdByRole[7]?.contact.phone === '+77001113344',
    'accountant can create customer from rental booking',
  )
  assert(createdPerson.contact.phone === '+7 777 123 45 67', '4. contact phone stored')

  const personBooking = createRentalBookingForUser(
    persistence,
    ownerA,
    orgA,
    bookingDraft(
      createdPerson.customer.id,
      warehouseA.id,
      productA.id,
      1,
      '2026-10-01T10:00:00.000Z',
      '2026-10-02T10:00:00.000Z',
    ),
    {
      getContact: (id) => persistence.contacts.getById(id),
      getCompany: () => undefined,
    },
  )
  assert(
    personBooking.ok &&
      personBooking.value.customerId === createdPerson.customer.id,
    '3/5. booking uses created customerId',
  )
  assert(
    !('phone' in personBooking.value) ||
      !Object.prototype.hasOwnProperty.call(personBooking.value, 'phone'),
    '13. booking has no phone field',
  )

  const duplicatePerson = createPersonCustomerForRentalBookingForUser(
    persistence,
    salesEmployeeA,
    {
      fullName: 'Другой Человек',
      phone: '87771234567',
    },
  )
  assert(
    duplicatePerson.ok &&
      duplicatePerson.value.status === 'duplicate' &&
      duplicatePerson.value.customer.id === createdPerson.customer.id,
    '11. duplicate phone reuses customer',
  )
  assert(
    persistence.customers.list(orgA).filter(
      (item) => item.contactId === createdPerson.contact.id,
    ).length === 1,
    '11. no second customer',
  )

  const found = findCustomerByContactPhone(persistence, orgA, '77771234567')
  assert(found?.customer.id === createdPerson.customer.id, '11. phone lookup')

  const orgBPerson = createPersonCustomerForRentalBookingForUser(
    persistence,
    ownerB,
    {
      fullName: 'Чужой Клиент',
      phone: '+77009998877',
    },
  )
  assert(
    orgBPerson.ok && orgBPerson.value.customer.organizationId === orgB,
    '9. rental create uses actor organization only',
  )
  assert(
    persistence.customers.getById(orgBPerson.value.customer.id)?.organizationId !==
      orgA,
    '8. rental company cannot create customer in another org',
  )
  const crossCustomer = getRentalBookingForUser(
    persistence,
    ownerA,
    personBooking.value.id,
  )
  assert(crossCustomer.ok, 'existing booking still readable')
  denied(
    createRentalBookingForUser(
      persistence,
      ownerA,
      orgA,
      bookingDraft(
        orgBPerson.value.customer.id,
        warehouseA.id,
        productA.id,
        1,
        '2026-10-03T10:00:00.000Z',
        '2026-10-04T10:00:00.000Z',
      ),
      lookup(),
    ),
    'ORGANIZATION_MISMATCH',
    '8. foreign customer denied on booking',
  )

  const restoreAfterPerson = persistence.capture()
  restoreAfterPerson.restore()
  assert(
    persistence.contacts.getById(createdPerson.contact.id)?.phone ===
      '+7 777 123 45 67' &&
      persistence.customers.getById(createdPerson.customer.id)?.id ===
        createdPerson.customer.id &&
      persistence.rentalBookings.getById(personBooking.value.id)?.customerId ===
        createdPerson.customer.id,
    '6/7. F5 keeps contact, customer, booking',
  )

  seedEnabledBusinessModules(persistence, orgA, ownerA.id, ['crm'])
  const personVersion = persistence.getVersion()
  const listedContacts = listContactsForUser(persistence, ownerA, orgA)
  assert(listedContacts.ok, '18. contact list')
  assert(
    persistence.getVersion() === personVersion,
    '18. list contacts does not mutate persistence',
  )

  console.log('rental.verify: ok')
}

runRentalChecks()
