import type { Id, User } from '../types'
import type { Persistence } from '../repositories/persistence'
import { PLATFORM_ORGANIZATION_ID } from '../config/platform'
import { isPlatformOwner } from './organization-modules'
import { isUserAccountEnabled } from './user-account'
import { userDisplayName } from '../../modules/crm/users/user-name'
import { DEMO_MODE } from '../config/demo-mode'

export type LoginUserRow = {
  user: User
  organizationId: Id
  organizationName: string
  isPlatform: boolean
}

export function listLoginUserRows(persistence: Persistence): LoginUserRow[] {
  const organizations = persistence.organizations.listAll()
  const rows: LoginUserRow[] = []

  for (const organization of organizations) {
    for (const user of persistence.users.list(organization.id)) {
      if (DEMO_MODE && (isPlatformOwner(user) || organization.id === PLATFORM_ORGANIZATION_ID)) {
        continue
      }
      if (!isUserAccountEnabled(user)) {
        continue
      }
      const isPlatform = isPlatformOwner(user) || organization.id === PLATFORM_ORGANIZATION_ID
      rows.push({
        user,
        organizationId: organization.id,
        organizationName: organization.name?.trim() || organization.legalName?.trim() || organization.id,
        isPlatform,
      })
    }
  }

  return rows.sort((left, right) => {
    if (left.isPlatform !== right.isPlatform) {
      return left.isPlatform ? -1 : 1
    }
    const byCompany = left.organizationName.localeCompare(right.organizationName, 'ru')
    if (byCompany !== 0) {
      return byCompany
    }
    return userDisplayName(left.user).localeCompare(userDisplayName(right.user), 'ru')
  })
}
