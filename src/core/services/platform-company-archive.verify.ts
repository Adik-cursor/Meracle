import { archiveCompanyForPlatformUser } from './platform-company-lifecycle'
import { listPlatformOrganizationsForUser } from './organization-modules'
import { assert, seedLifecycleWorld, seedSaleInOrg } from './platform-company-lifecycle.verify-support'

export function runPlatformCompanyArchiveChecks(): void {
  const { persistence, platformOwner, companyOwner, employee, orgId } = seedLifecycleWorld()
  const sale = seedSaleInOrg(persistence, companyOwner, orgId)
  const archived = archiveCompanyForPlatformUser(persistence, platformOwner, orgId)
  assert(archived.ok && archived.value.status === 'archived', 'archived')
  assert(persistence.organizations.getById(orgId)?.id === orgId, 'organization not hard-deleted')
  assert(persistence.users.getById(employee.id), 'employees kept')
  assert(persistence.sales.getById(sale.id), 'sales kept')
  const listed = listPlatformOrganizationsForUser(persistence, platformOwner)
  assert(
    listed.ok && listed.value.some((item) => item.organization.id === orgId),
    'archived still visible to platform owner',
  )
  console.log('platform-company-archive.verify: ok')
}

runPlatformCompanyArchiveChecks()
