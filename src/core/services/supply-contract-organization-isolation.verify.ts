import { checkoutOnCreditForUser } from './checkout-on-credit'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'
import { assert } from './supply-contract.verify-support'
import {
  createSupplyContractForUser,
  getSupplyContractForUser,
} from './supply-contracts'

export function runSupplyContractOrganizationIsolationChecks(): void {
  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-sc-iso-a', 'A')
  addOrg(persistence, 'org-sc-iso-b', 'B')
  persistence.organizations.update('org-sc-iso-a', {
    legalName: 'ТОО A',
    taxId: '000000000003',
    bankName: 'Bank',
    iban: 'KZ1',
    bik: 'BIK',
  })
  persistence.organizations.update('org-sc-iso-b', {
    legalName: 'ТОО B',
    taxId: '000000000005',
    bankName: 'Bank',
    iban: 'KZ2',
    bik: 'BIK',
  })
  seedEnabledBusinessModules(persistence, 'org-sc-iso-a', 'seed', ['sales', 'warehouse', 'crm'])
  seedEnabledBusinessModules(persistence, 'org-sc-iso-b', 'seed', ['sales', 'warehouse', 'crm'])
  const ownerA = addUser(persistence, 'org-sc-iso-a', 'owner')
  const ownerB = addUser(persistence, 'org-sc-iso-b', 'owner')
  const saleA = seedSale(persistence, 'org-sc-iso-a', ownerA)
  const actorA = persistence.users.getById(ownerA.id)
  const actorB = persistence.users.getById(ownerB.id)
  const creditA = checkoutOnCreditForUser(persistence, actorA, 'org-sc-iso-a', saleA.saleId)
  assert(creditA.ok, 'org A credit')
  const created = createSupplyContractForUser(persistence, actorA, { saleId: saleA.saleId })
  assert(created.ok, 'org A contract')
  const stolenCreate = createSupplyContractForUser(persistence, actorB, {
    saleId: saleA.saleId,
  })
  assert(!stolenCreate.ok, 'org B cannot create for A')
  const stolenGet = getSupplyContractForUser(persistence, actorB, created.value.id)
  assert(!stolenGet.ok, 'org B cannot get A contract')
  console.log('supply-contract-organization-isolation.verify: ok')
}

runSupplyContractOrganizationIsolationChecks()
