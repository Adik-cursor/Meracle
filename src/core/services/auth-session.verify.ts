import type { Session, User } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { PersistenceState } from '../repositories/in-memory/create-in-memory-persistence'
import { createFirstOwner } from './users'
import {
  getCurrentUser,
  getSession,
  login,
  logout,
} from './auth'
import { nowIso } from './primitives'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runAuthSessionChecks(): void {
  let stored: PersistenceState | undefined
  const origin = createInMemoryPersistence({
    persistState: (state) => {
      stored = state
    },
  })
  const orgId = 'org-runtime'
  addOrganization(origin, orgId)

  const owner = createFirstOwner(origin, orgId, {
    firstName: 'Test',
    lastName: 'Fixture',
    email: 'demo-user-002@example.com',
  })
  assert(owner.ok, 'create first owner')

  const signedIn = login(origin, owner.value.id)
  assert(signedIn.ok, 'login owner')

  const session = getSession(origin)
  assert(session, 'session created')
  assert(session.userId === owner.value.id, 'session.userId')
  assert(session.organizationId === orgId, 'session.organizationId')
  assert(Boolean(session.id && session.createdAt), 'session id/createdAt')
  assert(stored?.sessions?.id === session.id, 'session persisted')
  assert(
    stored?.users.some((user) => user.id === owner.value.id),
    'user persisted with session',
  )

  const reloaded = createInMemoryPersistence({ initialState: stored })
  const restored = getCurrentUser(reloaded, orgId)
  assert(restored.ok, 'restore currentUser after reload')
  assert(restored.value.id === owner.value.id, 'same user')
  assert(restored.value.role === 'owner', 'same role')
  assert(getSession(reloaded)?.id === session.id, 'same session id')

  logout(origin)
  assert(!getSession(origin), 'logout clears session')
  assert(!stored?.sessions, 'logout persists cleared session')
  const afterLogout = getCurrentUser(origin, orgId)
  assert(!afterLogout.ok, 'logout has no currentUser')

  const loggedOutReload = createInMemoryPersistence({
    initialState: stored,
  })
  assert(
    loggedOutReload.users.list(orgId).length > 0,
    'owner remains after logout persist',
  )
  assert(!getSession(loggedOutReload), 'reload after logout has no session')
  assert(!getCurrentUser(loggedOutReload, orgId).ok, 'reload after logout not authenticated')

  const active = createInMemoryPersistence()
  addOrganization(active, orgId)
  const created = createFirstOwner(active, orgId, {
    firstName: 'A',
    lastName: 'B',
    email: 'demo-user-001@example.com',
  })
  assert(created.ok, 'owner for inactive')
  assert(login(active, created.value.id).ok, 'login before inactive')
  active.users.update(created.value.id, { status: 'disabled', updatedAt: nowIso() })
  const inactive = getCurrentUser(active, orgId)
  assert(!inactive.ok && inactive.error.code === 'USER_INACTIVE', 'inactive invalidates')
  assert(!getSession(active), 'inactive clears session')

  const mismatch = createInMemoryPersistence()
  const foreign: User = {
    ...created.value,
    id: 'user-b',
    organizationId: 'org-b',
    email: 'demo-user-008@example.com',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  mismatch.users.create(foreign)
  const badSession: Session = {
    id: 'session-x',
    userId: foreign.id,
    organizationId: orgId,
    createdAt: nowIso(),
  }
  mismatch.auth.createSession(badSession)
  const crossed = getCurrentUser(mismatch, orgId)
  assert(!crossed.ok, 'cross-organization session invalid')
  assert(!getSession(mismatch), 'cross-organization clears session')
}

function addOrganization(
  persistence: ReturnType<typeof createInMemoryPersistence>,
  id: string,
): void {
  const now = nowIso()
  persistence.organizations.create({
    id,
    organizationId: id,
    name: 'Test Organization',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}
