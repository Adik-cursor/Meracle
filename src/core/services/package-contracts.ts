import type { Id, PackageContract, PackageContractStatus, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { newId, nowIso } from './primitives'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import { getCustomerDisplayName } from '../../modules/crm/customers/customer-name'

export type PackageContractWrite = {
  packageId: Id
  contractNumber: string
  contractDate: string
  status?: PackageContractStatus
}

export type PackageContractRow = {
  contract: PackageContract
  packageName: string
  customerName: string
  templateConnected: false
}

function requirePackagesActor(
  persistence: Persistence,
  currentUser: User | null | undefined,
) {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'packages')
  if (!gated.ok) {
    return gated
  }
  return requireActorInOrganization(gated.value, gated.value.organizationId)
}

function toRow(persistence: Persistence, contract: PackageContract): PackageContractRow {
  const pkg = persistence.implantPackages.getById(contract.packageId)
  const customer = persistence.customers.getById(contract.customerId)
  return {
    contract,
    packageName: pkg?.name ?? '',
    customerName: customer
      ? getCustomerDisplayName(
          customer,
          persistence.contacts.list(contract.organizationId),
          [],
        )
      : '',
    templateConnected: false,
  }
}

export function createPackageContractForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: PackageContractWrite,
): ServiceResult<PackageContract> {
  const actor = requirePackagesActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  const organizationId = actor.value.organizationId
  const pkg = persistence.implantPackages.getById(draft.packageId)
  if (!pkg || pkg.organizationId !== organizationId) {
    return fail({ code: 'PACKAGE_NOT_FOUND' })
  }
  const number = draft.contractNumber.trim()
  if (!number || !draft.contractDate.trim()) {
    return fail({ code: 'INVALID_INPUT' })
  }
  const now = nowIso()
  const contract: PackageContract = {
    id: newId(),
    organizationId,
    packageId: pkg.id,
    customerId: pkg.customerId,
    contractNumber: number,
    contractDate: draft.contractDate,
    status: draft.status ?? 'draft',
    createdAt: now,
    updatedAt: now,
  }
  return persistence.runInTransaction(() => {
    persistence.packageContracts.create(contract)
    persistence.implantPackages.update(pkg.id, {
      contractId: contract.id,
      updatedAt: now,
    })
    return ok(contract)
  })
}

export function listPackageContractsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<PackageContractRow[]> {
  const actor = requirePackagesActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  return ok(
    persistence.packageContracts
      .list(actor.value.organizationId)
      .map((contract) => toRow(persistence, contract)),
  )
}

export function getPackageContractForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  contractId: Id,
): ServiceResult<PackageContractRow> {
  const actor = requirePackagesActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  const contract = persistence.packageContracts.getById(contractId)
  if (!contract || contract.organizationId !== actor.value.organizationId) {
    return fail({ code: 'CONTRACT_NOT_FOUND' })
  }
  return ok(toRow(persistence, contract))
}

export function generatePackageContractDocumentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  contractId: Id,
): ServiceResult<never> {
  const loaded = getPackageContractForUser(persistence, currentUser, contractId)
  if (!loaded.ok) {
    return loaded
  }
  void loaded
  return fail({ code: 'CONTRACT_TEMPLATE_UNAVAILABLE' })
}
