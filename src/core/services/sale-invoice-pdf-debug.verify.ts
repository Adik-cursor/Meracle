import { createSaleInvoiceForUser, generateSaleInvoicePdfForUser } from './sales-invoices'
import { assert, isPdfBytes, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfDebugChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-debug', 'ТОО Диагностика', '000000000002')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const pdf = await generateSaleInvoicePdfForUser(
    ctx.persistence,
    ctx.owner,
    invoice.value.id,
  )
  if (!pdf.ok) {
    throw new Error(`generateSaleInvoicePdfForUser failed: ${pdf.error.code} ${pdf.error.details ?? ''}`)
  }
  assert(pdf.value.bytes.byteLength > 0, 'bytes.length > 0')
  assert(isPdfBytes(pdf.value.bytes), '%PDF-')

  ctx.persistence.organizations.update(ctx.orgId, { iban: '' })
  const blocked = await generateSaleInvoicePdfForUser(
    ctx.persistence,
    ctx.owner,
    invoice.value.id,
  )
  assert(!blocked.ok && blocked.error.code === 'ORGANIZATION_PAYMENT_DETAILS_REQUIRED', 'empty iban')
  assert(blocked.error.details?.includes('ИИК / IBAN'), 'iban listed')
  console.log('sale-invoice-pdf-debug.verify: ok')
}

void runSaleInvoicePdfDebugChecks()
