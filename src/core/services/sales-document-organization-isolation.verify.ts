import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'
import { addRoleUser } from './sales-debt.fixture'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import {
  createSaleInvoiceForUser,
  generateSaleInvoicePdfForUser,
  getSaleInvoiceForUser,
} from './sales-invoices'
import {
  createDeliveryNoteForUser,
  generateDeliveryNotePdfForUser,
  getDeliveryNoteForUser,
} from './delivery-notes'
import { assert } from './delivery-documents.verify-support'

export async function runSalesDocumentOrganizationIsolationChecks(): Promise<void> {
  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-doc-iso-a', 'Org A')
  addOrg(persistence, 'org-doc-iso-b', 'Org B')
  persistence.organizations.update('org-doc-iso-a', {
    legalName: 'ТОО A',
    taxId: '000000000003',
    bankName: 'Bank',
    iban: 'KZ1',
    bik: 'BIK1',
  })
  persistence.organizations.update('org-doc-iso-b', {
    legalName: 'ТОО B',
    taxId: '000000000005',
    bankName: 'Bank',
    iban: 'KZ2',
    bik: 'BIK2',
  })
  seedEnabledBusinessModules(persistence, 'org-doc-iso-a', 'seed', ['sales', 'warehouse', 'crm'])
  seedEnabledBusinessModules(persistence, 'org-doc-iso-b', 'seed', ['sales', 'warehouse', 'crm'])
  const ownerA = addUser(persistence, 'org-doc-iso-a', 'owner')
  const ownerB = addUser(persistence, 'org-doc-iso-b', 'owner')
  const saleA = seedSale(persistence, 'org-doc-iso-a', ownerA)
  const saleB = seedSale(persistence, 'org-doc-iso-b', ownerB)
  const actorA = persistence.users.getById(ownerA.id)
  const actorB = persistence.users.getById(ownerB.id)
  const employeeB = addRoleUser(persistence, 'org-doc-iso-b', 'sales_employee', saleB.warehouseId)

  const invoiceA = createSaleInvoiceForUser(persistence, actorA, { saleId: saleA.saleId })
  assert(invoiceA.ok, 'org A invoice')
  assert(invoiceA.value.organizationId === 'org-doc-iso-a', 'invoice org from actor')
  const stolenCreate = createSaleInvoiceForUser(persistence, actorB, { saleId: saleA.saleId })
  assert(!stolenCreate.ok, 'org B cannot create invoice for org A sale')
  const stolenEmployee = createSaleInvoiceForUser(persistence, employeeB, {
    saleId: saleA.saleId,
  })
  assert(!stolenEmployee.ok, 'org B employee cannot create invoice for org A sale')
  const stolenGet = getSaleInvoiceForUser(persistence, actorB, invoiceA.value.id)
  assert(!stolenGet.ok, 'org B cannot get org A invoice')
  const stolenPdf = await generateSaleInvoicePdfForUser(persistence, actorB, invoiceA.value.id)
  assert(!stolenPdf.ok, 'org B cannot download org A invoice')

  const completed = checkoutOnCreditForUser(persistence, actorA, 'org-doc-iso-a', saleA.saleId)
  assert(completed.ok, 'org A completed')
  const noteA = createDeliveryNoteForUser(persistence, actorA, { saleId: saleA.saleId })
  assert(noteA.ok, 'org A note')
  assert(noteA.value.organizationId === 'org-doc-iso-a', 'note org from actor')
  const stolenNote = createDeliveryNoteForUser(persistence, actorB, { saleId: saleA.saleId })
  assert(!stolenNote.ok, 'org B cannot create note for org A sale')
  const stolenNoteGet = getDeliveryNoteForUser(persistence, actorB, noteA.value.id)
  assert(!stolenNoteGet.ok, 'org B cannot get org A note')
  const stolenNotePdf = await generateDeliveryNotePdfForUser(persistence, actorB, noteA.value.id)
  assert(!stolenNotePdf.ok, 'org B cannot download org A note')

  const invoiceB = createSaleInvoiceForUser(persistence, actorB, { saleId: saleB.saleId })
  assert(invoiceB.ok && invoiceB.value.organizationId === 'org-doc-iso-b', 'org B invoice isolated')
  console.log('sales-document-organization-isolation.verify: ok')
}

void runSalesDocumentOrganizationIsolationChecks()
