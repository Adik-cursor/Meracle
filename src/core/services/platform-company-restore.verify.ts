import { login } from './auth'
import {
  archiveCompanyForPlatformUser,
  restoreCompanyForPlatformUser,
} from './platform-company-lifecycle'
import { assert, seedLifecycleWorld } from './platform-company-lifecycle.verify-support'

export function runPlatformCompanyRestoreChecks(): void {
  const { persistence, platformOwner, employee, orgId } = seedLifecycleWorld()
  archiveCompanyForPlatformUser(persistence, platformOwner, orgId)
  const restored = restoreCompanyForPlatformUser(persistence, platformOwner, orgId)
  assert(restored.ok && restored.value.status === 'active', 'restored to active')
  const result = login(persistence, employee.id)
  assert(result.ok, 'employee can login after restore')
  console.log('platform-company-restore.verify: ok')
}

runPlatformCompanyRestoreChecks()
