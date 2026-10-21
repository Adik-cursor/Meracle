import type {
  Id,
  Sale,
  SupplyContract,
  SupplyContractProfile,
  SupplyContractScheduleRow,
  User,
} from '../types'
import { normalizeSupplyContractProfile } from '../types/supply-contract'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { isSalePayment } from '../types/payment'
import { newId, nowIso, optionalText } from './primitives'
import { getSaleForUser } from './sales'
import {
  getDueAmount,
  roundMoney,
  sumCompletedPayments,
} from '../../modules/sales/sale-payment'
import { DEFAULT_INVOICE_UNIT } from '../pdf/invoice-format'
import {
  nextDocumentNumber,
  requireSalesDocumentIssue,
  requireSalesDocumentRead,
  snapshotCustomer,
  snapshotOrganization,
} from './sales-documents'
import { getCustomerDisplayName } from '../../modules/crm/customers/customer-name'
import { userDisplayName } from '../../modules/crm/users/user-name'

export type SupplyContractScheduleWrite = {
  dueDate: string
  plannedAmount: number
}

export type SupplyContractWrite = {
  saleId: Id
  number?: string
  contractDate?: string
  advanceAmount?: number
  fxRate?: string
  fxRateDate?: string
  correctionCoefficient?: string
  paymentTermsNote?: string
  deliveryAddress?: string
  schedule?: SupplyContractScheduleWrite[]
}

export type SupplyContractSpecItem = {
  index: number
  name: string
  unit: string
  quantity: number
  price: number
  total: number
  gift: boolean
}

export type SupplyContractScheduleView = SupplyContractScheduleRow & {
  paidDate: string
  paidAmount: number | null
}

export type SupplyContractDocument = {
  contract: SupplyContract
  filename: string
  city: string
  sellerName: string
  sellerTaxLabel: string
  sellerTaxId: string
  sellerAddress: string
  sellerBankName: string
  sellerIban: string
  sellerBik: string
  sellerSignatory: string
  buyerName: string
  buyerTaxLabel: string
  buyerTaxId: string
  buyerAddress: string
  buyerBankName: string
  buyerIban: string
  buyerBik: string
  buyerSignatory: string
  currency: string
  total: number
  advanceAmount: number
  remainingAmount: number
  schedule: SupplyContractScheduleView[]
  items: SupplyContractSpecItem[]
  profile: SupplyContractProfile
}

function dayValue(value: string | undefined): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value?.trim() ?? '')
  return match?.[1] ?? ''
}

function extractCity(address: string): string {
  const cityMatch = /\bг\.?\s*([^,]+)/i.exec(address)
  if (cityMatch?.[1]) {
    return cityMatch[1].trim()
  }
  const parts = address.split(',').map((item) => item.trim()).filter(Boolean)
  if (parts.length >= 2 && !/^казахстан$/i.test(parts[1] ?? '')) {
    return parts[1] ?? ''
  }
  return parts[0] ?? ''
}

function ownerSignatory(persistence: Persistence, organizationId: Id, fallback: string): string {
  const owner = persistence.users
    .list(organizationId)
    .find((user) => user.role === 'owner' && user.status === 'active')
  if (owner) {
    return userDisplayName(owner)
  }
  return fallback
}

export function resolveSupplyContractProfile(
  persistence: Persistence,
  sale: Pick<Sale, 'id' | 'organizationId' | 'packageId'>,
): SupplyContractProfile {
  if (sale.packageId) {
    const pkg = persistence.implantPackages.getById(sale.packageId)
    if (pkg && pkg.organizationId === sale.organizationId) {
      return 'implants'
    }
  }
  let hasImplants = false
  let hasEquipment = false
  for (const item of persistence.saleItems.listBySaleId(sale.id)) {
    const product = persistence.products.getById(item.productId)
    if (!product || product.organizationId !== sale.organizationId) {
      continue
    }
    const category = product.categoryId
      ? persistence.productCategories.getById(product.categoryId)
      : undefined
    const profile = normalizeSupplyContractProfile(category?.supplyProfile)
    if (profile === 'implants') {
      hasImplants = true
    }
    if (profile === 'equipment') {
      hasEquipment = true
    }
  }
  if (hasImplants) {
    return 'implants'
  }
  if (hasEquipment) {
    return 'equipment'
  }
  return 'universal'
}

export function saleHasSupplyContractDebt(
  persistence: Persistence,
  saleId: Id,
  organizationId: Id,
): boolean {
  const sale = persistence.sales.getById(saleId)
  if (!sale || sale.organizationId !== organizationId) {
    return false
  }
  const paid = sumCompletedPayments(
    persistence.payments
      .list(organizationId)
      .filter((payment) => isSalePayment(payment) && payment.saleId === sale.id),
  )
  return getDueAmount(sale.total, paid) > 0
}

function normalizeSchedule(
  rows: SupplyContractScheduleWrite[] | undefined,
): ServiceResult<SupplyContractScheduleRow[]> {
  const schedule: SupplyContractScheduleRow[] = []
  for (const row of rows ?? []) {
    const dueDate = dayValue(row.dueDate)
    const plannedAmount = roundMoney(row.plannedAmount)
    if (!dueDate && plannedAmount <= 0) {
      continue
    }
    if (!dueDate || !Number.isFinite(plannedAmount) || plannedAmount <= 0) {
      return fail({ code: 'INVALID_INPUT' })
    }
    schedule.push({ dueDate, plannedAmount })
  }
  return ok(schedule)
}

export function listSupplyContractsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  saleId?: Id,
): ServiceResult<SupplyContract[]> {
  const actor = requireSalesDocumentRead(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  return ok(
    persistence.supplyContracts
      .list(actor.value.organizationId)
      .filter((item) => (saleId ? item.saleId === saleId : true))
      .filter((item) => item.status !== 'cancelled'),
  )
}

export function getSupplyContractForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  contractId: Id,
): ServiceResult<SupplyContract> {
  const actor = requireSalesDocumentRead(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  const contract = persistence.supplyContracts.getById(contractId)
  if (!contract || contract.organizationId !== actor.value.organizationId) {
    return fail({ code: 'SUPPLY_CONTRACT_NOT_FOUND' })
  }
  return ok(contract)
}

export function findActiveSupplyContractForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  saleId: Id,
): ServiceResult<SupplyContract | null> {
  const listed = listSupplyContractsForUser(persistence, currentUser, saleId)
  if (!listed.ok) {
    return listed
  }
  return ok(listed.value[0] ?? null)
}

export function createSupplyContractForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: SupplyContractWrite,
): ServiceResult<SupplyContract> {
  const actor = requireSalesDocumentIssue(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  const organizationId = actor.value.organizationId
  const saleResult = getSaleForUser(persistence, actor.value, draft.saleId)
  if (!saleResult.ok) {
    return saleResult
  }
  const sale = saleResult.value
  if (sale.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }
  const existing = persistence.supplyContracts
    .list(organizationId)
    .find((item) => item.saleId === sale.id && item.status !== 'cancelled')
  if (existing) {
    return ok(existing)
  }
  if (!saleHasSupplyContractDebt(persistence, sale.id, organizationId)) {
    return fail({ code: 'SUPPLY_CONTRACT_NOT_AVAILABLE' })
  }
  if (!sale.customerId) {
    return fail({ code: 'CUSTOMER_NAME_REQUIRED' })
  }
  const customer = persistence.customers.getById(sale.customerId)
  if (!customer || customer.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }
  const schedule = normalizeSchedule(draft.schedule)
  if (!schedule.ok) {
    return schedule
  }
  const paid = sumCompletedPayments(
    persistence.payments
      .list(organizationId)
      .filter((payment) => isSalePayment(payment) && payment.saleId === sale.id),
  )
  const advanceAmount = roundMoney(
    draft.advanceAmount == null ? paid : draft.advanceAmount,
  )
  if (!Number.isFinite(advanceAmount) || advanceAmount < 0) {
    return fail({ code: 'INVALID_INPUT' })
  }
  const remainingAmount = roundMoney(Math.max(0, sale.total - advanceAmount))
  const now = nowIso()
  const numbers = persistence.supplyContracts
    .list(organizationId)
    .map((item) => item.number)
  const number = optionalText(draft.number) || nextDocumentNumber(numbers)
  const contract: SupplyContract = {
    id: newId(),
    organizationId,
    saleId: sale.id,
    customerId: sale.customerId,
    number,
    contractDate: dayValue(draft.contractDate) || now.slice(0, 10),
    status: 'issued',
    createdBy: actor.value.id,
    currency: sale.currency,
    total: sale.total,
    advanceAmount,
    remainingAmount,
    fxRate: optionalText(draft.fxRate),
    fxRateDate: dayValue(draft.fxRateDate) || undefined,
    correctionCoefficient: optionalText(draft.correctionCoefficient),
    paymentTermsNote: optionalText(draft.paymentTermsNote),
    deliveryAddress: optionalText(draft.deliveryAddress) || customer.legalAddress?.trim() || '',
    schedule: schedule.value,
    profile: resolveSupplyContractProfile(persistence, sale),
    createdAt: now,
    updatedAt: now,
  }
  return ok(persistence.supplyContracts.create(contract))
}

export function buildSupplyContractDocumentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  contractId: Id,
): ServiceResult<SupplyContractDocument> {
  const loaded = getSupplyContractForUser(persistence, currentUser, contractId)
  if (!loaded.ok) {
    return loaded
  }
  const contract = loaded.value
  const sale = persistence.sales.getById(contract.saleId)
  if (!sale || sale.organizationId !== contract.organizationId) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }
  const seller = snapshotOrganization(persistence, contract.organizationId)
  const buyer = snapshotCustomer(persistence, contract.organizationId, contract.customerId)
  if (!buyer.ok) {
    return buyer
  }
  const org = persistence.organizations.getById(contract.organizationId)
  const customer = persistence.customers.getById(contract.customerId)
  const contacts = persistence.contacts.list(contract.organizationId)
  const buyerName = customer
    ? getCustomerDisplayName(customer, contacts, [])
    : buyer.value.name
  const buyerContact = customer?.contactId
    ? contacts.find((item) => item.id === customer.contactId)
    : undefined
  const payments = persistence.payments
    .list(contract.organizationId)
    .filter(
      (payment) =>
        isSalePayment(payment) &&
        payment.saleId === contract.saleId &&
        payment.status === 'completed',
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  const schedule = contract.schedule.map((row, index) => {
    const payment = payments[index]
    return {
      ...row,
      paidDate: payment ? payment.createdAt.slice(0, 10) : '',
      paidAmount: payment ? roundMoney(payment.amount) : null,
    }
  })
  const items = persistence.saleItems.listBySaleId(sale.id).map((item, index) => {
    const product = persistence.products.getById(item.productId)
    const total = Number.isFinite(item.total) ? item.total : 0
    return {
      index: index + 1,
      name: product?.name?.trim() || '—',
      unit: product?.unit?.trim() || DEFAULT_INVOICE_UNIT,
      quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
      price: Number.isFinite(item.unitPrice) ? item.unitPrice : 0,
      total,
      gift: total <= 0,
    }
  })
  const profile = contract.profile
    ? normalizeSupplyContractProfile(contract.profile)
    : resolveSupplyContractProfile(persistence, sale)
  return ok({
    contract: { ...contract, profile },
    filename: `Договор поставки №${contract.number} от ${contract.contractDate}.pdf`,
    city: extractCity(seller.address),
    sellerName: seller.name,
    sellerTaxLabel: seller.taxLabel,
    sellerTaxId: seller.taxId,
    sellerAddress: seller.address,
    sellerBankName: seller.bankName,
    sellerIban: seller.iban,
    sellerBik: seller.bik,
    sellerSignatory:
      org?.invoiceSignature?.trim() ||
      ownerSignatory(persistence, contract.organizationId, ''),
    buyerName,
    buyerTaxLabel: buyer.value.taxLabel,
    buyerTaxId: buyer.value.taxId,
    buyerAddress: buyer.value.address,
    buyerBankName: buyer.value.bankName,
    buyerIban: buyer.value.iban,
    buyerBik: buyer.value.bik,
    buyerSignatory: buyerContact
      ? `${buyerContact.firstName} ${buyerContact.lastName}`.trim()
      : buyerName,
    currency: contract.currency || sale.currency || 'KZT',
    total: contract.total,
    advanceAmount: contract.advanceAmount,
    remainingAmount: contract.remainingAmount,
    schedule,
    items,
    profile,
  })
}

export async function generateSupplyContractPdfForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  contractId: Id,
): Promise<ServiceResult<{ bytes: Uint8Array; filename: string; mimeType: 'application/pdf' }>> {
  const document = buildSupplyContractDocumentForUser(persistence, currentUser, contractId)
  if (!document.ok) {
    return document
  }
  try {
    const { renderSupplyContractPdfBytes } = await import('../pdf/supply-contract-pdf')
    const bytes = await renderSupplyContractPdfBytes(document.value)
    if (bytes.byteLength === 0 || bytes[0] !== 0x25 || bytes[1] !== 0x50) {
      throw new Error('SUPPLY_CONTRACT_PDF_INVALID')
    }
    return ok({
      bytes,
      filename: document.value.filename,
      mimeType: 'application/pdf' as const,
    })
  } catch {
    return fail({ code: 'SUPPLY_CONTRACT_PDF_FAILED' })
  }
}
