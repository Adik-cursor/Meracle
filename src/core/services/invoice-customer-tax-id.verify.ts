import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { createSaleInvoiceForUser } from './sales-invoices'
import { updateCustomer } from './customers'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runInvoiceCustomerTaxIdChecks(): void {
  const persistence = createInMemoryPersistence()
  const org = 'org-inv-tax'
  addOrg(persistence, org, 'DSK')
  persistence.organizations.update(org, {
    legalName: 'ТОО DSK',
    taxId: '000000000003',
    bankName: 'Bank',
    iban: 'KZ000',
    bik: 'BIK',
  })
  seedEnabledBusinessModules(persistence, org, 'seed', ['sales', 'warehouse', 'crm'])
  const owner = addUser(persistence, org, 'owner')
  const seeded = seedSale(persistence, org, owner)
  const sale = persistence.sales.getById(seeded.saleId)
  assert(sale?.customerId, 'customer on sale')
  const customer = persistence.customers.getById(sale.customerId)
  assert(customer, 'customer')
  persistence.customers.update(customer.id, { taxId: '', updatedAt: customer.updatedAt })

  const actor = persistence.users.getById(owner.id)
  const missing = createSaleInvoiceForUser(persistence, actor, { saleId: seeded.saleId })
  assert(
    !missing.ok && missing.error.code === 'CUSTOMER_TAX_ID_REQUIRED',
    'invoice reads customer taxId',
  )

  const restored = updateCustomer(
    persistence,
    org,
    customer.id,
    {
      type: 'contact',
      contactId: customer.contactId,
      status: 'active',
      taxId: '000000000004',
    },
    {
      getContact: (id) => persistence.contacts.getById(id),
      getCompany: () => undefined,
    },
  )
  assert(restored.ok, 'save taxId on customer')

  const created = createSaleInvoiceForUser(persistence, actor, { saleId: seeded.saleId })
  assert(created.ok, 'invoice after customer taxId')
  assert(created.value.customerId === customer.id, 'invoice customer from sale')
  console.log('invoice-customer-tax-id.verify: ok')
}

runInvoiceCustomerTaxIdChecks()
