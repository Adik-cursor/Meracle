import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'
import {
  findOverlappingInvoiceText,
  INVOICE_PDF_CONTENT_WIDTH,
  INVOICE_PDF_KBE_LABEL,
  INVOICE_PDF_PAYMENT_RATIOS,
  renderSaleInvoicePdfWithLayout,
} from '../pdf/sale-invoice-pdf'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfPaymentTableChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-pay', 'ТОО БанкТаблица', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const doc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(doc.ok, 'document')
  const layout = await renderSaleInvoicePdfWithLayout(doc.value)
  const payment = layout.boxes.filter((box) => box.block === 'payment')
  const labels = payment.map((box) => box.text)
  assert(labels.includes('Бенефициар:'), 'beneficiary')
  assert(labels.includes('ИИК'), 'iik')
  assert(labels.includes(INVOICE_PDF_KBE_LABEL), 'kbe')
  assert(labels.includes('Банк бенефициара:'), 'bank')
  assert(labels.includes('БИК'), 'bik')
  assert(labels.includes('КНП'), 'knp')
  const overlap = findOverlappingInvoiceText(payment)
  assert(!overlap, overlap ? `payment overlap ${overlap[0].text} / ${overlap[1].text}` : 'clean')
  const yByText = new Map(payment.map((box) => [box.text, box.y]))
  assert((yByText.get('Бенефициар:') ?? 0) > (yByText.get('Банк бенефициара:') ?? 0), 'row order')
  const origin = (595.28 - INVOICE_PDF_CONTENT_WIDTH) / 2
  const beneficiary = payment.find((box) => box.text === 'Бенефициар:')
  const iik = payment.find((box) => box.text === 'ИИК')
  const kbe = payment.find((box) => box.text === INVOICE_PDF_KBE_LABEL)
  assert(beneficiary && iik && kbe, 'payment columns')
  assert(Math.abs(beneficiary.x - origin) < 8, 'table uses content origin')
  const leftShare = (iik.x - beneficiary.x) / INVOICE_PDF_CONTENT_WIDTH
  const midShare = (kbe.x - iik.x) / INVOICE_PDF_CONTENT_WIDTH
  assert(Math.abs(leftShare - INVOICE_PDF_PAYMENT_RATIOS.left) < 0.03, 'left column ~48%')
  assert(Math.abs(midShare - INVOICE_PDF_PAYMENT_RATIOS.mid) < 0.03, 'mid column ~34%')
  assert(INVOICE_PDF_PAYMENT_RATIOS.right >= 0.16, 'kbe/knp column usable')
  console.log('sale-invoice-pdf-payment-table.verify: ok')
}

void runSaleInvoicePdfPaymentTableChecks()
