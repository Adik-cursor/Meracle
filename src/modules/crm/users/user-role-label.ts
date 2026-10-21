import type { TranslationKey } from '../../../core/localization/translations'
import type { UserRole } from '../../../core/types'

export const USER_ROLE_LABEL_KEY: Record<UserRole, TranslationKey> = {
  owner: 'userRoleOwner',
  commercial_director: 'userRoleCommercialDirector',
  branch_director: 'userRoleBranchDirector',
  sales_manager: 'userRoleSalesManager',
  sales_employee: 'userRoleSalesEmployee',
  office_employee: 'userRoleOfficeEmployee',
  warehouse_manager: 'userRoleWarehouseManager',
  accountant: 'userRoleAccountant',
  kindergarten_admin: 'userRoleAdmin',
}
