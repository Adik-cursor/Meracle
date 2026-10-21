import type { BusinessTemplate } from '../types/business-template'
import type { BusinessType } from '../types/business-type'
import type { PlatformModuleKey } from '../types/platform-module'
import { isPlatformModuleKey } from '../types/platform-module'
import { PLATFORM_ORGANIZATION_ID } from './platform'

export const UNIVERSAL_BUSINESS_TYPE_ID = 'universal'

type CatalogType = Pick<BusinessType, 'id' | 'name' | 'description' | 'active'>
type CatalogTemplate = Pick<
  BusinessTemplate,
  'id' | 'businessTypeId' | 'name' | 'description' | 'moduleIds' | 'active'
>

const CORE_MODULES: PlatformModuleKey[] = [
  'crm',
  'sales',
  'warehouse',
  'expenses',
  'analytics',
  'plans',
  'attendance',
]

function onlyRegistered(keys: readonly string[]): PlatformModuleKey[] {
  return keys.filter(isPlatformModuleKey)
}

export const DEFAULT_BUSINESS_TYPES: readonly CatalogType[] = [
  {
    id: UNIVERSAL_BUSINESS_TYPE_ID,
    name: 'Universal',
    description: 'Универсальный бизнес',
    active: true,
  },
  {
    id: 'dental',
    name: 'Dental',
    description: 'Стоматология',
    active: true,
  },
  {
    id: 'costume_rental',
    name: 'Costume Rental',
    description: 'Прокат костюмов',
    active: true,
  },
  {
    id: 'kindergarten',
    name: 'Kindergarten',
    description: 'Детский сад',
    active: true,
  },
  {
    id: 'auto_service',
    name: 'Auto Service',
    description: 'Автосервис',
    active: true,
  },
]

export const DEFAULT_BUSINESS_TEMPLATES: readonly CatalogTemplate[] = [
  {
    id: 'template-universal',
    businessTypeId: UNIVERSAL_BUSINESS_TYPE_ID,
    name: 'Universal',
    description: 'CRM, продажи, склад, расходы и аналитика',
    moduleIds: onlyRegistered(CORE_MODULES),
    active: true,
  },
  {
    id: 'template-dental',
    businessTypeId: 'dental',
    name: 'Dental',
    description: 'Рекомендуется CRM, продажи, склад, расходы, аналитика и пакеты имплантации',
    moduleIds: onlyRegistered([...CORE_MODULES, 'packages']),
    active: true,
  },
  {
    id: 'template-costume-rental',
    businessTypeId: 'costume_rental',
    name: 'Costume Rental',
    description: 'CRM, прокат, склад, расходы и аналитика',
    moduleIds: onlyRegistered(['crm', 'warehouse', 'expenses', 'analytics', 'attendance', 'rental']),
    active: true,
  },
  {
    id: 'template-kindergarten',
    businessTypeId: 'kindergarten',
    name: 'Kindergarten',
    description: 'Дети, посещаемость, CRM, расходы и аналитика',
    moduleIds: onlyRegistered(['crm', 'expenses', 'analytics', 'children', 'attendance']),
    active: true,
  },
  {
    id: 'template-auto-service',
    businessTypeId: 'auto_service',
    name: 'Auto Service',
    description: 'CRM, продажи, склад, расходы и аналитика',
    moduleIds: onlyRegistered(CORE_MODULES),
    active: true,
  },
]

export const BUSINESS_CATALOG_ORGANIZATION_ID = PLATFORM_ORGANIZATION_ID
