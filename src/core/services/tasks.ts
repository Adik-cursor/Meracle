import type { Id, Task, TaskPriority, TaskStatus, User } from '../types'
import { fail, ok, okVoid, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import {
  canAccessTask,
  denyUnless,
  requireActorInOrganization,
} from './access'
import { newId, nowIso, optionalText } from './primitives'
import { requireModuleEnabledForUser } from './organization-modules'

export const TASK_STATUSES: readonly TaskStatus[] = [
  'todo',
  'in_progress',
  'completed',
  'cancelled',
]

export const TASK_PRIORITIES: readonly TaskPriority[] = [
  'low',
  'medium',
  'high',
]

const ACTIVE_TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress']
const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = [
  'completed',
  'cancelled',
]

export type TaskWrite = {
  title: string
  description?: string
  status?: TaskStatus
  priority: TaskPriority
  assignedUserId?: Id
  dealId?: Id
  dueDate?: string
}

function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus)
}

function isTaskPriority(value: string): value is TaskPriority {
  return TASK_PRIORITIES.includes(value as TaskPriority)
}

function isTerminalStatus(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.includes(status)
}

function isActiveStatus(status: TaskStatus): boolean {
  return ACTIVE_TASK_STATUSES.includes(status)
}

function optionalId(value: Id | undefined): Id | undefined {
  return optionalText(value)
}

function requireTask(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult<Task> {
  const task = persistence.tasks.getById(id)

  if (!task) {
    return fail({ code: 'TASK_NOT_FOUND' })
  }

  if (!belongsToOrganization(task, organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(task)
}

function normalizeDueDate(value: string | undefined): ServiceResult<string | undefined> {
  const dueDate = optionalText(value)

  if (!dueDate) {
    return ok(undefined)
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
    Number.isNaN(Date.parse(`${dueDate}T00:00:00`))
  ) {
    return fail({ code: 'INVALID_INPUT' })
  }

  return ok(dueDate)
}

function validateAssignee(
  persistence: Persistence,
  organizationId: Id,
  assignedUserId: Id | undefined,
): ServiceResult {
  if (!assignedUserId) {
    return okVoid()
  }

  const user = persistence.users.getById(assignedUserId)
  if (!user) {
    return fail({ code: 'TASK_USER_NOT_FOUND' })
  }

  if (user.organizationId !== organizationId) {
    return fail({ code: 'TASK_USER_ORGANIZATION_MISMATCH' })
  }

  if (user.status !== 'active') {
    return fail({ code: 'TASK_USER_INACTIVE' })
  }

  return okVoid()
}

function validateDeal(
  persistence: Persistence,
  organizationId: Id,
  dealId: Id | undefined,
): ServiceResult {
  if (!dealId) {
    return okVoid()
  }

  const deal = persistence.deals.getById(dealId)
  if (!deal) {
    return fail({ code: 'TASK_DEAL_NOT_FOUND' })
  }

  if (deal.organizationId !== organizationId) {
    return fail({ code: 'TASK_DEAL_ORGANIZATION_MISMATCH' })
  }

  return okVoid()
}

function normalizeWrite(
  persistence: Persistence,
  organizationId: Id,
  draft: TaskWrite,
  fallbackStatus: TaskStatus,
): ServiceResult<
  Omit<TaskWrite, 'status' | 'assignedUserId' | 'dealId' | 'dueDate'> & {
    status: TaskStatus
    assignedUserId?: Id
    dealId?: Id
    dueDate?: string
  }
> {
  const title = draft.title.trim()
  if (!title) {
    return fail({ code: 'TASK_TITLE_REQUIRED' })
  }

  const status = draft.status ?? fallbackStatus
  if (!isTaskStatus(status) || !isTaskPriority(draft.priority)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const assignedUserId = optionalId(draft.assignedUserId)
  const dealId = optionalId(draft.dealId)
  const dueDate = normalizeDueDate(draft.dueDate)
  if (!dueDate.ok) {
    return dueDate
  }

  const assignee = validateAssignee(persistence, organizationId, assignedUserId)
  if (!assignee.ok) {
    return assignee
  }

  const deal = validateDeal(persistence, organizationId, dealId)
  if (!deal.ok) {
    return deal
  }

  return ok({
    title,
    description: optionalText(draft.description),
    status,
    priority: draft.priority,
    assignedUserId,
    dealId,
    dueDate: dueDate.value,
  })
}

export function createTask(
  persistence: Persistence,
  organizationId: Id,
  draft: TaskWrite,
): ServiceResult<Task> {
  const normalized = normalizeWrite(persistence, organizationId, draft, 'todo')
  if (!normalized.ok) {
    return normalized
  }

  const now = nowIso()
  const task: Task = {
    id: newId(),
    organizationId,
    ...normalized.value,
    createdAt: now,
    updatedAt: now,
  }

  return ok(persistence.tasks.create(task))
}

export function updateTask(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  draft: TaskWrite,
): ServiceResult<Task> {
  const existing = requireTask(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const normalized = normalizeWrite(
    persistence,
    organizationId,
    draft,
    existing.value.status,
  )
  if (!normalized.ok) {
    return normalized
  }

  const updated = persistence.tasks.update(id, {
    ...normalized.value,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'TASK_NOT_FOUND' })
  }

  return ok(updated)
}

export function setTaskStatus(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  status: TaskStatus,
): ServiceResult<Task> {
  const existing = requireTask(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  if (!isTaskStatus(status)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (isTerminalStatus(existing.value.status) && isActiveStatus(status)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const updated = persistence.tasks.update(id, {
    status,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'TASK_NOT_FOUND' })
  }

  return ok(updated)
}

export function deleteTask(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const existing = requireTask(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  if (!persistence.tasks.delete(id)) {
    return fail({ code: 'TASK_NOT_FOUND' })
  }

  return okVoid()
}

export function listTasksForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<Task[]> {
  const actor = requireModuleEnabledForUser(persistence, currentUser, 'crm')
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.tasks
      .list(actor.value.organizationId)
      .filter((task) => canAccessTask(persistence, actor.value, task)),
  )
}

export function getTaskForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
): ServiceResult<Task> {
  const actor = requireModuleEnabledForUser(persistence, currentUser, 'crm')
  if (!actor.ok) {
    return actor
  }

  const task = persistence.tasks.getById(id)
  if (!task) {
    return fail({ code: 'TASK_NOT_FOUND' })
  }

  const allowed = denyUnless(canAccessTask(persistence, actor.value, task))
  if (!allowed.ok) {
    return allowed
  }

  return ok(task)
}

export function createTaskForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: TaskWrite,
): ServiceResult<Task> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'crm')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const assigned = denyUnless(
    canAccessTask(persistence, actor.value, {
      organizationId,
      assignedUserId: draft.assignedUserId,
      dealId: draft.dealId,
    }),
  )
  if (!assigned.ok) {
    return assigned
  }

  return createTask(persistence, organizationId, draft)
}

export function updateTaskForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  draft: TaskWrite,
): ServiceResult<Task> {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = getTaskForUser(persistence, actor.value, id)
  if (!existing.ok) {
    return existing
  }

  const canWrite = denyUnless(
    canAccessTask(persistence, actor.value, {
      organizationId,
      assignedUserId: draft.assignedUserId,
      dealId: draft.dealId ?? existing.value.dealId,
    }),
  )
  if (!canWrite.ok) {
    return canWrite
  }

  return updateTask(persistence, organizationId, id, draft)
}

export function setTaskStatusForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  status: TaskStatus,
): ServiceResult<Task> {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = getTaskForUser(persistence, actor.value, id)
  if (!existing.ok) {
    return existing
  }

  return setTaskStatus(persistence, organizationId, existing.value.id, status)
}

export function deleteTaskForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = getTaskForUser(persistence, actor.value, id)
  if (!existing.ok) {
    return existing
  }

  return deleteTask(persistence, organizationId, existing.value.id)
}
