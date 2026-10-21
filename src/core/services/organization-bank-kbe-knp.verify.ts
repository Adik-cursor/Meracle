import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { updateCompanyOrganizationForUser } from './company-organization'
import { addOrg, addUser } from './sales-invoice.verify'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runOrganizationBankKbeKnpChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgId = 'org-kbe-profile'
  addOrg(persistence, orgId, 'ТОО Реквизиты')
  const owner = addUser(persistence, orgId, 'owner')
  const actor = persistence.users.getById(owner.id)
  assert(actor, 'owner')

  const filled = updateCompanyOrganizationForUser(persistence, actor, orgId, {
    name: 'ТОО Реквизиты',
    currency: 'KZT',
    timezone: 'Asia/Almaty',
    kbe: '19',
    knp: '710',
  })
  assert(filled.ok, 'save optional kbe/knp')
  assert(filled.value.kbe === '19', 'organization.kbe')
  assert(filled.value.knp === '710', 'organization.knp')
  assert(persistence.organizations.getById(orgId)?.kbe === '19', 'persisted kbe')
  assert(persistence.organizations.getById(orgId)?.knp === '710', 'persisted knp')

  const emptied = updateCompanyOrganizationForUser(persistence, actor, orgId, {
    name: 'ТОО Реквизиты',
    currency: 'KZT',
    timezone: 'Asia/Almaty',
    kbe: '   ',
    knp: '',
  })
  assert(emptied.ok, 'empty save allowed')
  assert(!emptied.value.kbe, 'cleared kbe')
  assert(!emptied.value.knp, 'cleared knp')
  console.log('organization-bank-kbe-knp.verify: ok')
}

runOrganizationBankKbeKnpChecks()
