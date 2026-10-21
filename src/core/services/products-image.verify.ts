import type { Id, User, UserRole } from '../types'
import type { DomainErrorCode } from '../types/domain-error'
import {
  parseProductImageUrl,
  PRODUCT_IMAGE_DATA_URL_MAX_LENGTH,
} from '../types/product'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { PersistenceState } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import {
  createProductForUser,
  listProductsForUser,
  updateProductForUser,
} from './products'

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const GIF =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function denied(
  result: { ok: boolean; error?: { code: DomainErrorCode } },
  code: DomainErrorCode,
  message: string,
): void {
  assert(!result.ok && result.error?.code === code, message)
}

function addOrg(persistence: Persistence, id: Id, name: string): void {
  const now = nowIso()
  persistence.organizations.create({
    id,
    organizationId: id,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

function addUser(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}-${newId()}@${organizationId}.local`,
    firstName: role,
    lastName: 'User',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(user)
  return user
}

const catalogDraft = {
  name: 'Chair',
  sku: 'CH-1',
  unit: 'шт',
  itemType: 'product' as const,
  basePrice: 100,
  costPrice: 40,
  status: 'active' as const,
}

export function runProductImageChecks(): void {
  assert(parseProductImageUrl(undefined) === undefined, 'empty image')
  assert(parseProductImageUrl(PNG) === PNG, 'valid png')
  assert(parseProductImageUrl('https://cdn.example/photo.png') === null, 'reject url')
  assert(parseProductImageUrl('data:text/plain;base64,QQ==') === null, 'reject non-image')

  let stored: PersistenceState | undefined
  const persistence = createInMemoryPersistence({
    persistState: (state) => {
      stored = state
    },
  })
  const orgA = 'org-photo-a'
  const orgB = 'org-photo-b'
  addOrg(persistence, orgA, 'A')
  addOrg(persistence, orgB, 'B')
  seedEnabledBusinessModules(persistence, orgA, 'seed')
  seedEnabledBusinessModules(persistence, orgB, 'seed')

  const ownerA = addUser(persistence, orgA, 'owner')
  const employeeA = addUser(persistence, orgA, 'sales_employee')
  const ownerB = addUser(persistence, orgB, 'owner')

  const withoutPhoto = createProductForUser(persistence, ownerA, orgA, catalogDraft)
  assert(withoutPhoto.ok, 'create without photo')
  assert(!withoutPhoto.value.imageUrl, 'no image stored')

  const withPhoto = createProductForUser(persistence, ownerA, orgA, {
    ...catalogDraft,
    sku: 'CH-2',
    imageUrl: PNG,
    ...({ organizationId: orgB } as { organizationId: Id }),
  })
  assert(withPhoto.ok, 'create with photo')
  assert(withPhoto.value.organizationId === orgA, 'org from service context')
  assert(withPhoto.value.imageUrl === PNG, 'image stored on product')

  const listedA = listProductsForUser(persistence, ownerA)
  assert(listedA.ok, 'list A')
  const listedPhoto = listedA.value.find((item) => item.id === withPhoto.value.id)
  assert(listedPhoto?.imageUrl === PNG, 'photo visible in catalog list')

  const listedEmployee = listProductsForUser(persistence, employeeA)
  assert(listedEmployee.ok, 'employee can read')
  assert(
    listedEmployee.value.some(
      (item) => item.id === withPhoto.value.id && item.imageUrl === PNG,
    ),
    'employee with products.read sees photo',
  )

  denied(
    createProductForUser(persistence, employeeA, orgA, {
      ...catalogDraft,
      sku: 'CH-X',
      imageUrl: PNG,
    }),
    'ACCESS_DENIED',
    'employee cannot upload via create',
  )
  denied(
    updateProductForUser(persistence, employeeA, orgA, withPhoto.value.id, {
      ...catalogDraft,
      sku: 'CH-2',
      imageUrl: GIF,
    }),
    'ACCESS_DENIED',
    'employee cannot change photo',
  )

  const listedB = listProductsForUser(persistence, ownerB)
  assert(listedB.ok, 'list B')
  assert(
    !listedB.value.some((item) => item.id === withPhoto.value.id),
    'company B does not see company A product',
  )
  denied(
    createProductForUser(persistence, ownerA, orgB, {
      ...catalogDraft,
      sku: 'CROSS',
      imageUrl: PNG,
    }),
    'ACCESS_DENIED',
    'cannot create photo product in another org',
  )
  denied(
    updateProductForUser(persistence, ownerB, orgB, withPhoto.value.id, {
      ...catalogDraft,
      sku: 'CH-2',
      imageUrl: GIF,
    }),
    'ORGANIZATION_MISMATCH',
    'cannot update foreign product photo',
  )

  denied(
    createProductForUser(persistence, ownerA, orgA, {
      ...catalogDraft,
      sku: 'BAD',
      imageUrl: 'https://example.com/x.png',
    }),
    'INVALID_INPUT',
    'remote url rejected',
  )
  denied(
    createProductForUser(persistence, ownerA, orgA, {
      ...catalogDraft,
      sku: 'BIG',
      imageUrl: `data:image/png;base64,${'A'.repeat(PRODUCT_IMAGE_DATA_URL_MAX_LENGTH)}`,
    }),
    'INVALID_INPUT',
    'oversized data url rejected',
  )

  const replaced = updateProductForUser(
    persistence,
    ownerA,
    orgA,
    withPhoto.value.id,
    {
      ...catalogDraft,
      sku: 'CH-2',
      imageUrl: GIF,
    },
  )
  assert(replaced.ok && replaced.value.imageUrl === GIF, 'replace photo')

  const kept = updateProductForUser(persistence, ownerA, orgA, withPhoto.value.id, {
    ...catalogDraft,
    sku: 'CH-2',
    name: 'Chair updated',
  })
  assert(kept.ok && kept.value.imageUrl === GIF, 'omitted imageUrl keeps photo')

  const cleared = updateProductForUser(
    persistence,
    ownerA,
    orgA,
    withPhoto.value.id,
    {
      ...catalogDraft,
      sku: 'CH-2',
      imageUrl: undefined,
    },
  )
  assert(cleared.ok && !cleared.value.imageUrl, 'clear photo')

  assert(stored, 'persistence snapshot')
  const restored = createInMemoryPersistence({
    initialState: JSON.parse(JSON.stringify(stored)) as PersistenceState,
  })
  const revived = restored.products.getById(withoutPhoto.value.id)
  const revivedPhoto = restored.products.getById(withPhoto.value.id)
  assert(revived && !revived.imageUrl, 'reload keeps product without photo')
  assert(revivedPhoto && !revivedPhoto.imageUrl, 'cleared photo stays cleared after reload')

  const again = createProductForUser(persistence, ownerA, orgA, {
    ...catalogDraft,
    sku: 'CH-3',
    imageUrl: PNG,
  })
  assert(again.ok && again.value.imageUrl === PNG, 'create photo again')
  assert(stored, 'snapshot after second photo')
  const restoredPhoto = createInMemoryPersistence({
    initialState: JSON.parse(JSON.stringify(stored)) as PersistenceState,
  })
  assert(
    restoredPhoto.products.getById(again.value.id)?.imageUrl === PNG,
    'photo survives persist/reload',
  )

  console.log('products-image.verify: ok')
}

runProductImageChecks()
