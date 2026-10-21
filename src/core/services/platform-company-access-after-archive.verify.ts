import { login } from './auth'
import { archiveCompanyForPlatformUser } from './platform-company-lifecycle'
import { getCompanyPeopleForPlatformUser } from './platform-users'
import { assert, seedLifecycleWorld } from './platform-company-lifecycle.verify-support'

export function runPlatformCompanyAccessAfterArchiveChecks(): void {
  const { persistence, platformOwner, employee, orgId } = seedLifecycleWorld()
  archiveCompanyForPlatformUser(persistence, platformOwner, orgId)
  const result = login(persistence, employee.id)
  assert(!result.ok && result.error.code === 'ORGANIZATION_ARCHIVED', 'employee cannot login archived')
  const people = getCompanyPeopleForPlatformUser(persistence, platformOwner, orgId)
  assert(people.ok, 'platform owner can still open company')
  console.log('platform-company-access-after-archive.verify: ok')
}

runPlatformCompanyAccessAfterArchiveChecks()
