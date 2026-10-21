import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import {
  createCustomer,
  normalizeCustomerTaxId,
  updateCustomerForUser,
} from './customers'
import { exportExcelDatasetForUser } from './excel-export'
import { parseExcelWorkbook } from '../utils/excel-workbook'
import { addOrg, addUser } from './sales-invoice.verify'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

// Synthetic test IDs use a zero prefix and a sequence; never use customer identifiers here.
export function runCustomerTaxIdChecks(): void {
  const spaces = normalizeCustomerTaxId('000 000 000 004')
  assert(spaces.ok && spaces.value === '000000000004', 'strip spaces')
  const empty = normalizeCustomerTaxId('   ')
  assert(empty.ok && empty.value === undefined, 'optional empty')
  const invalid = normalizeCustomerTaxId('12345')
  assert(!invalid.ok && invalid.error.code === 'CUSTOMER_TAX_ID_INVALID', '12 digits')

  const persistence = createInMemoryPersistence()
  const org = 'org-tax-id'
  addOrg(persistence, org, 'DSK')
  seedEnabledBusinessModules(persistence, org, 'seed', ['crm', 'sales'])
  const owner = addUser(persistence, org, 'owner')
  const now = nowIso()
  const contactId = newId()
  persistence.contacts.create({
    id: contactId,
    organizationId: org,
    firstName: 'Али',
    lastName: 'Клиент',
    email: 'a@b.c',
    phone: '+77001234567',
    companyId: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const lookup = {
    getContact: (id: string) => persistence.contacts.getById(id),
    getCompany: () => undefined,
  }
  const created = createCustomer(
    persistence,
    org,
    {
      type: 'contact',
      contactId,
      status: 'active',
      taxId: '000 000 000 004',
    },
    lookup,
  )
  assert(created.ok && created.value.taxId === '000000000004', 'persist digits')

  const withoutTax = createCustomer(
    persistence,
    org,
    { type: 'contact', contactId, status: 'active' },
    lookup,
  )
  assert(withoutTax.ok && withoutTax.value.taxId === undefined, 'existing optional')

  const updated = updateCustomerForUser(
    persistence,
    persistence.users.getById(owner.id),
    withoutTax.value.id,
    {
      type: 'contact',
      contactId,
      status: 'active',
      taxId: '000000000007',
    },
    lookup,
  )
  assert(updated.ok && updated.value.taxId === '000000000007', 'update stores taxId')
  assert(
    persistence.customers.getById(withoutTax.value.id)?.taxId === '000000000007',
    'card source of truth',
  )
  const exported = exportExcelDatasetForUser(
    persistence,
    persistence.users.getById(owner.id),
    'customers',
  )
  assert(exported.ok, 'customer excel')
  const sheet = parseExcelWorkbook(exported.value.bytes)[0]
  assert(sheet?.headers.includes('ИИН/БИН'), 'excel tax header')
  assert(
    sheet?.rows.some((row) => row.includes('000000000007')),
    'excel tax value',
  )
  console.log('customer-tax-id.verify: ok')
}

runCustomerTaxIdChecks()
