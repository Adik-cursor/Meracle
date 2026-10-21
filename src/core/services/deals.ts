import type { Deal, DealStatus, Id, Nullable, User } from '../types'
import { fail, ok, okVoid, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import {
  canAccessDeal,
  denyUnless,
  getAccessScope,
  requireActorInOrganization,
} from './access'
import { isNonNegativeQuantity, newId, nowIso } from './primitives'
import { requireModuleEnabledForUser } from './organization-modules'

export const DEAL_STATUSES: readonly DealStatus[] = [
  'new',
  'in_progress',
  'won',
  'lost',
]

export type DealWrite = {
  title: string
  amount: Nullable<number>
  currency: string
  companyId: Nullable<Id>
  contactId: Nullable<Id>
  status: DealStatus
  assignedUserId?: Id
}

export type DealPartyLookup = {
  getContact: (
    id: Id,
  ) =>
    | {
        organizationId: Id
        firstName?: string
        lastName?: string
        phone?: Nullable<string>
        email?: Nullable<string>
      }
    | undefined
  getCompany: (id: Id) => { organizationId: Id; name?: string } | undefined
}

function isDealStatus(value: string): value is DealStatus {
  return DEAL_STATUSES.includes(value as DealStatus)
}

function requireDeal(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult<Deal> {
  const deal = persistence.deals.getById(id)

  if (!deal) {
    return fail({ code: 'DEAL_NOT_FOUND' })
  }

  if (!belongsToOrganization(deal, organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(deal)
}

function normalizePartyId(value: Nullable<Id> | undefined): Nullable<Id> {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function validateParty(
  organizationId: Id,
  lookup: DealPartyLookup,
  companyId: Nullable<Id>,
  contactId: Nullable<Id>,
): ServiceResult {
  if (companyId) {
    const company = lookup.getCompany(companyId)
    if (!company) {
      return fail({ code: 'INVALID_INPUT' })
    }
    if (company.organizationId !== organizationId) {
      return fail({ code: 'ORGANIZATION_MISMATCH' })
    }
  }

  if (contactId) {
    const contact = lookup.getContact(contactId)
    if (!contact) {
      return fail({ code: 'INVALID_INPUT' })
    }
    if (contact.organizationId !== organizationId) {
      return fail({ code: 'ORGANIZATION_MISMATCH' })
    }
  }

  return okVoid()
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
    return fail({ code: 'USER_NOT_FOUND' })
  }

  if (user.organizationId !== organizationId) {
    return fail({ code: 'USER_ORGANIZATION_MISMATCH' })
  }

  if (user.status !== 'active') {
    return fail({ code: 'USER_INACTIVE' })
  }

  return okVoid()
}

function resolveDealOwnership(
  persistence: Persistence,
  assignedUserId: Id | undefined,
): Pick<Deal, 'assignedUserId' | 'ownerUserId' | 'branchId' | 'departmentId'> {
  const owner = assignedUserId
    ? persistence.users.getById(assignedUserId)
    : undefined

  return {
    assignedUserId,
    ownerUserId: assignedUserId,
    branchId: owner?.branchId,
    departmentId: owner?.departmentId,
  }
}

function hydrateDeal(persistence: Persistence, deal: Deal): Deal {
  const assignedUserId = deal.assignedUserId ?? deal.ownerUserId
  const ownership = resolveDealOwnership(persistence, assignedUserId)
  const hydrated: Deal = {
    ...deal,
    assignedUserId: ownership.assignedUserId,
    ownerUserId: deal.ownerUserId ?? ownership.ownerUserId,
    branchId: deal.branchId ?? ownership.branchId,
    departmentId: deal.departmentId ?? ownership.departmentId,
  }

  if (
    hydrated.ownerUserId !== deal.ownerUserId ||
    hydrated.branchId !== deal.branchId ||
    hydrated.departmentId !== deal.departmentId ||
    hydrated.assignedUserId !== deal.assignedUserId
  ) {
    return hydrated
  }

  return deal
}

function normalizeWrite(
  persistence: Persistence,
  organizationId: Id,
  draft: DealWrite,
  lookup: DealPartyLookup,
): ServiceResult<DealWrite> {
  const title = draft.title.trim()
  const currency = draft.currency.trim()
  const companyId = normalizePartyId(draft.companyId)
  const contactId = normalizePartyId(draft.contactId)
  const assignedUserId = normalizePartyId(draft.assignedUserId ?? null) ?? undefined

  if (!title || !currency || !isDealStatus(draft.status)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (draft.amount !== null && !isNonNegativeQuantity(draft.amount)) {
    return fail({ code: 'INVALID_QUANTITY' })
  }

  const party = validateParty(organizationId, lookup, companyId, contactId)
  if (!party.ok) {
    return party
  }

  const assignee = validateAssignee(persistence, organizationId, assignedUserId)
  if (!assignee.ok) {
    return assignee
  }

  return ok({
    title,
    amount: draft.amount,
    currency,
    companyId,
    contactId,
    status: draft.status,
    assignedUserId,
  })
}

export function createDeal(
  persistence: Persistence,
  organizationId: Id,
  draft: DealWrite,
  lookup: DealPartyLookup,
): ServiceResult<Deal> {
  const normalized = normalizeWrite(persistence, organizationId, draft, lookup)
  if (!normalized.ok) {
    return normalized
  }

  const now = nowIso()
  const ownership = resolveDealOwnership(
    persistence,
    normalized.value.assignedUserId,
  )
  const deal: Deal = {
    id: newId(),
    organizationId,
    ...normalized.value,
    ...ownership,
    createdAt: now,
    updatedAt: now,
  }

  return ok(persistence.deals.create(deal))
}

export function updateDeal(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  draft: DealWrite,
  lookup: DealPartyLookup,
): ServiceResult<Deal> {
  const existing = requireDeal(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const normalized = normalizeWrite(persistence, organizationId, draft, lookup)
  if (!normalized.ok) {
    return normalized
  }

  const ownership = resolveDealOwnership(
    persistence,
    normalized.value.assignedUserId,
  )
  const updated = persistence.deals.update(id, {
    ...normalized.value,
    ...ownership,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'DEAL_NOT_FOUND' })
  }

  return ok(updated)
}

export function setDealStatus(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  status: DealStatus,
): ServiceResult<Deal> {
  const existing = requireDeal(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  if (!isDealStatus(status)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const updated = persistence.deals.update(id, {
    status,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'DEAL_NOT_FOUND' })
  }

  return ok(updated)
}

export function listDealsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<Deal[]> {
  const actor = requireModuleEnabledForUser(persistence, currentUser, 'crm')
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.deals
      .list(actor.value.organizationId)
      .map((deal) => hydrateDeal(persistence, deal))
      .filter((deal) => canAccessDeal(persistence, actor.value, deal)),
  )
}

export function getDealForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
): ServiceResult<Deal> {
  const actor = requireModuleEnabledForUser(persistence, currentUser, 'crm')
  if (!actor.ok) {
    return actor
  }

  const deal = persistence.deals.getById(id)
  if (!deal) {
    return fail({ code: 'DEAL_NOT_FOUND' })
  }

  const hydrated = hydrateDeal(persistence, deal)
  const allowed = denyUnless(canAccessDeal(persistence, actor.value, hydrated))
  if (!allowed.ok) {
    return allowed
  }

  return ok(hydrated)
}

export function searchDealsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  query: string,
  lookup: DealPartyLookup,
): ServiceResult<Deal[]> {
  const listed = listDealsForUser(persistence, currentUser)
  if (!listed.ok) {
    return listed
  }

  const needle = query.trim().toLowerCase()
  if (!needle) {
    return listed
  }

  return ok(
    listed.value.filter((deal) => {
      if (deal.id.toLowerCase().includes(needle)) {
        return true
      }

      if (deal.title.toLowerCase().includes(needle)) {
        return true
      }

      if (deal.companyId) {
        const company = lookup.getCompany(deal.companyId)
        if (company?.name?.toLowerCase().includes(needle)) {
          return true
        }
      }

      if (deal.contactId) {
        const contact = lookup.getContact(deal.contactId)
        if (contact) {
          const haystack = [
            contact.firstName,
            contact.lastName,
            contact.phone,
            contact.email,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          if (haystack.includes(needle)) {
            return true
          }
        }
      }

      return false
    }),
  )
}

export function deleteDealForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = getDealForUser(persistence, actor.value, id)
  if (!existing.ok) {
    return existing
  }

  if (getAccessScope(actor.value) === 'own') {
    return fail({ code: 'ACCESS_DENIED' })
  }

  if (!persistence.deals.delete(id)) {
    return fail({ code: 'DEAL_NOT_FOUND' })
  }

  return okVoid()
}

export function createDealForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: DealWrite,
  lookup: DealPartyLookup,
): ServiceResult<Deal> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'crm')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const assignedUserId =
    draft.assignedUserId ??
    (getAccessScope(actor.value) === 'organization'
      ? undefined
      : actor.value.id)
  const assigned = denyUnless(
    canAccessDeal(persistence, actor.value, {
      organizationId,
      assignedUserId,
      ownerUserId: assignedUserId,
    }),
  )
  if (!assigned.ok) {
    return assigned
  }

  return createDeal(
    persistence,
    organizationId,
    { ...draft, assignedUserId },
    lookup,
  )
}

export function updateDealForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  draft: DealWrite,
  lookup: DealPartyLookup,
): ServiceResult<Deal> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'crm')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = getDealForUser(persistence, actor.value, id)
  if (!existing.ok) {
    return existing
  }

  const canWrite = denyUnless(
    canAccessDeal(persistence, actor.value, {
      organizationId,
      assignedUserId: draft.assignedUserId,
      ownerUserId: draft.assignedUserId,
    }),
  )
  if (!canWrite.ok) {
    return canWrite
  }

  return updateDeal(persistence, organizationId, id, draft, lookup)
}

export function setDealStatusForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  status: DealStatus,
): ServiceResult<Deal> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'crm')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = getDealForUser(persistence, actor.value, id)
  if (!existing.ok) {
    return existing
  }

  return setDealStatus(persistence, organizationId, existing.value.id, status)
}
