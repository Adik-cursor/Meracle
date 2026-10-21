import type {
  EmployeeMotivationLine,
  EmployeeMotivationPeriod,
  Id,
  User,
} from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import {
  canAccessMotivationPlans,
  canAccessUser,
  canWriteMotivation,
  denyUnless,
  requireCurrentUser,
} from './access'
import { requireActiveCategoryInOrganization } from './product-categories'
import { getReturnedQuantity } from './sale-returns'
import { listSalesForUser } from './sales'
import { getUserForUser } from './users'
import { isModuleEnabledForOrganization, requireModuleEnabledForUser } from './organization-modules'
import { isPositiveAmount, newId, nowIso } from './primitives'
import {
  roundMoney,
  sumCompletedPayments,
} from '../../modules/sales/sale-payment'

export type MotivationLineWrite = {
  categoryId: Id
  planAmount: number
  bonusPercent: number
  reducedBonusCoefficient?: number
  fullBonusCompletionPercent?: number
  thresholdPercent?: number
}

export type MotivationLineView = {
  categoryId: Id
  categoryName: string
  planAmount: number
  bonusPercent: number
  reducedBonusCoefficient: number
  fullBonusCompletionPercent: number
  thresholdPercent: number
  effectiveBonusPercent: number
  actualAmount: number
  completionPercent: number
  closed: boolean
  bonusAmount: number
}

export type MotivationView = {
  userId: Id
  periodKey: string
  periodId: Id
  locked: boolean
  canWrite: boolean
  salaryAmount: number
  bonusAmount: number
  totalAmount: number
  lines: MotivationLineView[]
}

export type MotivationDashboardRow = {
  userId: Id
  closed: boolean
  bonusAmount: number
  lines: MotivationLineView[]
}

export function currentMotivationPeriodKey(now = nowIso()): string {
  return now.slice(0, 7)
}

export function isMotivationPeriodLocked(periodKey: string, now = nowIso()): boolean {
  return periodKey < currentMotivationPeriodKey(now)
}

function periodRange(periodKey: string): { from: string; to: string } {
  const [yearText, monthText] = periodKey.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!year || !month) {
    return { from: `${periodKey}-01T00:00:00.000Z`, to: `${periodKey}-31T23:59:59.999Z` }
  }

  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return { from: from.toISOString(), to: to.toISOString() }
}

function saleCashierId(persistence: Persistence, saleId: Id, organizationId: Id): Id | undefined {
  return persistence.payments
    .listBySaleId(organizationId, saleId)
    .find((payment) => payment.status === 'completed')?.createdBy
}

function paidRatio(persistence: Persistence, saleId: Id, organizationId: Id, total: number): number {
  if (total <= 0) {
    return 0
  }

  const paid = sumCompletedPayments(
    persistence.payments.listBySaleId(organizationId, saleId),
  )
  if (paid <= 0) {
    return 0
  }

  return Math.min(1, paid / total)
}

function actualByCategory(
  persistence: Persistence,
  actor: User,
  employeeId: Id,
  periodKey: string,
): Map<Id, number> {
  const range = periodRange(periodKey)
  const listed = listSalesForUser(persistence, actor)
  const totals = new Map<Id, number>()
  if (!listed.ok) {
    return totals
  }

  for (const sale of listed.value) {
    if (sale.status !== 'completed') {
      continue
    }

    if (sale.createdAt < range.from || sale.createdAt > range.to) {
      continue
    }

    if (saleCashierId(persistence, sale.id, sale.organizationId) !== employeeId) {
      continue
    }

    const ratio = paidRatio(persistence, sale.id, sale.organizationId, sale.total)
    if (ratio <= 0) {
      continue
    }

    for (const item of persistence.saleItems.listBySaleId(sale.id)) {
      const product = persistence.products.getById(item.productId)
      const categoryId = product?.categoryId
      if (!categoryId) {
        continue
      }

      const returned = getReturnedQuantity(
        persistence,
        sale.organizationId,
        item.id,
      )
      const remaining = Math.max(0, item.quantity - returned)
      const qtyRatio = item.quantity === 0 ? 0 : remaining / item.quantity
      const amount = roundMoney(item.total * qtyRatio * ratio)
      totals.set(categoryId, roundMoney((totals.get(categoryId) ?? 0) + amount))
    }
  }

  return totals
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function lineCoefficient(line: {
  reducedBonusCoefficient?: number
}): number {
  return finiteNumber(line.reducedBonusCoefficient) ? line.reducedBonusCoefficient : 0
}

function lineFullBonusFrom(line: {
  fullBonusCompletionPercent?: number
  thresholdPercent?: number
}): number {
  if (finiteNumber(line.fullBonusCompletionPercent)) {
    return line.fullBonusCompletionPercent
  }
  if (finiteNumber(line.thresholdPercent)) {
    return line.thresholdPercent
  }
  return 100
}

export function computeMotivationBonus(input: {
  planAmount: number
  actualAmount: number
  bonusPercent: number
  reducedBonusCoefficient: number
  fullBonusCompletionPercent: number
}): {
  completionPercent: number
  effectiveBonusPercent: number
  bonusAmount: number
  closed: boolean
} {
  const planAmount = finiteNumber(input.planAmount) ? input.planAmount : 0
  const actualAmount = finiteNumber(input.actualAmount) ? input.actualAmount : 0
  const bonusPercent = finiteNumber(input.bonusPercent) ? input.bonusPercent : 0
  const reducedBonusCoefficient = finiteNumber(input.reducedBonusCoefficient)
    ? input.reducedBonusCoefficient
    : 0
  const fullBonusCompletionPercent = finiteNumber(input.fullBonusCompletionPercent)
    ? input.fullBonusCompletionPercent
    : 100

  const completionPercent = planAmount > 0 ? (actualAmount / planAmount) * 100 : 0
  const closed = planAmount > 0 && completionPercent >= fullBonusCompletionPercent
  const effectiveBonusPercent = closed
    ? bonusPercent
    : bonusPercent * reducedBonusCoefficient

  return {
    completionPercent,
    effectiveBonusPercent,
    bonusAmount: roundMoney(actualAmount * (effectiveBonusPercent / 100)),
    closed,
  }
}

function toLineView(
  persistence: Persistence,
  line: EmployeeMotivationLine,
  actual: number,
): MotivationLineView {
  const category = persistence.productCategories.getById(line.categoryId)
  const reducedBonusCoefficient = lineCoefficient(line)
  const fullBonusCompletionPercent = lineFullBonusFrom(line)
  const computed = computeMotivationBonus({
    planAmount: line.planAmount,
    actualAmount: actual,
    bonusPercent: line.bonusPercent,
    reducedBonusCoefficient,
    fullBonusCompletionPercent,
  })

  return {
    categoryId: line.categoryId,
    categoryName: category?.name ?? line.categoryId,
    planAmount: line.planAmount,
    bonusPercent: line.bonusPercent,
    reducedBonusCoefficient,
    fullBonusCompletionPercent,
    thresholdPercent: fullBonusCompletionPercent,
    effectiveBonusPercent: computed.effectiveBonusPercent,
    actualAmount: actual,
    completionPercent: computed.completionPercent,
    closed: computed.closed,
    bonusAmount: computed.bonusAmount,
  }
}

function buildView(
  persistence: Persistence,
  actor: User,
  target: User,
  period: EmployeeMotivationPeriod,
): MotivationView {
  const actuals = actualByCategory(
    persistence,
    actor,
    target.id,
    period.periodKey,
  )
  const lines = persistence.employeeMotivationLines
    .list(period.organizationId)
    .filter((line) => line.periodId === period.id)
    .map((line) => toLineView(persistence, line, actuals.get(line.categoryId) ?? 0))
  const bonusAmount = roundMoney(
    lines.reduce((sum, line) => sum + line.bonusAmount, 0),
  )
  const salaryAmount = target.salaryAmount ?? 0

  return {
    userId: target.id,
    periodKey: period.periodKey,
    periodId: period.id,
    locked: isMotivationPeriodLocked(period.periodKey),
    canWrite: canWriteMotivation(actor) && !isMotivationPeriodLocked(period.periodKey),
    salaryAmount,
    bonusAmount,
    totalAmount: roundMoney(salaryAmount + bonusAmount),
    lines,
  }
}

function canReadMotivation(actor: User, target: User): boolean {
  if (!canAccessUser(actor, target)) {
    return false
  }

  if (actor.id === target.id) {
    return true
  }

  return canWriteMotivation(actor) || actor.role === 'accountant'
}

function requireReadableTarget(
  persistence: Persistence,
  currentUser: User | null | undefined,
  userId: Id,
): ServiceResult<{ actor: User; target: User }> {
  const target = getUserForUser(persistence, currentUser, userId)
  if (!target.ok) {
    return target
  }

  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const allowed = denyUnless(canReadMotivation(actor.value, target.value))
  if (!allowed.ok) {
    return allowed
  }

  return ok({ actor: actor.value, target: target.value })
}

function validateLines(
  persistence: Persistence,
  organizationId: Id,
  lines: MotivationLineWrite[],
): ServiceResult<MotivationLineWrite[]> {
  if (lines.length === 0) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const seen = new Set<Id>()
  const normalized: MotivationLineWrite[] = []

  for (const line of lines) {
    if (seen.has(line.categoryId)) {
      return fail({ code: 'INVALID_INPUT' })
    }

    seen.add(line.categoryId)
    const category = requireActiveCategoryInOrganization(
      persistence,
      organizationId,
      line.categoryId,
    )
    if (!category.ok) {
      return category
    }

    if (
      !isPositiveAmount(line.planAmount) ||
      !Number.isFinite(line.bonusPercent) ||
      line.bonusPercent < 0
    ) {
      return fail({ code: 'INVALID_INPUT' })
    }

    const fullBonusCompletionPercent =
      line.fullBonusCompletionPercent ?? line.thresholdPercent ?? 100
    const reducedBonusCoefficient = line.reducedBonusCoefficient ?? 0.7
    if (
      !Number.isFinite(fullBonusCompletionPercent) ||
      fullBonusCompletionPercent <= 0 ||
      fullBonusCompletionPercent > 100 ||
      !Number.isFinite(reducedBonusCoefficient) ||
      reducedBonusCoefficient < 0 ||
      reducedBonusCoefficient > 1
    ) {
      return fail({ code: 'INVALID_INPUT' })
    }

    normalized.push({
      categoryId: line.categoryId,
      planAmount: roundMoney(line.planAmount),
      bonusPercent: line.bonusPercent,
      reducedBonusCoefficient,
      fullBonusCompletionPercent,
      thresholdPercent: fullBonusCompletionPercent,
    })
  }

  return ok(normalized)
}

function replacePeriodLines(
  persistence: Persistence,
  organizationId: Id,
  periodId: Id,
  lines: MotivationLineWrite[],
): void {
  for (const existing of persistence.employeeMotivationLines.list(organizationId)) {
    if (existing.periodId === periodId) {
      persistence.employeeMotivationLines.delete(existing.id)
    }
  }

  const now = nowIso()
  for (const line of lines) {
    persistence.employeeMotivationLines.create({
      id: newId(),
      organizationId,
      periodId,
      categoryId: line.categoryId,
      planAmount: line.planAmount,
      bonusPercent: line.bonusPercent,
      reducedBonusCoefficient: line.reducedBonusCoefficient ?? 0.7,
      fullBonusCompletionPercent: line.fullBonusCompletionPercent ?? line.thresholdPercent ?? 100,
      thresholdPercent: line.fullBonusCompletionPercent ?? line.thresholdPercent ?? 100,
      createdAt: now,
      updatedAt: now,
    })
  }
}

export function saveEmployeeMotivationForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  userId: Id,
  periodKey: string,
  lines: MotivationLineWrite[],
): ServiceResult<MotivationView> {
  const moduleOn = requireModuleEnabledForUser(persistence, currentUser, 'plans')
  if (!moduleOn.ok) {
    return moduleOn
  }

  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const write = denyUnless(canWriteMotivation(actor.value))
  if (!write.ok) {
    return write
  }

  if (!/^\d{4}-\d{2}$/.test(periodKey) || isMotivationPeriodLocked(periodKey)) {
    return fail({ code: 'MOTIVATION_PERIOD_LOCKED' })
  }

  const target = getUserForUser(persistence, currentUser, userId)
  if (!target.ok) {
    return target
  }

  if (target.value.organizationId !== actor.value.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  const readable = denyUnless(canReadMotivation(actor.value, target.value))
  if (!readable.ok) {
    return readable
  }

  const normalized = validateLines(
    persistence,
    actor.value.organizationId,
    lines,
  )
  if (!normalized.ok) {
    return normalized
  }

  return persistence.runInTransaction(() => {
    const existing = persistence.employeeMotivationPeriods
      .list(actor.value.organizationId)
      .find(
        (period) =>
          period.userId === userId && period.periodKey === periodKey,
      )

    const now = nowIso()
    const period =
      existing ??
      persistence.employeeMotivationPeriods.create({
        id: newId(),
        organizationId: actor.value.organizationId,
        userId,
        periodKey,
        createdBy: actor.value.id,
        createdAt: now,
        updatedAt: now,
      })

    if (existing && isMotivationPeriodLocked(existing.periodKey)) {
      return fail({ code: 'MOTIVATION_PERIOD_LOCKED' })
    }

    persistence.employeeMotivationPeriods.update(period.id, { updatedAt: now })
    replacePeriodLines(
      persistence,
      actor.value.organizationId,
      period.id,
      normalized.value,
    )

    const saved = persistence.employeeMotivationPeriods.getById(period.id)
    if (!saved) {
      return fail({ code: 'MOTIVATION_NOT_FOUND' })
    }

    return ok(buildView(persistence, actor.value, target.value, saved))
  })
}

export function listEmployeeMotivationPeriodsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  userId: Id,
): ServiceResult<string[]> {
  const readable = requireReadableTarget(persistence, currentUser, userId)
  if (!readable.ok) {
    return readable
  }

  if (
    !isModuleEnabledForOrganization(
      persistence,
      readable.value.actor.organizationId,
      'plans',
    )
  ) {
    return ok([])
  }

  const keys = persistence.employeeMotivationPeriods
    .list(readable.value.actor.organizationId)
    .filter((period) => period.userId === userId)
    .map((period) => period.periodKey)
    .sort((left, right) => (left < right ? 1 : -1))

  const current = currentMotivationPeriodKey()
  if (!keys.includes(current)) {
    keys.unshift(current)
  }

  return ok(keys)
}

export function getEmployeeMotivationForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  userId: Id,
  periodKey = currentMotivationPeriodKey(),
): ServiceResult<MotivationView | null> {
  const readable = requireReadableTarget(persistence, currentUser, userId)
  if (!readable.ok) {
    return readable
  }

  if (
    !isModuleEnabledForOrganization(
      persistence,
      readable.value.actor.organizationId,
      'plans',
    )
  ) {
    return ok(null)
  }

  const period = persistence.employeeMotivationPeriods
    .list(readable.value.actor.organizationId)
    .find(
      (item) => item.userId === userId && item.periodKey === periodKey,
    )

  if (!period) {
    return ok(null)
  }

  return ok(
    buildView(
      persistence,
      readable.value.actor,
      readable.value.target,
      period,
    ),
  )
}

export function listMotivationDashboardForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  periodKey = currentMotivationPeriodKey(),
): ServiceResult<MotivationDashboardRow[]> {
  const moduleOn = requireModuleEnabledForUser(persistence, currentUser, 'plans')
  if (!moduleOn.ok) {
    return moduleOn
  }

  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const users = persistence.users
    .list(actor.value.organizationId)
    .filter((user) => canReadMotivation(actor.value, user))

  const rows: MotivationDashboardRow[] = []
  for (const user of users) {
    const view = getEmployeeMotivationForUser(
      persistence,
      actor.value,
      user.id,
      periodKey,
    )
    if (!view.ok || !view.value) {
      continue
    }

    rows.push({
      userId: user.id,
      closed: view.value.lines.every((line) => line.closed),
      bonusAmount: view.value.bonusAmount,
      lines: view.value.lines,
    })
  }

  return ok(rows)
}

export type CompanyMotivationEmployeeRow = {
  userId: Id
  planAmount: number
  actualAmount: number
  completionPercent: number
  bonusAmount: number
  hasPlan: boolean
}

export type CompanyMotivationPlansView = {
  periodKey: string
  canWrite: boolean
  companyPlan: number
  companyActual: number
  companyCompletion: number
  companyBonus: number
  employeesWithPlan: number
  periodKeys: string[]
  rows: CompanyMotivationEmployeeRow[]
}

export function listCompanyMotivationPlansForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  periodKey = currentMotivationPeriodKey(),
): ServiceResult<CompanyMotivationPlansView> {
  const moduleOn = requireModuleEnabledForUser(persistence, currentUser, 'plans')
  if (!moduleOn.ok) {
    return moduleOn
  }

  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const allowed = denyUnless(canAccessMotivationPlans(actor.value))
  if (!allowed.ok) {
    return allowed
  }

  const users = persistence.users
    .list(actor.value.organizationId)
    .filter((user) => canAccessUser(actor.value, user))

  const periodKeys = new Set<string>([periodKey, currentMotivationPeriodKey()])
  for (const period of persistence.employeeMotivationPeriods.list(
    actor.value.organizationId,
  )) {
    if (users.some((user) => user.id === period.userId)) {
      periodKeys.add(period.periodKey)
    }
  }

  const rows: CompanyMotivationEmployeeRow[] = []
  for (const user of users) {
    const view = getEmployeeMotivationForUser(
      persistence,
      actor.value,
      user.id,
      periodKey,
    )
    if (!view.ok) {
      return view
    }

    const lines = view.value?.lines ?? []
    const planAmount = roundMoney(
      lines.reduce((sum, line) => sum + line.planAmount, 0),
    )
    const actualAmount = roundMoney(
      lines.reduce((sum, line) => sum + line.actualAmount, 0),
    )
    const completionPercent = planAmount > 0 ? (actualAmount / planAmount) * 100 : 0

    rows.push({
      userId: user.id,
      planAmount,
      actualAmount,
      completionPercent,
      bonusAmount: view.value?.bonusAmount ?? 0,
      hasPlan: Boolean(view.value),
    })
  }

  const companyPlan = roundMoney(
    rows.reduce((sum, row) => sum + row.planAmount, 0),
  )
  const companyActual = roundMoney(
    rows.reduce((sum, row) => sum + row.actualAmount, 0),
  )

  return ok({
    periodKey,
    canWrite: canWriteMotivation(actor.value) && !isMotivationPeriodLocked(periodKey),
    companyPlan,
    companyActual,
    companyCompletion: companyPlan > 0 ? (companyActual / companyPlan) * 100 : 0,
    companyBonus: roundMoney(rows.reduce((sum, row) => sum + row.bonusAmount, 0)),
    employeesWithPlan: rows.filter((row) => row.hasPlan).length,
    periodKeys: [...periodKeys].sort(),
    rows,
  })
}
