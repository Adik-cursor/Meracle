import type { Child, ChildStatus, Id, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import { newId, nowIso, optionalText } from './primitives'
import { requireChildrenManager, requireChildrenReader } from './care-access'
import {
  createPersonCustomerInOrganization,
  findCustomerByContactPhone,
} from './contacts'
import { migrateChildStatus } from '../repositories/migrate-children-records'

export type ChildWrite = {
  firstName: string
  lastName: string
  birthDate: string
  groupId?: Id
  status: ChildStatus | 'active' | 'inactive'
  parentContactId?: Id
  parentCustomerId?: Id
  parentFullName?: string
  parentPhone?: string
  notes?: string
}

export type ChildListQuery = {
  query?: string
  groupId?: Id
  status?: ChildStatus
}

export function childOccupiesPlace(child: Pick<Child, 'status'>): boolean {
  return child.status === 'attending' || child.status === 'temporarily_absent'
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
}

function requireChild(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult<Child> {
  const child = persistence.children.getById(id)
  if (!child) {
    return fail({ code: 'CHILD_NOT_FOUND' })
  }
  if (!belongsToOrganization(child, organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }
  return ok(child)
}

function occupyingCount(
  persistence: Persistence,
  organizationId: Id,
  groupId: Id,
  excludeChildId?: Id,
): number {
  return persistence.children
    .list(organizationId)
    .filter(
      (child) =>
        child.groupId === groupId &&
        childOccupiesPlace(child) &&
        child.id !== excludeChildId,
    ).length
}

function assertGroupCapacity(
  persistence: Persistence,
  organizationId: Id,
  draft: ChildWrite,
  excludeChildId?: Id,
): ServiceResult {
  const groupId = draft.groupId?.trim()
  if (!groupId || !childOccupiesPlace({ status: migrateChildStatus(draft.status) })) {
    return ok(undefined)
  }

  const group = persistence.careGroups.getById(groupId)
  if (!group || group.organizationId !== organizationId) {
    return fail({ code: 'CARE_GROUP_NOT_FOUND' })
  }

  if (occupyingCount(persistence, organizationId, groupId, excludeChildId) >= group.capacity) {
    return fail({ code: 'CARE_GROUP_FULL' })
  }

  return ok(undefined)
}

function resolveParent(
  persistence: Persistence,
  organizationId: Id,
  draft: ChildWrite,
): ServiceResult<{ parentContactId?: Id; parentCustomerId?: Id }> {
  const parentFullName = draft.parentFullName?.trim()
  const parentPhone = draft.parentPhone?.trim()
  if (parentFullName || parentPhone) {
    if (!parentFullName || !parentPhone) {
      return fail({ code: 'INVALID_INPUT' })
    }
    const created = createPersonCustomerInOrganization(persistence, organizationId, {
      fullName: parentFullName,
      phone: parentPhone,
    })
    if (!created.ok) {
      return created
    }
    return ok({
      parentContactId: created.value.contact.id,
      parentCustomerId: created.value.customer.id,
    })
  }

  if (draft.parentCustomerId) {
    const customer = persistence.customers.getById(draft.parentCustomerId)
    if (!customer || !belongsToOrganization(customer, organizationId)) {
      return fail({ code: 'CUSTOMER_NOT_FOUND' })
    }
    const contactId = customer.contactId ?? draft.parentContactId
    if (contactId) {
      const contact = persistence.contacts.getById(contactId)
      if (!contact || !belongsToOrganization(contact, organizationId)) {
        return fail({ code: 'CUSTOMER_INVALID' })
      }
    }
    return ok({
      parentCustomerId: customer.id,
      parentContactId: contactId,
    })
  }

  if (draft.parentContactId) {
    const contact = persistence.contacts.getById(draft.parentContactId)
    if (!contact || !belongsToOrganization(contact, organizationId)) {
      return fail({ code: 'CUSTOMER_INVALID' })
    }
    const existing = contact.phone
      ? findCustomerByContactPhone(persistence, organizationId, contact.phone)
      : undefined
    if (existing) {
      return ok({
        parentContactId: existing.contact.id,
        parentCustomerId: existing.customer.id,
      })
    }
    const created = createPersonCustomerInOrganization(persistence, organizationId, {
      fullName: `${contact.firstName} ${contact.lastName}`.trim(),
      phone: contact.phone ?? '',
    })
    if (!created.ok) {
      return ok({ parentContactId: contact.id })
    }
    return ok({
      parentContactId: created.value.contact.id,
      parentCustomerId: created.value.customer.id,
    })
  }

  return ok({})
}

function validateGroup(
  persistence: Persistence,
  organizationId: Id,
  groupId: Id | undefined,
): ServiceResult {
  if (!groupId) {
    return ok(undefined)
  }
  const group = persistence.careGroups.getById(groupId)
  if (!group || group.organizationId !== organizationId) {
    return fail({ code: 'CARE_GROUP_NOT_FOUND' })
  }
  return ok(undefined)
}

function normalizeWrite(
  persistence: Persistence,
  organizationId: Id,
  draft: ChildWrite,
  excludeChildId?: Id,
): ServiceResult<ChildWrite> {
  const firstName = draft.firstName.trim()
  const lastName = draft.lastName.trim()
  const birthDate = draft.birthDate.trim()
  if (!firstName || !lastName || !isIsoDate(birthDate)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const status = migrateChildStatus(draft.status)
  const groupId = draft.groupId?.trim() || undefined
  const group = validateGroup(persistence, organizationId, groupId)
  if (!group.ok) {
    return group
  }

  const parent = resolveParent(persistence, organizationId, draft)
  if (!parent.ok) {
    return parent
  }

  const normalized: ChildWrite = {
    firstName,
    lastName,
    birthDate,
    groupId,
    status,
    parentContactId: parent.value.parentContactId,
    parentCustomerId: parent.value.parentCustomerId,
    notes: optionalText(draft.notes),
  }

  const capacity = assertGroupCapacity(persistence, organizationId, normalized, excludeChildId)
  if (!capacity.ok) {
    return capacity
  }

  return ok(normalized)
}

export function listChildrenForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<Child[]> {
  const actor = requireChildrenReader(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.children
      .list(actor.value.organizationId)
      .sort((left, right) =>
        `${left.lastName} ${left.firstName}`.localeCompare(
          `${right.lastName} ${right.firstName}`,
          'ru',
        ),
      ),
  )
}

export function listChildrenForGroupForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  groupId: Id,
): ServiceResult<Child[]> {
  const actor = requireChildrenReader(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  const group = persistence.careGroups.getById(groupId)
  if (!group || !belongsToOrganization(group, actor.value.organizationId)) {
    return fail({ code: 'CARE_GROUP_NOT_FOUND' })
  }

  return ok(
    persistence.children
      .list(actor.value.organizationId)
      .filter((child) => child.groupId === group.id)
      .sort((left, right) =>
        `${left.lastName} ${left.firstName}`.localeCompare(
          `${right.lastName} ${right.firstName}`,
          'ru',
        ),
      ),
  )
}

export function searchChildrenForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  query: ChildListQuery = {},
): ServiceResult<Child[]> {
  const listed = listChildrenForUser(persistence, currentUser)
  if (!listed.ok) {
    return listed
  }

  const needle = query.query?.trim().toLowerCase()
  return ok(
    listed.value.filter((child) => {
      if (query.groupId && child.groupId !== query.groupId) {
        return false
      }
      if (query.status && child.status !== query.status) {
        return false
      }
      if (!needle) {
        return true
      }
      const parent = child.parentContactId
        ? persistence.contacts.getById(child.parentContactId)
        : undefined
      const haystack =
        `${child.firstName} ${child.lastName} ${parent?.firstName ?? ''} ${parent?.lastName ?? ''} ${parent?.phone ?? ''}`.toLowerCase()
      return haystack.includes(needle)
    }),
  )
}

export function getChildForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
): ServiceResult<Child> {
  const actor = requireChildrenReader(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  return requireChild(persistence, actor.value.organizationId, id)
}

export function createChildForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: ChildWrite,
): ServiceResult<Child> {
  const actor = requireChildrenManager(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  const normalized = normalizeWrite(persistence, actor.value.organizationId, draft)
  if (!normalized.ok) {
    return normalized
  }

  const now = nowIso()
  return ok(
    persistence.children.create({
      id: newId(),
      organizationId: actor.value.organizationId,
      firstName: normalized.value.firstName,
      lastName: normalized.value.lastName,
      birthDate: normalized.value.birthDate,
      groupId: normalized.value.groupId,
      status: migrateChildStatus(normalized.value.status),
      parentContactId: normalized.value.parentContactId,
      parentCustomerId: normalized.value.parentCustomerId,
      notes: normalized.value.notes,
      createdAt: now,
      updatedAt: now,
    }),
  )
}

export function updateChildForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
  draft: ChildWrite,
): ServiceResult<Child> {
  const actor = requireChildrenManager(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  const existing = requireChild(persistence, actor.value.organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const normalized = normalizeWrite(persistence, actor.value.organizationId, draft, id)
  if (!normalized.ok) {
    return normalized
  }

  const updated = persistence.children.update(id, {
    firstName: normalized.value.firstName,
    lastName: normalized.value.lastName,
    birthDate: normalized.value.birthDate,
    groupId: normalized.value.groupId,
    status: migrateChildStatus(normalized.value.status),
    parentContactId: normalized.value.parentContactId,
    parentCustomerId: normalized.value.parentCustomerId,
    notes: normalized.value.notes,
    updatedAt: nowIso(),
  })
  if (!updated) {
    return fail({ code: 'CHILD_NOT_FOUND' })
  }
  return ok(updated)
}

export function assignChildToGroupForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  childId: Id,
  groupId: Id | undefined,
): ServiceResult<Child> {
  const existing = getChildForUser(persistence, currentUser, childId)
  if (!existing.ok) {
    return existing
  }

  return updateChildForUser(persistence, currentUser, childId, {
    firstName: existing.value.firstName,
    lastName: existing.value.lastName,
    birthDate: existing.value.birthDate,
    groupId,
    status: existing.value.status,
    parentContactId: existing.value.parentContactId,
    parentCustomerId: existing.value.parentCustomerId,
    notes: existing.value.notes,
  })
}

export function listChildrenByParentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  parentCustomerId: Id,
): ServiceResult<Child[]> {
  const listed = listChildrenForUser(persistence, currentUser)
  if (!listed.ok) {
    return listed
  }

  const actor = requireChildrenReader(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  const customerId = parentCustomerId.trim()
  if (!customerId) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const customer = persistence.customers.getById(customerId)
  if (!customer || !belongsToOrganization(customer, actor.value.organizationId)) {
    return fail({ code: 'CUSTOMER_NOT_FOUND' })
  }

  return ok(listed.value.filter((child) => child.parentCustomerId === customer.id))
}

export function getChildParentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  childId: Id,
): ServiceResult<{
  customerId?: Id
  contactId?: Id
  fullName?: string
  phone?: string
}> {
  const child = getChildForUser(persistence, currentUser, childId)
  if (!child.ok) {
    return child
  }

  const contact = child.value.parentContactId
    ? persistence.contacts.getById(child.value.parentContactId)
    : undefined
  const customer = child.value.parentCustomerId
    ? persistence.customers.getById(child.value.parentCustomerId)
    : undefined

  if (contact && contact.organizationId !== child.value.organizationId) {
    return ok({})
  }
  if (customer && customer.organizationId !== child.value.organizationId) {
    return ok({})
  }

  const fullName = contact
    ? `${contact.lastName} ${contact.firstName}`.trim()
    : undefined

  return ok({
    customerId: customer?.id,
    contactId: contact?.id,
    fullName: fullName || undefined,
    phone: contact?.phone ?? undefined,
  })
}

export function childDisplayName(child: Pick<Child, 'firstName' | 'lastName'>): string {
  return `${child.lastName} ${child.firstName}`.trim()
}

export function childAgeYears(birthDate: string, at = new Date()): number | undefined {
  const born = new Date(`${birthDate}T00:00:00.000Z`)
  if (Number.isNaN(born.getTime())) {
    return undefined
  }
  let age = at.getUTCFullYear() - born.getUTCFullYear()
  const month = at.getUTCMonth() - born.getUTCMonth()
  if (month < 0 || (month === 0 && at.getUTCDate() < born.getUTCDate())) {
    age -= 1
  }
  return age >= 0 ? age : undefined
}
