import { listPlatformModuleLogsForUser, listPlatformOrganizationsForUser } from './organization-modules'
import {
  archiveCompanyForPlatformUser,
  reactivateCompanyForPlatformUser,
  restoreCompanyForPlatformUser,
  suspendCompanyForPlatformUser,
} from './platform-company-lifecycle'
import { assert, seedLifecycleWorld } from './platform-company-lifecycle.verify-support'

export function runPlatformCompanyLifecycleChecks(): void {
  const { persistence, platformOwner, orgId } = seedLifecycleWorld()
  const listed = listPlatformOrganizationsForUser(persistence, platformOwner)
  assert(listed.ok && listed.value.some((item) => item.organization.id === orgId), 'owner sees company')
  const suspended = suspendCompanyForPlatformUser(persistence, platformOwner, orgId)
  assert(suspended.ok && suspended.value.status === 'suspended', 'suspend')
  const resumed = reactivateCompanyForPlatformUser(persistence, platformOwner, orgId)
  assert(resumed.ok && resumed.value.status === 'active', 'resume')
  const archived = archiveCompanyForPlatformUser(persistence, platformOwner, orgId)
  assert(archived.ok && archived.value.status === 'archived', 'archive')
  const restored = restoreCompanyForPlatformUser(persistence, platformOwner, orgId)
  assert(restored.ok && restored.value.status === 'active', 'restore')
  const logs = listPlatformModuleLogsForUser(persistence, platformOwner)
  assert(logs.ok, 'journal readable')
  const fields = logs.value.map((item) => item.field)
  assert(fields.includes('lifecycle.COMPANY_SUSPENDED'), 'COMPANY_SUSPENDED')
  assert(fields.includes('lifecycle.COMPANY_REACTIVATED'), 'COMPANY_REACTIVATED')
  assert(fields.includes('lifecycle.COMPANY_ARCHIVED'), 'COMPANY_ARCHIVED')
  assert(fields.includes('lifecycle.COMPANY_RESTORED'), 'COMPANY_RESTORED')
  console.log('platform-company-lifecycle.verify: ok')
}

runPlatformCompanyLifecycleChecks()
