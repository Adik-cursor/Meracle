import type { TranslationKey } from '../../../core/localization/translations'
import type { AccessScope } from '../../../core/types'
import type { ModuleAccessFlags } from '../../../core/services/module-access'

export const ACCESS_SCOPE_LABEL_KEY: Record<AccessScope, TranslationKey> = {
  own: 'accessScopeOwn',
  department: 'accessScopeDepartment',
  branch: 'accessScopeBranch',
  warehouse: 'accessScopeWarehouse',
  organization: 'accessScopeOrganization',
}

export function accessScopeDisplayKey(
  scope: AccessScope,
  modules: ModuleAccessFlags,
): TranslationKey {
  if (scope === 'own' && modules.sales !== true) {
    return 'accessScopeOwnData'
  }
  if (scope === 'warehouse' && modules.warehouses !== true) {
    return 'accessScopeOwnData'
  }
  return ACCESS_SCOPE_LABEL_KEY[scope]
}
