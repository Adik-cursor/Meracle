import { suspendCompanyForPlatformUser } from './platform-company-lifecycle'
import { assert, seedLifecycleWorld } from './platform-company-lifecycle.verify-support'

export function runPlatformCompanySuspendChecks(): void {
  const { persistence, platformOwner, employee, orgId } = seedLifecycleWorld()
  const denied = suspendCompanyForPlatformUser(persistence, employee, orgId)
  assert(!denied.ok && denied.error.code === 'ACCESS_DENIED', 'employee cannot suspend')
  const suspended = suspendCompanyForPlatformUser(persistence, platformOwner, orgId)
  assert(suspended.ok && suspended.value.status === 'suspended', 'platform suspends')
  assert(persistence.users.getById(employee.id)?.id === employee.id, 'employee remains')
  console.log('platform-company-suspend.verify: ok')
}

runPlatformCompanySuspendChecks()
