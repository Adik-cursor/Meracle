import { createSaleForUser } from './sales'
import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
  generateSaleInvoicePdfForUser,
} from './sales-invoices'
import { INVOICE_PDF_KBE_LABEL, renderSaleInvoicePdfWithLayout } from '../pdf/sale-invoice-pdf'
import { formatInvoiceMoney } from '../pdf/invoice-format'
import {
  addManySaleItems,
  assert,
  isPdfBytes,
  readPdfMeta,
  setupInvoiceOrg,
} from './sale-invoice-pdf.verify-support'
import { newId, nowIso } from './primitives'
import { setStock } from './inventory'

export async function runSaleInvoicePdfEtalonChecks(): Promise<void> {
  const empty = setupInvoiceOrg('org-pdf-etalon-empty', 'Test Company', '000000000004')
  empty.persistence.organizations.update(empty.orgId, {
    legalName: 'Test Company',
    taxId: '000000000004',
    bankName: 'Test Bank',
    iban: 'KZ123',
    bik: 'TESTKZKA',
    kbe: '',
    knp: '',
  })
  const emptyInvoice = createSaleInvoiceForUser(empty.persistence, empty.owner, {
    saleId: empty.saleId,
  })
  assert(emptyInvoice.ok, 'test1 invoice')
  const emptyDoc = buildSaleInvoiceDocumentForUser(
    empty.persistence,
    empty.owner,
    emptyInvoice.value.id,
  )
  assert(emptyDoc.ok, 'test1 document')
  assert(emptyDoc.value.supplier.kbe === '', 'test1 kbe empty')
  assert(emptyDoc.value.supplier.knp === '', 'test1 knp empty')
  const emptyLayout = await renderSaleInvoicePdfWithLayout(emptyDoc.value)
  const emptyPay = emptyLayout.boxes.filter((box) => box.block === 'payment').map((box) => box.text)
  assert(emptyPay.includes(INVOICE_PDF_KBE_LABEL), 'test1 kbe label')
  assert(emptyPay.includes('КНП'), 'test1 knp label')
  assert(!emptyPay.includes('19'), 'test1 no default kbe')
  assert(!emptyPay.includes('710'), 'test1 no default knp')

  empty.persistence.organizations.update(empty.orgId, { kbe: '19', knp: '710' })
  const filledDoc = buildSaleInvoiceDocumentForUser(
    empty.persistence,
    empty.owner,
    emptyInvoice.value.id,
  )
  assert(filledDoc.ok, 'test2 document')
  assert(filledDoc.value.supplier.kbe === '19', 'test2 kbe')
  assert(filledDoc.value.supplier.knp === '710', 'test2 knp')
  const filledLayout = await renderSaleInvoicePdfWithLayout(filledDoc.value)
  const filledPay = filledLayout.boxes.filter((box) => box.block === 'payment').map((box) => box.text)
  assert(filledPay.includes('19') && filledPay.includes('710'), 'test2 printed codes')
  assert(filledDoc.value.invoice.invoiceNumber === emptyInvoice.value.invoiceNumber, 'test2 same invoice')

  empty.persistence.organizations.update(empty.orgId, {
    legalName: 'Updated Legal Name',
    iban: 'KZ999',
    kbe: '18',
  })
  const liveDoc = buildSaleInvoiceDocumentForUser(
    empty.persistence,
    empty.owner,
    emptyInvoice.value.id,
  )
  assert(liveDoc.ok, 'test3 document')
  assert(liveDoc.value.supplier.name === 'Updated Legal Name', 'test3 live legalName')
  assert(liveDoc.value.supplier.iban === 'KZ999', 'test3 live iban')
  assert(liveDoc.value.supplier.kbe === '18', 'test3 live kbe')

  const other = setupInvoiceOrg('org-pdf-etalon-buyer', 'ТОО Покупатель', '000000000003')
  const now = nowIso()
  const contactId = newId()
  other.persistence.contacts.create({
    id: contactId,
    organizationId: other.orgId,
    firstName: 'Новый',
    lastName: 'Клиент',
    email: null,
    phone: null,
    companyId: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const customerId = newId()
  other.persistence.customers.create({
    id: customerId,
    organizationId: other.orgId,
    type: 'contact',
    contactId,
    status: 'active',
    taxId: '000000000008',
    legalAddress: 'г. Актобе',
    createdAt: now,
    updatedAt: now,
  })
  setStock(other.persistence, other.orgId, other.warehouseId, other.productId, 20)
  const secondSale = createSaleForUser(other.persistence, other.owner, other.orgId, 'KZT', {
    warehouseId: other.warehouseId,
    discount: 0,
    customerId,
    items: [{ productId: other.productId, quantity: 2, unitPrice: 2100000, discount: 0 }],
  })
  assert(secondSale.ok, 'test4 sale')
  const secondInvoice = createSaleInvoiceForUser(other.persistence, other.owner, {
    saleId: secondSale.value.sale.id,
  })
  assert(secondInvoice.ok, 'test4 invoice')
  const buyerDoc = buildSaleInvoiceDocumentForUser(
    other.persistence,
    other.owner,
    secondInvoice.value.id,
  )
  assert(buyerDoc.ok, 'test4 document')
  assert(buyerDoc.value.buyer.taxId === '000000000008', 'test4 buyer tax')
  assert(buyerDoc.value.buyerLine.includes('000000000008'), 'test4 buyer line')
  assert(buyerDoc.value.supplier.taxId !== buyerDoc.value.buyer.taxId, 'test4 distinct tax')
  assert(formatInvoiceMoney(buyerDoc.value.items[0]?.price ?? 0) === '2 100 000,00', 'test4 money')

  const many = setupInvoiceOrg('org-pdf-etalon-many', 'ТОО Таблица', '000000000003')
  const sale = many.persistence.sales.getById(many.saleId)
  assert(sale?.customerId, 'customer')
  const multiSale = addManySaleItems(
    many.persistence,
    many.orgId,
    many.owner,
    many.warehouseId,
    sale.customerId,
    6,
  )
  const multiInvoice = createSaleInvoiceForUser(many.persistence, many.owner, {
    saleId: multiSale.id,
  })
  assert(multiInvoice.ok, 'test5 invoice')
  const multiDoc = buildSaleInvoiceDocumentForUser(
    many.persistence,
    many.owner,
    multiInvoice.value.id,
  )
  assert(multiDoc.ok && multiDoc.value.items.length === 6, 'test5 rows')
  const multiLayout = await renderSaleInvoicePdfWithLayout(multiDoc.value)
  const headers = multiLayout.boxes
    .filter((box) => box.block === 'products-header')
    .sort((a, b) => a.x - b.x)
    .map((box) => box.text)
  assert(
    headers.join('|') === '№|Артикул|Наименование|Кол-во|Ед.|Цена|Сумма',
    'test5 column order',
  )

  const pages = setupInvoiceOrg('org-pdf-etalon-pages', 'ТОО МногоСтраниц', '000000000003')
  const pageSale = pages.persistence.sales.getById(pages.saleId)
  assert(pageSale?.customerId, 'page customer')
  const large = addManySaleItems(
    pages.persistence,
    pages.orgId,
    pages.owner,
    pages.warehouseId,
    pageSale.customerId,
    40,
  )
  const largeInvoice = createSaleInvoiceForUser(pages.persistence, pages.owner, {
    saleId: large.id,
  })
  assert(largeInvoice.ok, 'test6 invoice')
  const largePdf = await generateSaleInvoicePdfForUser(
    pages.persistence,
    pages.owner,
    largeInvoice.value.id,
  )
  assert(largePdf.ok, 'test6 pdf')
  const largeMeta = await readPdfMeta(largePdf.value.bytes)
  assert(largeMeta.pageCount >= 2, 'test6 multipage')
  assert(Math.abs(largeMeta.width - 595.28) < 0.2, 'test6 A4')

  const open = setupInvoiceOrg('org-pdf-etalon-open', 'ТОО Открытие', '000000000003')
  const existing = createSaleInvoiceForUser(open.persistence, open.owner, { saleId: open.saleId })
  assert(existing.ok, 'test7 invoice')
  const number = existing.value.invoiceNumber
  const first = await generateSaleInvoicePdfForUser(
    open.persistence,
    open.owner,
    existing.value.id,
  )
  const second = await generateSaleInvoicePdfForUser(
    open.persistence,
    open.owner,
    existing.value.id,
  )
  assert(first.ok && second.ok && isPdfBytes(first.value.bytes), 'test7/8 pdf')
  assert(first.value.mimeType === 'application/pdf', 'test7 mime')
  assert(second.value.filename.includes(`№${number}`), 'test8 same number')
  assert(
    open.persistence.saleInvoices.list(open.orgId).filter((item) => item.saleId === open.saleId)
      .length === 1,
    'test7/8 no new invoice',
  )
  console.log('sale-invoice-pdf-etalon.verify: ok')
}

void runSaleInvoicePdfEtalonChecks()
