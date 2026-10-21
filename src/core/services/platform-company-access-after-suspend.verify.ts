import { login } from './auth'
import { suspendCompanyForPlatformUser } from './platform-company-lifecycle'
import { assert, seedLifecycleWorld } from './platform-company-lifecycle.verify-support'

export function runPlatformCompanyAccessAfterSuspendChecks(): void {
  const { persistence, platformOwner, employee, orgId } = seedLifecycleWorld()
  suspendCompanyForPlatformUser(persistence, platformOwner, orgId)
  const result = login(persistence, employee.id)
  assert(!result.ok && result.error.code === 'ORGANIZATION_SUSPENDED', 'employee cannot login')
  const ownerLogin = login(persistence, platformOwner.id)
  assert(ownerLogin.ok, 'platform owner still logs in')
  console.log('platform-company-access-after-suspend.verify: ok')
}

runPlatformCompanyAccessAfterSuspendChecks()
