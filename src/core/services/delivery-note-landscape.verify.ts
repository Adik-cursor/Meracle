import { createDeliveryNoteForUser, generateDeliveryNotePdfForUser } from './delivery-notes'
import { completeSeededSale, readPdfMeta, setupInvoiceOrg } from './delivery-documents.verify-support'

export async function runDeliveryNoteLandscapeChecks(): Promise<void> {
  const ctx = completeSeededSale(setupInvoiceOrg('org-dn-land', 'ТОО Landscape', '000000000003'))
  const created = createDeliveryNoteForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  if (!created.ok) {
    throw new Error('create')
  }
  const pdf = await generateDeliveryNotePdfForUser(ctx.persistence, ctx.owner, created.value.id)
  if (!pdf.ok) {
    throw new Error('pdf')
  }
  const meta = await readPdfMeta(pdf.value.bytes)
  if (Math.abs(meta.width - 841.89) > 0.2 || Math.abs(meta.height - 595.28) > 0.2) {
    throw new Error(`A4 landscape ${meta.width}x${meta.height}`)
  }
  if (meta.width < meta.height) {
    throw new Error('not portrait')
  }
  console.log(`delivery-note-landscape.verify: ok ${meta.width}x${meta.height}`)
}

void runDeliveryNoteLandscapeChecks()
