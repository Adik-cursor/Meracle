import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import {
  addOrg,
  addUser,
  seedSale,
} from './sales-invoice.verify'
import { createSaleInvoiceForUser } from './sales-invoices'
import { checkoutSaleForUser } from './checkout-sale'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runSalesInvoiceBeforePaymentChecks(): void {
  const persistence = createInMemoryPersistence()
  const org = 'org-dsk-before-pay'
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
  const actor = persistence.users.getById(owner.id)
  const invoice = createSaleInvoiceForUser(persistence, actor, { saleId: seeded.saleId })
  assert(invoice.ok, 'invoice before payment')
  const sale = persistence.sales.getById(seeded.saleId)
  assert(sale?.status === 'draft', 'sale stays draft')
  assert(persistence.payments.listBySaleId(org, seeded.saleId).length === 0, 'no payment created')
  const stock = persistence.inventory.getByWarehouseAndProduct(
    org,
    seeded.warehouseId,
    seeded.productId,
  )
  assert(stock?.quantity === seeded.stockBefore, 'warehouse unchanged')

  const paid = checkoutSaleForUser(persistence, actor, org, seeded.saleId, {
    amount: 100,
    method: 'cash',
  })
  assert(paid.ok, 'payment after invoice')
  const afterStock = persistence.inventory.getByWarehouseAndProduct(
    org,
    seeded.warehouseId,
    seeded.productId,
  )
  assert(afterStock?.quantity === seeded.stockBefore - 1, 'stock moves only on payment')
  const kept = persistence.saleInvoices.getById(invoice.value.id)
  assert(kept?.saleId === seeded.saleId, 'invoice remains after payment')
  console.log('sales-invoice-before-payment.verify: ok')
}

runSalesInvoiceBeforePaymentChecks()
