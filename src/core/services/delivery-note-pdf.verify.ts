import { createDeliveryNoteForUser, generateDeliveryNotePdfForUser } from './delivery-notes'
import { completeSeededSale, isPdfBytes, setupInvoiceOrg } from './delivery-documents.verify-support'

export async function runDeliveryNotePdfChecks(): Promise<void> {
  const ctx = completeSeededSale(setupInvoiceOrg('org-dn-pdf', 'ТОО PDF Накл', '000000000003'))
  const created = createDeliveryNoteForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  if (!created.ok) {
    throw new Error('create')
  }
  const pdf = await generateDeliveryNotePdfForUser(ctx.persistence, ctx.owner, created.value.id)
  if (!pdf.ok) {
    throw new Error(pdf.error.code)
  }
  if (!isPdfBytes(pdf.value.bytes)) {
    throw new Error('%PDF')
  }
  if (pdf.value.mimeType !== 'application/pdf') {
    throw new Error('mime')
  }
  console.log('delivery-note-pdf.verify: ok')
}

void runDeliveryNotePdfChecks()
