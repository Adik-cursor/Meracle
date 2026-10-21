import type { OrganizationStatus } from '../../core/types'
import type { TranslationKey } from '../../core/localization/translations'

export function organizationStatusLabelKey(
  status: OrganizationStatus,
): TranslationKey {
  if (status === 'archived') {
    return 'organizationStatusArchived'
  }
  if (status === 'suspended') {
    return 'organizationStatusSuspended'
  }
  if (status === 'inactive') {
    return 'organizationStatusInactive'
  }
  return 'organizationStatusActive'
}

export function isSuspendedOrganizationStatus(status: OrganizationStatus): boolean {
  return status === 'suspended' || status === 'inactive'
}
