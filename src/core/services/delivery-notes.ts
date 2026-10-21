import type { DeliveryNote, Id, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { newId, nowIso } from './primitives'
import { getSaleForUser } from './sales'
import { DEFAULT_INVOICE_UNIT, formatInvoiceDateFile, formatInvoiceDateLong } from '../pdf/invoice-format'
import {
  formatPartyRequisites,
  nextDocumentNumber,
  requireSalesDocumentIssue,
  requireSalesDocumentRead,
  snapshotCustomer,
  snapshotOrganization,
} from './sales-documents'

export type DeliveryNoteWrite = {
  saleId: Id
}

export type DeliveryNoteDocument = {
  note: DeliveryNote
  filename: string
  pageLabel: string
  shipperLine: string
  consigneeLine: string
  formattedDate: string
  totalInWords: string
  itemCountWords: string
}

export function findActiveDeliveryNoteForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  saleId: Id,
): ServiceResult<DeliveryNote | null> {
  const listed = listDeliveryNotesForUser(persistence, currentUser, saleId)
  if (!listed.ok) {
    return listed
  }
  return ok(listed.value[0] ?? null)
}

export function createDeliveryNoteForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: DeliveryNoteWrite,
): ServiceResult<DeliveryNote> {
  const actor = requireSalesDocumentIssue(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  const saleResult = getSaleForUser(persistence, actor.value, draft.saleId)
  if (!saleResult.ok) {
    return saleResult
  }
  const sale = saleResult.value
  if (sale.organizationId !== actor.value.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }
  if (sale.status !== 'completed') {
    return fail({ code: 'SALE_NOT_COMPLETED' })
  }
  if (!sale.customerId) {
    return fail({ code: 'CUSTOMER_NAME_REQUIRED' })
  }
  const existing = persistence.deliveryNotes
    .list(actor.value.organizationId)
    .find((item) => item.saleId === sale.id)
  if (existing) {
    return ok(existing)
  }
  const consignee = snapshotCustomer(
    persistence,
    actor.value.organizationId,
    sale.customerId,
  )
  if (!consignee.ok) {
    return consignee
  }
  const shipper = snapshotOrganization(persistence, actor.value.organizationId)
  const pkg = sale.packageId
    ? persistence.implantPackages.getById(sale.packageId)
    : undefined
  const contract = pkg?.contractId
    ? persistence.packageContracts.getById(pkg.contractId)
    : undefined
  const items = persistence.saleItems.listBySaleId(sale.id).map((item, index) => {
    const product = persistence.products.getById(item.productId)
    return {
      index: index + 1,
      name: product?.name?.trim() || '—',
      sku: product?.sku?.trim() || '',
      unit: product?.unit?.trim() || DEFAULT_INVOICE_UNIT,
      quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
      price: Number.isFinite(item.unitPrice) ? item.unitPrice : 0,
      total: Number.isFinite(item.total) ? item.total : 0,
      vatLabel: shipper.vatLabel,
    }
  })
  const now = nowIso()
  const performer = persistence.users.getById(actor.value.id)
  const note: DeliveryNote = {
    id: newId(),
    organizationId: actor.value.organizationId,
    saleId: sale.id,
    documentNumber: nextDocumentNumber(
      persistence.deliveryNotes.list(actor.value.organizationId).map((item) => item.documentNumber),
    ),
    documentDate: now.slice(0, 10),
    customerId: sale.customerId,
    currency: sale.currency,
    total: sale.total,
    contractLabel: contract
      ? `№ ${contract.contractNumber} от ${formatInvoiceDateLong(contract.contractDate)}`
      : 'Без договора',
    shipper,
    consignee: consignee.value,
    items,
    performerName: performer
      ? `${performer.firstName} ${performer.lastName}`.trim()
      : '',
    createdBy: actor.value.id,
    createdAt: now,
    updatedAt: now,
  }
  return ok(persistence.deliveryNotes.create(note))
}

export function listDeliveryNotesForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  saleId?: Id,
): ServiceResult<DeliveryNote[]> {
  const actor = requireSalesDocumentRead(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  return ok(
    persistence.deliveryNotes
      .list(actor.value.organizationId)
      .filter((item) => (saleId ? item.saleId === saleId : true)),
  )
}

export function getDeliveryNoteForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  noteId: Id,
): ServiceResult<DeliveryNote> {
  const actor = requireSalesDocumentRead(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  const note = persistence.deliveryNotes.getById(noteId)
  if (!note || note.organizationId !== actor.value.organizationId) {
    return fail({ code: 'DELIVERY_NOTE_NOT_FOUND' })
  }
  return ok(note)
}

export function buildDeliveryNoteDocumentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  noteId: Id,
): ServiceResult<DeliveryNoteDocument> {
  const loaded = getDeliveryNoteForUser(persistence, currentUser, noteId)
  if (!loaded.ok) {
    return loaded
  }
  const note = loaded.value
  return ok({
    note,
    filename: `Накладная на отпуск запасов №${note.documentNumber} от ${formatInvoiceDateFile(note.documentDate)}.pdf`,
    pageLabel: '1',
    shipperLine: formatPartyRequisites(note.shipper),
    consigneeLine: formatPartyRequisites(note.consignee),
    formattedDate: formatInvoiceDateFile(note.documentDate),
    totalInWords: '',
    itemCountWords: '',
  })
}

export async function generateDeliveryNotePdfForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  noteId: Id,
): Promise<ServiceResult<{ bytes: Uint8Array; filename: string; mimeType: 'application/pdf' }>> {
  const document = buildDeliveryNoteDocumentForUser(persistence, currentUser, noteId)
  if (!document.ok) {
    return document
  }
  try {
    const { renderDeliveryNotePdfBytes } = await import('../pdf/delivery-note-pdf')
    const { amountInWordsInvoiceRu, amountInWordsRu } = await import('../utils/amount-in-words')
    document.value.totalInWords = amountInWordsInvoiceRu(
      document.value.note.total,
      document.value.note.currency || 'KZT',
    )
    const qty = document.value.note.items.reduce((sum, item) => sum + item.quantity, 0)
    document.value.itemCountWords = amountInWordsRu(qty, '')
    const bytes = await renderDeliveryNotePdfBytes(document.value)
    if (bytes.byteLength === 0 || bytes[0] !== 0x25 || bytes[1] !== 0x50) {
      throw new Error('DELIVERY_NOTE_PDF_INVALID')
    }
    return ok({
      bytes,
      filename: document.value.filename,
      mimeType: 'application/pdf',
    })
  } catch {
    return fail({ code: 'DELIVERY_NOTE_PDF_FAILED' })
  }
}
