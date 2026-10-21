import type {
  CareCharge,
  Child,
  Id,
  Locale,
  Payment,
  PaymentMethod,
  User,
} from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import {
  getDueAmount,
  roundMoney,
  sumCompletedPayments,
} from '../../modules/sales/sale-payment'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import { requireChildrenManager, requireChildrenReader } from './care-access'
import { childDisplayName, getChildForUser } from './children'
import { isPositiveAmount, newId, nowIso, optionalText } from './primitives'

export type CareChargeWrite = {
  childId: Id
  amount: number
  period: string
  description?: string
  dueDate?: string
  currency?: string
}

export type CareChargePaymentWrite = {
  childId: Id
  careChargeId: Id
  amount: number
  method?: PaymentMethod
  note?: string
}

export type CareChargeFinanceLine = {
  chargeId: Id
  period?: string
  description?: string
  status: CareCharge['status']
  charged: number
  paid: number
  due: number
  currency: string
}

export type CarePeriodFinance = {
  period: string
  charged: number
  paid: number
  due: number
}

export type ChildFinanceSnapshot = {
  charged: number
  paid: number
  due: number
  debt: number
  currency: string
  charges: CareCharge[]
  payments: Payment[]
  lines: CareChargeFinanceLine[]
  periods: CarePeriodFinance[]
}

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export function isCareChargePeriod(value: string): boolean {
  return PERIOD_PATTERN.test(value)
}

export function currentCareChargePeriod(at = new Date()): string {
  const year = at.getFullYear()
  const month = String(at.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function resolveCareChargePeriod(charge: Pick<CareCharge, 'period' | 'dueDate' | 'createdAt'>): string | undefined {
  const explicit = charge.period?.trim()
  if (explicit && isCareChargePeriod(explicit)) {
    return explicit
  }
  const dueDate = charge.dueDate?.trim()
  if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return dueDate.slice(0, 7)
  }
  if (charge.createdAt.length >= 7) {
    const fallback = charge.createdAt.slice(0, 7)
    return isCareChargePeriod(fallback) ? fallback : undefined
  }
  return undefined
}

export function formatCareChargePeriod(period: string, locale: Locale): string {
  if (!isCareChargePeriod(period)) {
    return period
  }
  const date = new Date(`${period}-01T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    return period
  }
  const formatted = date.toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
}

function requireActiveManager(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User> {
  const actor = requireChildrenManager(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  if (actor.value.status !== 'active') {
    return fail({ code: 'USER_INACTIVE' })
  }
  return actor
}

function requireCharge(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult<CareCharge> {
  const charge = persistence.careCharges.getById(id)
  if (!charge) {
    return fail({ code: 'CARE_CHARGE_NOT_FOUND' })
  }
  if (!belongsToOrganization(charge, organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }
  return ok(charge)
}

function completedPaymentsForCharge(
  persistence: Persistence,
  organizationId: Id,
  careChargeId: Id,
): Payment[] {
  return persistence.payments
    .listByCareChargeId(organizationId, careChargeId)
    .filter((payment) => payment.status === 'completed' && !payment.saleId && !payment.rentalBookingId)
}

function chargePaidAmount(
  persistence: Persistence,
  organizationId: Id,
  careChargeId: Id,
): number {
  return sumCompletedPayments(completedPaymentsForCharge(persistence, organizationId, careChargeId))
}

export function sumCompletedCarePaymentsForPeriod(
  persistence: Persistence,
  organizationId: Id,
  period: string,
): number {
  let total = 0
  for (const charge of persistence.careCharges.list(organizationId)) {
    if (charge.period !== period || charge.status === 'cancelled') {
      continue
    }
    total += chargePaidAmount(persistence, organizationId, charge.id)
  }
  return roundMoney(total)
}

function hasOpenChargeForPeriod(
  persistence: Persistence,
  organizationId: Id,
  childId: Id,
  period: string,
  excludeChargeId?: Id,
): boolean {
  return persistence.careCharges.list(organizationId).some(
    (charge) =>
      charge.childId === childId &&
      charge.status === 'open' &&
      charge.period === period &&
      charge.id !== excludeChargeId,
  )
}

function sortCharges(left: CareCharge, right: CareCharge): number {
  const leftPeriod = resolveCareChargePeriod(left) ?? ''
  const rightPeriod = resolveCareChargePeriod(right) ?? ''
  const byPeriod = rightPeriod.localeCompare(leftPeriod)
  if (byPeriod !== 0) {
    return byPeriod
  }
  return right.createdAt.localeCompare(left.createdAt)
}

export function createCareChargeForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: CareChargeWrite,
): ServiceResult<CareCharge> {
  const actor = requireActiveManager(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  const child = getChildForUser(persistence, actor.value, draft.childId)
  if (!child.ok) {
    return child
  }

  if (!child.value.parentCustomerId) {
    return fail({ code: 'CARE_PARENT_REQUIRED' })
  }

  const customer = persistence.customers.getById(child.value.parentCustomerId)
  if (!customer || !belongsToOrganization(customer, actor.value.organizationId)) {
    return fail({ code: 'CUSTOMER_NOT_FOUND' })
  }

  const amount = roundMoney(draft.amount)
  if (!isPositiveAmount(amount)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const period = draft.period.trim()
  if (!isCareChargePeriod(period)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (hasOpenChargeForPeriod(persistence, actor.value.organizationId, child.value.id, period)) {
    return fail({ code: 'CARE_CHARGE_DUPLICATE_PERIOD' })
  }

  const dueDate = draft.dueDate?.trim()
  if (dueDate && !isIsoDate(dueDate)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const currency = (draft.currency?.trim() || 'KZT').toUpperCase()
  const now = nowIso()
  return ok(
    persistence.careCharges.create({
      id: newId(),
      organizationId: actor.value.organizationId,
      customerId: customer.id,
      childId: child.value.id,
      amount,
      currency,
      period,
      description: optionalText(draft.description) ?? '',
      dueDate,
      status: 'open',
      createdBy: actor.value.id,
      createdAt: now,
      updatedAt: now,
    }),
  )
}

export function createCareChargePaymentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: CareChargePaymentWrite,
): ServiceResult<Payment> {
  const actor = requireActiveManager(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  const child = getChildForUser(persistence, actor.value, draft.childId)
  if (!child.ok) {
    return child
  }

  const charge = requireCharge(persistence, actor.value.organizationId, draft.careChargeId)
  if (!charge.ok) {
    return charge
  }

  if (charge.value.childId !== child.value.id) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (charge.value.status !== 'open') {
    return fail({ code: 'INVALID_INPUT' })
  }

  const amount = roundMoney(draft.amount)
  if (!isPositiveAmount(amount)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const method = draft.method ?? 'cash'
  if (method === 'invoice' || method === 'on_credit') {
    return fail({ code: 'INVALID_INPUT' })
  }

  const paidAmount = chargePaidAmount(
    persistence,
    actor.value.organizationId,
    charge.value.id,
  )
  const dueAmount = getDueAmount(charge.value.amount, paidAmount)
  if (amount > dueAmount) {
    return fail({ code: 'PAYMENT_LIMIT_EXCEEDED' })
  }

  const now = nowIso()
  const payment: Payment = {
    id: newId(),
    organizationId: actor.value.organizationId,
    careChargeId: charge.value.id,
    amount,
    currency: charge.value.currency,
    method,
    status: 'completed',
    createdAt: now,
    createdBy: actor.value.id,
    note: optionalText(draft.note),
  }

  return persistence.runInTransaction(() => ok(persistence.payments.create(payment)))
}

export function getChildFinanceForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  childId: Id,
): ServiceResult<ChildFinanceSnapshot> {
  const actor = requireChildrenReader(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  const child = getChildForUser(persistence, actor.value, childId)
  if (!child.ok) {
    return child
  }

  const charges = persistence.careCharges
    .list(actor.value.organizationId)
    .filter((charge) => charge.childId === child.value.id)
    .sort(sortCharges)

  const openCharges = charges.filter((charge) => charge.status === 'open')
  const payments = openCharges.flatMap((charge) =>
    completedPaymentsForCharge(persistence, actor.value.organizationId, charge.id),
  )
  const charged = roundMoney(openCharges.reduce((sum, charge) => sum + charge.amount, 0))
  const paid = sumCompletedPayments(payments)
  const due = getDueAmount(charged, paid)
  const currency = openCharges[0]?.currency ?? charges[0]?.currency ?? 'KZT'

  const lines: CareChargeFinanceLine[] = openCharges.map((charge) => {
    const linePaid = chargePaidAmount(persistence, actor.value.organizationId, charge.id)
    return {
      chargeId: charge.id,
      period: resolveCareChargePeriod(charge),
      description: charge.description || undefined,
      status: charge.status,
      charged: charge.amount,
      paid: linePaid,
      due: getDueAmount(charge.amount, linePaid),
      currency: charge.currency,
    }
  })

  const periodMap = new Map<string, CarePeriodFinance>()
  for (const line of lines) {
    if (!line.period) {
      continue
    }
    const existing = periodMap.get(line.period) ?? {
      period: line.period,
      charged: 0,
      paid: 0,
      due: 0,
    }
    existing.charged = roundMoney(existing.charged + line.charged)
    existing.paid = roundMoney(existing.paid + line.paid)
    existing.due = getDueAmount(existing.charged, existing.paid)
    periodMap.set(line.period, existing)
  }

  return ok({
    charged,
    paid,
    due,
    debt: due,
    currency,
    charges,
    payments: payments.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    lines,
    periods: [...periodMap.values()].sort((left, right) => right.period.localeCompare(left.period)),
  })
}

export function listOpenCareChargesForChild(
  snapshot: ChildFinanceSnapshot,
): Array<CareChargeFinanceLine> {
  return snapshot.lines.filter((line) => line.due > 0)
}

export function childHasParent(child: Pick<Child, 'parentCustomerId' | 'parentContactId'>): boolean {
  return Boolean(child.parentCustomerId || child.parentContactId)
}

export type CarePaymentStatus = 'paid' | 'partial' | 'unpaid'

export type KindergartenFinanceQuery = {
  period: string
  query?: string
  groupId?: string
  paymentStatus?: CarePaymentStatus | 'all'
}

export type KindergartenFinanceRow = {
  childId: Id
  childName: string
  groupId?: Id
  groupName?: string
  chargeId: Id
  period: string
  charged: number
  paid: number
  due: number
  currency: string
  paymentStatus: CarePaymentStatus
}

export type KindergartenFinanceView = {
  period: string
  charged: number
  paid: number
  due: number
  childrenWithCharge: number
  childrenWithDebt: number
  currency: string
  rows: KindergartenFinanceRow[]
}

export function carePaymentStatus(charged: number, paid: number, due: number): CarePaymentStatus {
  if (charged <= 0) {
    return 'unpaid'
  }
  if (due === 0) {
    return 'paid'
  }
  if (paid > 0 && due > 0) {
    return 'partial'
  }
  return 'unpaid'
}

export function shiftCareChargePeriod(period: string, deltaMonths: number): string {
  if (!isCareChargePeriod(period)) {
    return currentCareChargePeriod()
  }
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))
  const date = new Date(Date.UTC(year, month - 1 + deltaMonths, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function listKindergartenFinanceForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  query: KindergartenFinanceQuery,
): ServiceResult<KindergartenFinanceView> {
  const actor = requireChildrenReader(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  if (actor.value.status !== 'active') {
    return fail({ code: 'USER_INACTIVE' })
  }

  const period = query.period.trim()
  if (!isCareChargePeriod(period)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const organizationId = actor.value.organizationId
  const groups = new Map(
    persistence.careGroups.list(organizationId).map((group) => [group.id, group]),
  )
  const children = new Map(
    persistence.children.list(organizationId).map((child) => [child.id, child]),
  )

  const periodRows: KindergartenFinanceRow[] = persistence.careCharges
    .list(organizationId)
    .filter((charge) => charge.status === 'open' && charge.period === period)
    .map((charge) => {
      const child = children.get(charge.childId)
      const group = child?.groupId ? groups.get(child.groupId) : undefined
      const paid = chargePaidAmount(persistence, organizationId, charge.id)
      const due = getDueAmount(charge.amount, paid)
      return {
        childId: charge.childId,
        childName: child ? childDisplayName(child) : charge.childId,
        groupId: child?.groupId,
        groupName: group?.name,
        chargeId: charge.id,
        period,
        charged: charge.amount,
        paid,
        due,
        currency: charge.currency,
        paymentStatus: carePaymentStatus(charge.amount, paid, due),
      }
    })
    .sort((left, right) => left.childName.localeCompare(right.childName, 'ru'))

  const charged = roundMoney(periodRows.reduce((sum, row) => sum + row.charged, 0))
  const paid = roundMoney(periodRows.reduce((sum, row) => sum + row.paid, 0))
  const due = getDueAmount(charged, paid)
  const childIds = new Set(periodRows.map((row) => row.childId))
  const debtIds = new Set(periodRows.filter((row) => row.due > 0).map((row) => row.childId))

  const needle = query.query?.trim().toLowerCase()
  const status = query.paymentStatus && query.paymentStatus !== 'all' ? query.paymentStatus : undefined
  const rows = periodRows.filter((row) => {
    if (query.groupId && row.groupId !== query.groupId) {
      return false
    }
    if (status && row.paymentStatus !== status) {
      return false
    }
    if (needle && !row.childName.toLowerCase().includes(needle)) {
      return false
    }
    return true
  })

  return ok({
    period,
    charged,
    paid,
    due,
    childrenWithCharge: childIds.size,
    childrenWithDebt: debtIds.size,
    currency: periodRows[0]?.currency ?? 'KZT',
    rows,
  })
}
