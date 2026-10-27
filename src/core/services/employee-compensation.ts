import type {
  EmployeeCompensation,
  EmployeePayout,
  EmployeePayoutKind,
  EmployeePeriodPayStatus,
  Expense,
  Id,
  User,
} from '../types'
import { isEmployeeCompensationPeriod } from '../types/employee-compensation'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { roundMoney } from '../../modules/sales/sale-payment'
import {
  canAccessUser,
  canManageEmployees,
  requireCurrentUser,
} from './access'
import { currentMotivationPeriodKey, getEmployeeMotivationForUser } from './employee-motivation'
import { createExpense, todayExpenseDateInput } from './expenses'
import { isModuleEnabledForUser } from './organization-modules'
import { newId, nowIso } from './primitives'
import { belongsToOrganization } from './catalog'

export type EmployeeCompensationHistoryItem = {
  id: Id
  kind: EmployeePayoutKind
  amount: number
  paidAt: string
  createdAt: string
}

export type EmployeeCompensationSnapshot = {
  employeeUserId: Id
  period: string
  plannedSalary: number
  plannedBonus: number
  salaryAmount: number
  bonusAmount: number
  accruedAmount: number
  paidAmount: number
  advanceAmount: number
  remainingAmount: number
  status: EmployeePeriodPayStatus
  compensationId?: Id
  expenseId?: Id
  currency: string
  history: EmployeeCompensationHistoryItem[]
}

function requirePayrollReader(
  persistence: Persistence,
  currentUser: User | null | undefined,
  employeeId: Id,
): ServiceResult<{ actor: User; employee: User }> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const employee = persistence.users.getById(employeeId)
  if (!employee || !belongsToOrganization(employee, actor.value.organizationId)) {
    return fail({ code: 'USER_NOT_FOUND' })
  }

  if (!canAccessUser(actor.value, employee)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return ok({ actor: actor.value, employee })
}

function requirePayrollWriter(
  persistence: Persistence,
  currentUser: User | null | undefined,
  employeeId: Id,
): ServiceResult<{ actor: User; employee: User }> {
  const access = requirePayrollReader(persistence, currentUser, employeeId)
  if (!access.ok) {
    return access
  }

  if (!canManageEmployees(access.value.actor)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return access
}

function requirePeriod(period: string | undefined): ServiceResult<string> {
  const value = (period ?? currentMotivationPeriodKey()).trim()
  if (!isEmployeeCompensationPeriod(value)) {
    return fail({ code: 'INVALID_INPUT' })
  }
  return ok(value)
}

function findOpenCompensation(
  persistence: Persistence,
  organizationId: Id,
  employeeUserId: Id,
  period: string,
): EmployeeCompensation | undefined {
  return persistence.employeeCompensations
    .list(organizationId)
    .find(
      (item) =>
        item.employeeUserId === employeeUserId &&
        item.period === period &&
        item.status === 'open',
    )
}

function payoutsFor(
  persistence: Persistence,
  organizationId: Id,
  compensationId: Id,
): EmployeePayout[] {
  return persistence.employeePayouts
    .list(organizationId)
    .filter((item) => item.compensationId === compensationId)
    .sort((left, right) => {
      const byDate = left.paidAt.localeCompare(right.paidAt)
      if (byDate !== 0) {
        return byDate
      }
      return left.createdAt.localeCompare(right.createdAt)
    })
}

function totals(payouts: EmployeePayout[]): { paid: number; advance: number } {
  let paid = 0
  let advance = 0
  for (const payout of payouts) {
    paid = roundMoney(paid + payout.amount)
    if (payout.kind === 'advance') {
      advance = roundMoney(advance + payout.amount)
    }
  }
  return { paid, advance }
}

function periodStatus(accrued: number, paid: number): EmployeePeriodPayStatus {
  if (accrued <= 0) {
    return 'none'
  }
  if (paid <= 0) {
    return 'accrued'
  }
  if (paid + 0.0001 >= accrued) {
    return 'paid'
  }
  return 'partial'
}

function snapshotFrom(
  persistence: Persistence,
  employee: User,
  period: string,
  plannedBonus: number,
): EmployeeCompensationSnapshot {
  const compensation = findOpenCompensation(
    persistence,
    employee.organizationId,
    employee.id,
    period,
  )
  const plannedSalary = roundMoney(employee.salaryAmount ?? 0)
  if (!compensation) {
    return {
      employeeUserId: employee.id,
      period,
      plannedSalary,
      plannedBonus: roundMoney(plannedBonus),
      salaryAmount: plannedSalary,
      bonusAmount: roundMoney(plannedBonus),
      accruedAmount: 0,
      paidAmount: 0,
      advanceAmount: 0,
      remainingAmount: 0,
      status: 'none',
      currency: 'KZT',
      history: [],
    }
  }

  const listed = payoutsFor(persistence, employee.organizationId, compensation.id)
  const { paid, advance } = totals(listed)
  const remaining = Math.max(0, roundMoney(compensation.accruedAmount - paid))
  return {
    employeeUserId: employee.id,
    period,
    plannedSalary,
    plannedBonus: roundMoney(plannedBonus),
    salaryAmount: compensation.salaryAmount,
    bonusAmount: compensation.bonusAmount,
    accruedAmount: compensation.accruedAmount,
    paidAmount: paid,
    advanceAmount: advance,
    remainingAmount: remaining,
    status: periodStatus(compensation.accruedAmount, paid),
    compensationId: compensation.id,
    expenseId: compensation.expenseId,
    currency: compensation.currency,
    history: listed.map((item) => ({
      id: item.id,
      kind: item.kind,
      amount: item.amount,
      paidAt: item.paidAt,
      createdAt: item.createdAt,
    })),
  }
}

function plannedBonusFor(
  persistence: Persistence,
  actor: User,
  employeeId: Id,
  period: string,
): number {
  if (!isModuleEnabledForUser(persistence, actor, 'plans')) {
    return 0
  }

  const motivation = getEmployeeMotivationForUser(persistence, actor, employeeId, period)
  if (!motivation.ok) {
    return 0
  }

  return roundMoney(motivation.value?.bonusAmount ?? 0)
}

export function getEmployeeCompensationForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  employeeId: Id,
  period?: string,
): ServiceResult<EmployeeCompensationSnapshot> {
  const access = requirePayrollReader(persistence, currentUser, employeeId)
  if (!access.ok) {
    return access
  }

  const resolved = requirePeriod(period)
  if (!resolved.ok) {
    return resolved
  }

  const bonus = plannedBonusFor(
    persistence,
    access.value.actor,
    employeeId,
    resolved.value,
  )
  return ok(snapshotFrom(persistence, access.value.employee, resolved.value, bonus))
}

export function listOrganizationCompensationForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  period?: string,
): ServiceResult<EmployeeCompensationSnapshot[]> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const resolved = requirePeriod(period)
  if (!resolved.ok) {
    return resolved
  }

  const rows: EmployeeCompensationSnapshot[] = []
  for (const employee of persistence.users.list(actor.value.organizationId)) {
    if (!canAccessUser(actor.value, employee)) {
      continue
    }
    const bonus = plannedBonusFor(persistence, actor.value, employee.id, resolved.value)
    rows.push(snapshotFrom(persistence, employee, resolved.value, bonus))
  }

  return ok(rows)
}

export function organizationPayrollRemainingForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  period?: string,
): number {
  const listed = listOrganizationCompensationForUser(persistence, currentUser, period)
  if (!listed.ok) {
    return 0
  }

  return roundMoney(listed.value.reduce((sum, row) => sum + row.remainingAmount, 0))
}

export function accrueEmployeeCompensationForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  employeeId: Id,
  period?: string,
): ServiceResult<EmployeeCompensationSnapshot> {
  const access = requirePayrollWriter(persistence, currentUser, employeeId)
  if (!access.ok) {
    return access
  }

  const resolved = requirePeriod(period)
  if (!resolved.ok) {
    return resolved
  }

  const existing = findOpenCompensation(
    persistence,
    access.value.actor.organizationId,
    employeeId,
    resolved.value,
  )
  if (existing) {
    return fail({ code: 'COMPENSATION_DUPLICATE_PERIOD' })
  }

  const bonus = plannedBonusFor(
    persistence,
    access.value.actor,
    employeeId,
    resolved.value,
  )
  const salaryAmount = roundMoney(access.value.employee.salaryAmount ?? 0)
  const bonusAmount = roundMoney(bonus)
  const accruedAmount = roundMoney(salaryAmount + bonusAmount)
  if (accruedAmount <= 0) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const now = nowIso()
  const compensationId = newId()
  const compensation: EmployeeCompensation = {
    id: compensationId,
    organizationId: access.value.actor.organizationId,
    employeeUserId: employeeId,
    period: resolved.value,
    salaryAmount,
    bonusAmount,
    accruedAmount,
    currency: 'KZT',
    status: 'open',
    createdBy: access.value.actor.id,
    createdAt: now,
    updatedAt: now,
  }

  // Accrual is a payroll liability. It becomes an expense only as money is paid.
  persistence.employeeCompensations.create(compensation)

  return getEmployeeCompensationForUser(
    persistence,
    currentUser,
    employeeId,
    resolved.value,
  )
}

function addPayout(
  persistence: Persistence,
  currentUser: User | null | undefined,
  employeeId: Id,
  kind: EmployeePayoutKind,
  amount: number,
  period?: string,
): ServiceResult<EmployeeCompensationSnapshot> {
  const access = requirePayrollWriter(persistence, currentUser, employeeId)
  if (!access.ok) {
    return access
  }

  const resolved = requirePeriod(period)
  if (!resolved.ok) {
    return resolved
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return fail({
      code: 'INVALID_QUANTITY',
      requestedQuantity: amount,
    })
  }

  const compensation = findOpenCompensation(
    persistence,
    access.value.actor.organizationId,
    employeeId,
    resolved.value,
  )
  if (!compensation) {
    return fail({ code: 'COMPENSATION_NOT_FOUND' })
  }

  const listed = payoutsFor(persistence, access.value.actor.organizationId, compensation.id)
  const { paid } = totals(listed)
  const remaining = Math.max(0, roundMoney(compensation.accruedAmount - paid))
  const requested = roundMoney(amount)
  if (requested > remaining + 0.0001) {
    return fail({
      code: 'PAYMENT_LIMIT_EXCEEDED',
      requestedQuantity: requested,
      availableQuantity: remaining,
    })
  }

  const now = nowIso()
  persistence.employeePayouts.create({
    id: newId(),
    organizationId: access.value.actor.organizationId,
    compensationId: compensation.id,
    employeeUserId: employeeId,
    kind,
    amount: requested,
    currency: compensation.currency,
    paidAt: todayExpenseDateInput(),
    createdBy: access.value.actor.id,
    createdAt: now,
    updatedAt: now,
  })

  syncCompensationPayoutExpenses(persistence, compensation)

  return getEmployeeCompensationForUser(
    persistence,
    currentUser,
    employeeId,
    resolved.value,
  )
}

/** Keep the expense ledger aligned with actual salary payouts, not accruals. */
export function syncCompensationPayoutExpenses(
  persistence: Persistence,
  compensation: EmployeeCompensation,
): void {
  const payouts = payoutsFor(
    persistence,
    compensation.organizationId,
    compensation.id,
  )
  const relatedExpenses = persistence.expenses
    .list(compensation.organizationId)
    .filter((expense) => expense.compensationId === compensation.id)
  const usedExpenseIds = new Set<Id>()
  const payoutExpenses: Expense[] = []
  const canRecordExpenses =
    relatedExpenses.length > 0 ||
    isModuleEnabledForUser(
      persistence,
      persistence.users.getById(compensation.createdBy),
      'expenses',
    )

  payouts.forEach((payout, index) => {
    let expense = payout.expenseId
      ? relatedExpenses.find((item) => item.id === payout.expenseId)
      : undefined

    // Older versions linked one full-accrual expense to the compensation.
    // Reuse it for the first real payout, then make a separate row per payout.
    if (!expense && index === 0 && !payouts.some((item) => item.expenseId)) {
      expense = compensation.expenseId
        ? relatedExpenses.find((item) => item.id === compensation.expenseId)
        : relatedExpenses[0]
    }

    if (!expense && canRecordExpenses) {
      const created = createExpense(
        persistence,
        compensation.organizationId,
        payout.createdBy,
        {
          category: 'salary',
          description: `Выплата зарплаты ${compensation.period}`,
          amount: payout.amount,
          date: payout.paidAt,
          employeeUserId: compensation.employeeUserId,
          compensationId: compensation.id,
        },
      )
      if (created.ok) {
        expense = created.value
      }
    } else if (expense) {
      expense =
        persistence.expenses.update(expense.id, {
          description: `Выплата зарплаты ${compensation.period}`,
          amount: payout.amount,
          date: payout.paidAt,
          employeeUserId: compensation.employeeUserId,
          compensationId: compensation.id,
          updatedAt: nowIso(),
        }) ?? expense
    }

    if (expense) {
      usedExpenseIds.add(expense.id)
      payoutExpenses.push(expense)
      if (payout.expenseId !== expense.id) {
        persistence.employeePayouts.update(payout.id, {
          expenseId: expense.id,
          updatedAt: nowIso(),
        })
      }
    }
  })

  for (const expense of relatedExpenses) {
    if (!usedExpenseIds.has(expense.id)) {
      persistence.expenses.delete(expense.id)
    }
  }

  const firstExpense = payoutExpenses[0]
  if (compensation.expenseId !== firstExpense?.id) {
    persistence.employeeCompensations.update(compensation.id, {
      expenseId: firstExpense?.id,
      updatedAt: nowIso(),
    })
  }
}

/** One-time/idempotent repair for full-salary expenses written by older versions. */
export function reconcileEmployeePayoutExpenses(persistence: Persistence): void {
  for (const compensation of persistence.employeeCompensations.listAll()) {
    syncCompensationPayoutExpenses(persistence, compensation)
  }
}

export function createEmployeeAdvanceForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  employeeId: Id,
  amount: number,
  period?: string,
): ServiceResult<EmployeeCompensationSnapshot> {
  return addPayout(persistence, currentUser, employeeId, 'advance', amount, period)
}

export function payEmployeeCompensationRemainingForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  employeeId: Id,
  period?: string,
): ServiceResult<EmployeeCompensationSnapshot> {
  const current = getEmployeeCompensationForUser(
    persistence,
    currentUser,
    employeeId,
    period,
  )
  if (!current.ok) {
    return current
  }

  return addPayout(
    persistence,
    currentUser,
    employeeId,
    'salary',
    current.value.remainingAmount,
    current.value.period,
  )
}

export function salaryExpenseTotalForPeriod(
  persistence: Persistence,
  organizationId: Id,
  period: string,
): number {
  const compensations = persistence.employeeCompensations
    .list(organizationId)
    .filter((item) => item.period === period && item.status === 'open')
  const ids = new Set(compensations.map((item) => item.id))
  return roundMoney(
    persistence.expenses
      .list(organizationId)
      .filter(
        (expense) =>
          expense.category === 'salary' &&
          expense.compensationId &&
          ids.has(expense.compensationId),
      )
      .reduce((sum, expense) => sum + expense.amount, 0),
  )
}
