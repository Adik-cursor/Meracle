import type { Id, SaleInvoice, SaleInvoiceStatus, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { newId, nowIso, optionalText } from './primitives'
import {
  hasEffectiveFinancialPermission,
  requireActorInOrganization,
} from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import { getSaleForUser } from './sales'
import { requireSalesDocumentIssue } from './sales-documents'
import { isSalePayment } from '../types/payment'
import { sumCompletedPayments } from '../../modules/sales/sale-payment'
import { getCustomerDisplayName } from '../../modules/crm/customers/customer-name'
import { customerTaxIdLabel } from './customers'
import { amountInWordsInvoiceRu } from '../utils/amount-in-words'
import { userDisplayName } from '../../modules/crm/users/user-name'
import {
  DEFAULT_INVOICE_UNIT,
  DEFAULT_SALE_INVOICE_WARNING,
  formatInvoiceDateLong,
  formatInvoicePartyLine,
  organizationTaxIdLabel,
  saleInvoicePdfFilename,
} from '../pdf/invoice-format'

export type SaleInvoiceWrite = {
  saleId: Id
  notes?: string
}

export type InvoiceParty = {
  name: string
  taxId?: string
  taxLabel?: string
  address?: string
}

export type InvoiceDocument = {
  invoice: SaleInvoice
  warning: string
  supplier: InvoiceParty & {
    bankName?: string
    iban?: string
    bik?: string
    kbe?: string
    knp?: string
    vatStatus?: string
    footer?: string
  }
  buyer: InvoiceParty
  supplierLine: string
  buyerLine: string
  contract?: string
  items: {
    index: number
    sku: string
    name: string
    quantity: number
    unit: string
    price: number
    total: number
  }[]
  vatLabel: string
  itemCount: number
  totalInWords: string
  performer: string
  formattedDate: string
  filename: string
  supplierTaxLabel: string
  stamp?: string
  signature?: string
}

function requireSalesActor(
  persistence: Persistence,
  currentUser: User | null | undefined,
) {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }
  return requireActorInOrganization(gated.value, gated.value.organizationId)
}

function nextInvoiceNumber(persistence: Persistence, organizationId: Id): string {
  let max = 0
  for (const invoice of persistence.saleInvoices.list(organizationId)) {
    const parsed = Number.parseInt(invoice.invoiceNumber.replace(/\D/g, ''), 10)
    if (Number.isFinite(parsed) && parsed > max) {
      max = parsed
    }
  }
  return String(max + 1)
}

function syncPaidStatus(
  persistence: Persistence,
  invoice: SaleInvoice,
): SaleInvoice {
  if (invoice.status === 'cancelled') {
    return invoice
  }
  const sale = persistence.sales.getById(invoice.saleId)
  if (!sale) {
    return invoice
  }
  const paid = sumCompletedPayments(
    persistence.payments
      .list(invoice.organizationId)
      .filter((payment) => isSalePayment(payment) && payment.saleId === sale.id),
  )
  const next: SaleInvoiceStatus =
    paid >= sale.total && sale.total > 0 ? 'paid' : invoice.status === 'paid' ? 'issued' : invoice.status
  if (next === invoice.status) {
    return invoice
  }
  return (
    persistence.saleInvoices.update(invoice.id, {
      status: next,
      updatedAt: nowIso(),
    }) ?? invoice
  )
}

export function createSaleInvoiceForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: SaleInvoiceWrite,
): ServiceResult<SaleInvoice> {
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
  if (!sale.customerId) {
    return fail({ code: 'CUSTOMER_NAME_REQUIRED' })
  }
  const customer = persistence.customers.getById(sale.customerId)
  if (!customer || customer.organizationId !== actor.value.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }
  if (!customer.taxId?.trim()) {
    return fail({ code: 'CUSTOMER_TAX_ID_REQUIRED' })
  }
  const existing = persistence.saleInvoices
    .list(actor.value.organizationId)
    .find((item) => item.saleId === sale.id && item.status !== 'cancelled')
  if (existing) {
    return ok(existing)
  }
  const now = nowIso()
  const invoice: SaleInvoice = {
    id: newId(),
    organizationId: actor.value.organizationId,
    saleId: sale.id,
    invoiceNumber: nextInvoiceNumber(persistence, actor.value.organizationId),
    invoiceDate: now.slice(0, 10),
    customerId: sale.customerId,
    status: 'issued',
    currency: sale.currency,
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    notes: optionalText(draft.notes),
    createdBy: actor.value.id,
    createdAt: now,
    updatedAt: now,
  }
  return ok(persistence.saleInvoices.create(invoice))
}

export function listSaleInvoicesForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  saleId?: Id,
): ServiceResult<SaleInvoice[]> {
  const actor = requireSalesActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  if (!hasEffectiveFinancialPermission(actor.value, 'sales.read')) {
    return fail({ code: 'FORBIDDEN' })
  }
  const invoices = persistence.saleInvoices
    .list(actor.value.organizationId)
    .filter((item) => (saleId ? item.saleId === saleId : true))
    .map((item) => syncPaidStatus(persistence, item))
  return ok(invoices)
}

export function getSaleInvoiceForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  invoiceId: Id,
): ServiceResult<SaleInvoice> {
  const actor = requireSalesActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  const invoice = persistence.saleInvoices.getById(invoiceId)
  if (!invoice || invoice.organizationId !== actor.value.organizationId) {
    return fail({ code: 'INVOICE_NOT_FOUND' })
  }
  return ok(syncPaidStatus(persistence, invoice))
}

export function cancelSaleInvoiceForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  invoiceId: Id,
): ServiceResult<SaleInvoice> {
  const actor = requireSalesActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  if (!hasEffectiveFinancialPermission(actor.value, 'financial_documents.manage')) {
    return fail({ code: 'FORBIDDEN' })
  }
  const invoice = persistence.saleInvoices.getById(invoiceId)
  if (!invoice || invoice.organizationId !== actor.value.organizationId) {
    return fail({ code: 'INVOICE_NOT_FOUND' })
  }
  const updated = persistence.saleInvoices.update(invoiceId, {
    status: 'cancelled',
    updatedAt: nowIso(),
  })
  if (!updated) {
    return fail({ code: 'INVOICE_NOT_FOUND' })
  }
  return ok(updated)
}

export function logSaleInvoicePdfDiagnostics(stage: string, error: unknown) {
  const thrown = error instanceof Error ? error : undefined
  const domain =
    error && typeof error === 'object' && 'code' in error
      ? (error as { code?: string; details?: string })
      : undefined
  console.error('[sale-invoice-pdf]', stage, {
    code: domain?.code ?? thrown?.name,
    message: thrown?.message ?? domain?.details ?? String(error),
    stack: thrown?.stack,
    error,
  })
}

function finiteAmount(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function supplierFromOrg(persistence: Persistence, organizationId: Id) {
  const org = persistence.organizations.getById(organizationId)
  return {
    name: org?.legalName?.trim() || org?.name || '',
    taxId: org?.taxId?.trim() || org?.bin?.trim(),
    address: org?.legalAddress?.trim(),
    bankName: org?.bankName?.trim(),
    iban: org?.iban?.trim(),
    bik: org?.bik?.trim(),
    kbe: org?.kbe?.trim() ?? '',
    knp: org?.knp?.trim() ?? '',
    vatStatus: org?.vatStatus,
    footer: org?.invoiceFooterNote?.trim(),
    stamp: org?.stamp?.trim(),
    signature: org?.invoiceSignature?.trim(),
    warning: org?.invoiceWarningNote?.trim() || DEFAULT_SALE_INVOICE_WARNING,
    taxLabel: organizationTaxIdLabel(org?.legalName),
  }
}

function buyerFromCustomer(
  persistence: Persistence,
  organizationId: Id,
  customerId: Id | undefined,
): ServiceResult<InvoiceParty> {
  if (!customerId) {
    return fail({ code: 'CUSTOMER_NAME_REQUIRED' })
  }
  const customer = persistence.customers.getById(customerId)
  if (!customer || customer.organizationId !== organizationId) {
    return fail({ code: 'CUSTOMER_NOT_FOUND' })
  }
  const contacts = persistence.contacts.list(organizationId)
  const name = getCustomerDisplayName(customer, contacts, [])
  if (!name.trim()) {
    return fail({ code: 'CUSTOMER_NAME_REQUIRED' })
  }
  const taxId = customer.taxId?.trim()
  if (!taxId) {
    return fail({ code: 'CUSTOMER_TAX_ID_REQUIRED' })
  }
  return ok({
    name,
    taxId,
    taxLabel: customerTaxIdLabel(customer.type),
    address: customer.legalAddress?.trim(),
  })
}

export function buildSaleInvoiceDocumentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  invoiceId: Id,
): ServiceResult<InvoiceDocument> {
  const loaded = getSaleInvoiceForUser(persistence, currentUser, invoiceId)
  if (!loaded.ok) {
    return loaded
  }
  const invoice = loaded.value
  const supplier = supplierFromOrg(persistence, invoice.organizationId)
  const missingPayment: string[] = []
  if (!supplier.bankName) {
    missingPayment.push('Банк')
  }
  if (!supplier.iban) {
    missingPayment.push('ИИК / IBAN')
  }
  if (!supplier.taxId) {
    missingPayment.push('БИН/ИИН')
  }
  if (missingPayment.length > 0) {
    return fail({
      code: 'ORGANIZATION_PAYMENT_DETAILS_REQUIRED',
      details: missingPayment.join(', '),
    })
  }
  const buyer = buyerFromCustomer(
    persistence,
    invoice.organizationId,
    invoice.customerId,
  )
  if (!buyer.ok) {
    return buyer
  }
  const sale = persistence.sales.getById(invoice.saleId)
  if (!sale || sale.organizationId !== invoice.organizationId) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }
  const items = persistence.saleItems.listBySaleId(sale.id).map((item, index) => {
    const product = persistence.products.getById(item.productId)
    return {
      index: index + 1,
      sku: product?.sku?.trim() ?? '',
      name: product?.name?.trim() || '—',
      quantity: finiteAmount(item.quantity),
      unit: product?.unit?.trim() || DEFAULT_INVOICE_UNIT,
      price: finiteAmount(item.unitPrice),
      total: finiteAmount(item.total),
    }
  })
  const performerUser = persistence.users.getById(invoice.createdBy)
  const pkg = sale.packageId
    ? persistence.implantPackages.getById(sale.packageId)
    : undefined
  const contract = pkg?.contractId
    ? persistence.packageContracts.getById(pkg.contractId)
    : undefined
  const formattedDate = formatInvoiceDateLong(invoice.invoiceDate)
  return ok({
    invoice,
    warning: supplier.warning,
    supplier,
    buyer: buyer.value,
    supplierLine: formatInvoicePartyLine({
      taxLabel: 'ИИН/БИН',
      taxId: supplier.taxId,
      name: supplier.name,
      address: supplier.address,
    }),
    buyerLine: formatInvoicePartyLine({
      taxLabel: buyer.value.taxLabel ?? 'ИИН/БИН',
      taxId: buyer.value.taxId,
      name: buyer.value.name,
      address: buyer.value.address,
    }),
    contract: contract
      ? `№ ${contract.contractNumber} от ${formatInvoiceDateLong(contract.contractDate)}`
      : 'Без договора',
    items,
    vatLabel: supplier.vatStatus === 'vat' ? 'НДС' : 'Без НДС',
    itemCount: items.length,
    totalInWords: amountInWordsInvoiceRu(finiteAmount(invoice.total), invoice.currency),
    performer: performerUser ? userDisplayName(performerUser) : '',
    formattedDate,
    filename: saleInvoicePdfFilename(invoice.invoiceNumber, invoice.invoiceDate),
    supplierTaxLabel: supplier.taxLabel,
    stamp: supplier.stamp,
    signature: supplier.signature,
  })
}

export async function generateSaleInvoicePdfForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  invoiceId: Id,
): Promise<ServiceResult<{ bytes: Uint8Array; filename: string; mimeType: 'application/pdf' }>> {
  const document = buildSaleInvoiceDocumentForUser(persistence, currentUser, invoiceId)
  if (!document.ok) {
    logSaleInvoicePdfDiagnostics('buildSaleInvoiceDocumentForUser', document.error)
    return document
  }
  try {
    const { renderSaleInvoicePdfBytes } = await import('../pdf/sale-invoice-pdf')
    const bytes = await renderSaleInvoicePdfBytes(document.value)
    if (bytes.byteLength === 0 || bytes[0] !== 0x25 || bytes[1] !== 0x50) {
      throw new Error('INVOICE_PDF_INVALID_BYTES')
    }
    return ok({
      bytes,
      filename: document.value.filename,
      mimeType: 'application/pdf' as const,
    })
  } catch (error) {
    logSaleInvoicePdfDiagnostics('generateSaleInvoicePdfForUser', error)
    return fail({ code: 'INVOICE_PDF_FAILED' })
  }
}

export function findActiveSaleInvoiceForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  saleId: Id,
): ServiceResult<SaleInvoice | null> {
  const listed = listSaleInvoicesForUser(persistence, currentUser, saleId)
  if (!listed.ok) {
    return listed
  }
  const active = listed.value.find((item) => item.status !== 'cancelled') ?? null
  return ok(active)
}
