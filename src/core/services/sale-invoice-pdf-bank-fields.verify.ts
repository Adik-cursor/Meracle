import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'
import { renderSaleInvoicePdfWithLayout } from '../pdf/sale-invoice-pdf'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfBankFieldsChecks(): Promise<void> {
  const empty = setupInvoiceOrg('org-pdf-bank-empty', 'ТОО ПустыеПоля', '000000000003')
  empty.persistence.organizations.update(empty.orgId, { kbe: '', knp: '' })
  const emptyInvoice = createSaleInvoiceForUser(empty.persistence, empty.owner, {
    saleId: empty.saleId,
  })
  assert(emptyInvoice.ok, 'empty invoice')
  const emptyDoc = buildSaleInvoiceDocumentForUser(
    empty.persistence,
    empty.owner,
    emptyInvoice.value.id,
  )
  assert(emptyDoc.ok, 'empty document')
  assert(!emptyDoc.value.supplier.kbe, 'kbe stays empty when organization.kbe missing')
  assert(!emptyDoc.value.supplier.knp, 'knp stays empty when organization.knp missing')
  const emptyLayout = await renderSaleInvoicePdfWithLayout(emptyDoc.value)
  const emptyPayment = emptyLayout.boxes
    .filter((box) => box.block === 'payment')
    .map((box) => box.text)
  assert(emptyPayment.includes('Кбе'), 'kbe label')
  assert(emptyPayment.includes('КНП'), 'knp label')
  assert(!emptyPayment.includes('19'), 'no hardcoded kbe')
  assert(!emptyPayment.includes('710'), 'no hardcoded knp')

  const filled = setupInvoiceOrg('org-pdf-bank-filled', 'ТОО ЗаполненныеПоля', '000000000003')
  filled.persistence.organizations.update(filled.orgId, { kbe: '19', knp: '710' })
  const filledInvoice = createSaleInvoiceForUser(filled.persistence, filled.owner, {
    saleId: filled.saleId,
  })
  assert(filledInvoice.ok, 'filled invoice')
  const filledDoc = buildSaleInvoiceDocumentForUser(
    filled.persistence,
    filled.owner,
    filledInvoice.value.id,
  )
  assert(filledDoc.ok, 'filled document')
  assert(filledDoc.value.supplier.kbe === '19', 'filled kbe from organization')
  assert(filledDoc.value.supplier.knp === '710', 'filled knp from organization')
  const filledLayout = await renderSaleInvoicePdfWithLayout(filledDoc.value)
  const filledPayment = filledLayout.boxes
    .filter((box) => box.block === 'payment')
    .map((box) => box.text)
  assert(filledPayment.includes('19'), 'kbe printed when set')
  assert(filledPayment.includes('710'), 'knp printed when set')
  console.log('sale-invoice-pdf-bank-fields.verify: ok')
}

void runSaleInvoicePdfBankFieldsChecks()
