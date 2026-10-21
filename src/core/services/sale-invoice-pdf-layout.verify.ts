import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'
import { DEFAULT_SALE_INVOICE_WARNING } from '../pdf/invoice-format'
import {
  INVOICE_PDF_CONTENT_WIDTH,
  INVOICE_PDF_GAP_AFTER_PAYMENT,
  renderSaleInvoicePdfWithLayout,
} from '../pdf/sale-invoice-pdf'
import { assert, readPdfMeta, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

function firstY(boxes: { block: string; y: number }[], block: string): number {
  const ys = boxes.filter((box) => box.block === block).map((box) => box.y)
  return ys.length > 0 ? Math.max(...ys) : 0
}

export async function runSaleInvoicePdfLayoutChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-layout', 'ТОО Meracle', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const doc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(doc.ok, 'document')
  assert(doc.value.warning.startsWith('Внимание!'), 'warning first')
  assert(doc.value.warning === DEFAULT_SALE_INVOICE_WARNING, 'configurable default warning')
  assert(doc.value.contract === 'Без договора', 'contract placeholder')
  assert(doc.value.formattedDate.includes(' г.'), 'long russian date')
  assert(doc.value.supplier.iban, 'payment order iban')
  assert(doc.value.supplier.bik, 'payment order bik')
  const layout = await renderSaleInvoicePdfWithLayout(doc.value)
  const meta = await readPdfMeta(layout.bytes)
  assert(Math.abs(meta.width - 595.28) < 0.2, 'A4 width')
  assert(Math.abs(meta.height - 841.89) < 0.2, 'A4 height')
  assert(!meta.landscape, 'portrait')
  const origin = (595.28 - INVOICE_PDF_CONTENT_WIDTH) / 2
  const warningBox = layout.boxes.find((box) => box.block === 'warning')
  const paymentTitle = layout.boxes.find((box) => box.block === 'payment-title')
  const labels = ['№', 'Артикул', 'Наименование', 'Кол-во', 'Ед.', 'Цена', 'Сумма']
  const headerOrder = layout.boxes
    .filter((box) => box.block === 'products-header')
    .sort((a, b) => a.x - b.x)
    .map((box) => box.text)
  assert(headerOrder.join('|') === labels.join('|'), 'product column order')
  assert(warningBox, 'warning box')
  assert(Math.abs((warningBox?.x ?? 0) - origin) < 2, 'warning uses content width origin')
  assert(Math.abs((paymentTitle?.x ?? 0) - origin) < 2, 'payment table same content origin')
  const nameHeader = layout.boxes.find((box) => box.text === 'Наименование')
  assert((nameHeader?.x ?? 0) > origin, 'product table inside content width')
  const y = {
    warning: firstY(layout.boxes, 'warning'),
    payment: firstY(layout.boxes, 'payment-title'),
    title: firstY(layout.boxes, 'title'),
    supplier: firstY(layout.boxes, 'supplier'),
    customer: firstY(layout.boxes, 'customer'),
    contract: firstY(layout.boxes, 'contract'),
    products: firstY(layout.boxes, 'products-header'),
    totals: firstY(layout.boxes, 'totals'),
    signature: firstY(layout.boxes, 'signature'),
  }
  assert(y.warning > y.payment, 'warning then payment')
  assert(y.payment > y.title, 'payment then title')
  assert(
    layout.paymentTableBottom - layout.titleBaseline === INVOICE_PDF_GAP_AFTER_PAYMENT,
    'cursorY gap after payment table',
  )
  assert(layout.paymentTableBottom - layout.titleBaseline >= 40, 'title not glued to payment table')
  assert(y.title - y.supplier >= 20, 'title has space before supplier')
  assert(y.title > y.supplier, 'title then supplier')
  assert(y.supplier > y.customer, 'supplier then customer')
  assert(y.customer > y.contract, 'customer then contract')
  assert(y.contract > y.products, 'contract then products')
  assert(y.products > y.totals, 'products then totals')
  assert(y.totals > y.signature, 'totals then signature')
  console.log('sale-invoice-pdf-layout.verify: ok')
}

void runSaleInvoicePdfLayoutChecks()
