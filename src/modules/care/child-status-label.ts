import type { ChildStatus } from '../../core/types'
import type { TranslationKey } from '../../core/localization/translations'

export const CHILD_STATUS_KEYS: Record<ChildStatus, TranslationKey> = {
  attending: 'careStatusAttending',
  temporarily_absent: 'careStatusTemporarilyAbsent',
  withdrawn: 'careStatusWithdrawn',
}

export function childStatusLabelKey(status: ChildStatus): TranslationKey {
  return CHILD_STATUS_KEYS[status]
}
