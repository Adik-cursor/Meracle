import type { TranslationKey } from '../../core/localization/translations'
import type { PlatformModuleKey } from '../../core/types'

export const PLATFORM_MODULE_LABEL_KEY: Record<PlatformModuleKey, TranslationKey> = {
  crm: 'platformModuleCrm',
  sales: 'platformModuleSales',
  warehouse: 'platformModuleWarehouse',
  expenses: 'platformModuleExpenses',
  analytics: 'platformModuleAnalytics',
  rental: 'platformModuleRental',
  children: 'platformModuleChildren',
  attendance: 'platformModuleAttendance',
  plans: 'platformModulePlans',
  packages: 'platformModulePackages',
}

export const PLATFORM_MODULE_DESCRIPTION_KEY: Record<
  PlatformModuleKey,
  TranslationKey
> = {
  crm: 'platformModuleCrmDescription',
  sales: 'platformModuleSalesDescription',
  warehouse: 'platformModuleWarehouseDescription',
  expenses: 'platformModuleExpensesDescription',
  analytics: 'platformModuleAnalyticsDescription',
  rental: 'platformModuleRentalDescription',
  children: 'platformModuleChildrenDescription',
  attendance: 'platformModuleAttendanceDescription',
  plans: 'platformModulePlansDescription',
  packages: 'platformModulePackagesDescription',
}
