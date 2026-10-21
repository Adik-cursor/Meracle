import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { createCustomerForUser } from './contacts'
import { createImplantPackageForUser } from './implant-packages'
import {
  parsePackageFormDraft,
  serializePackageFormDraft,
} from '../../app/routes/package-form-draft'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function addOrg(persistence: Persistence, id: Id, name: string) {
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

function addUser(persistence: Persistence, organizationId: Id, role: UserRole): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}@${organizationId}.local`,
    firstName: 'A',
    lastName: 'B',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(user)
  return user
}

export function runPackageCustomerStateChecks(): void {
  const draft = parsePackageFormDraft(
    serializePackageFormDraft({
      returnPath: '/packages',
      name: 'Пакет 12',
      price: '150000',
      totalImplants: '12',
      customerId: '',
    }),
  )
  assert(draft?.name === 'Пакет 12', 'name kept')
  assert(draft.price === '150000', 'price kept')
  assert(draft.totalImplants === '12', 'implants kept')

  const persistence = createInMemoryPersistence()
  const org = 'org-pkg-state'
  addOrg(persistence, org, 'Dentis')
  seedEnabledBusinessModules(persistence, org, 'seed', ['crm', 'sales', 'packages'])
  const owner = addUser(persistence, org, 'owner')
  const now = nowIso()
  const contactId = newId()
  persistence.contacts.create({
    id: contactId,
    organizationId: org,
    firstName: 'Новый',
    lastName: 'Клиент',
    email: null,
    phone: null,
    companyId: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const created = createCustomerForUser(
    persistence,
    owner,
    { type: 'contact', contactId, status: 'active' },
    {
      getContact: (id) => persistence.contacts.getById(id),
      getCompany: () => undefined,
    },
  )
  assert(created.ok, 'create customer from package')
  const restored = parsePackageFormDraft(
    serializePackageFormDraft({
      ...draft,
      customerId: created.value.id,
    }),
  )
  assert(restored?.customerId === created.value.id, 'auto-select customer id')
  const pkg = createImplantPackageForUser(persistence, owner, {
    customerId: restored.customerId,
    name: restored.name,
    price: Number(restored.price),
    currency: 'KZT',
    totalImplants: Number(restored.totalImplants),
    startDate: now.slice(0, 10),
  })
  assert(pkg.ok, 'package uses restored fields and new customer')
  assert(pkg.value.customerId === created.value.id, 'customer assigned')
  assert(pkg.value.name === 'Пакет 12', 'name not lost')
  console.log('package-customer-state.verify: ok')
}

runPackageCustomerStateChecks()
