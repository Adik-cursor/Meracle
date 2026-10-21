import type { TranslationKey } from '../../../core/localization/translations'
import type { UserStatus } from '../../../core/types'

export const USER_STATUS_LABEL_KEY: Record<UserStatus, TranslationKey> = {
  active: 'active',
  invited: 'employeeStatusInvited',
  disabled: 'employeeStatusDisabled',
}
