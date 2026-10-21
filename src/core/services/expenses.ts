import type { Expense, ExpenseCategory, Id, User } from '../types'
import { isExpenseCategory } from '../types/expense'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { newId, nowIso, optionalText } from './primitives'
import {
  getAccessScope,
  hasEffectiveFinancialPermission,
  requireActorInOrganization,
} from './access'
import { requireModuleEnabledForUser } from './organization-modules'

export type ExpenseWrite = {
  category: ExpenseCategory
  description: string
  amount: number
  date: string
  comment?: string
  branchId?: Id
  employeeUserId?: Id
  compensationId?: Id
}

export function todayExpenseDateInput(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function requireExpensePermission(
  actor: User,
  permission: 'expenses.read' | 'expenses.create',
): ServiceResult<User> {
  if (!hasEffectiveFinancialPermission(actor, permission)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return ok(actor)
}

function expenseInScope(actor: User, expense: Expense): boolean {
  if (expense.organizationId !== actor.organizationId) {
    return false
  }

  const scope = getAccessScope(actor)

  if (scope === 'organization') {
    return true
  }

  if (scope === 'branch') {
    return Boolean(actor.branchId) && expense.branchId === actor.branchId
  }

  return expense.createdByUserId === actor.id
}

export function createExpense(
  persistence: Persistence,
  organizationId: Id,
  createdByUserId: Id,
  draft: ExpenseWrite,
): ServiceResult<Expense> {
  const description = draft.description.trim()
  const amount = draft.amount
  const date = draft.date.trim()

  if (!description || !date || !isExpenseCategory(draft.category)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return fail({
      code: 'INVALID_QUANTITY',
      requestedQuantity: amount,
    })
  }

  if (draft.branchId) {
    const branch = persistence.branches.getById(draft.branchId)
    if (!branch) {
      return fail({ code: 'BRANCH_NOT_FOUND' })
    }

    if (branch.organizationId !== organizationId) {
      return fail({ code: 'BRANCH_ORGANIZATION_MISMATCH' })
    }
  }

  const now = nowIso()
  const expense: Expense = {
    id: newId(),
    organizationId,
    branchId: optionalText(draft.branchId),
    category: draft.category,
    description,
    amount,
    date,
    comment: optionalText(draft.comment),
    createdByUserId,
    employeeUserId: optionalText(draft.employeeUserId),
    compensationId: optionalText(draft.compensationId),
    createdAt: now,
    updatedAt: now,
  }

  return ok(persistence.expenses.create(expense))
}

export function listExpensesForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<Expense[]> {
  const actor = requireModuleEnabledForUser(persistence, currentUser, 'expenses')
  if (!actor.ok) {
    return actor
  }

  const allowed = requireExpensePermission(actor.value, 'expenses.read')
  if (!allowed.ok) {
    return allowed
  }

  return ok(
    persistence.expenses
      .list(actor.value.organizationId)
      .filter((expense) => expenseInScope(actor.value, expense)),
  )
}

export function createExpenseForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: ExpenseWrite,
): ServiceResult<Expense> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'expenses')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const allowed = requireExpensePermission(actor.value, 'expenses.create')
  if (!allowed.ok) {
    return allowed
  }

  if (
    actor.value.role === 'branch_director' &&
    draft.branchId &&
    draft.branchId !== actor.value.branchId
  ) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return createExpense(persistence, actor.value.organizationId, actor.value.id, draft)
}
