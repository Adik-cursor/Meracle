export const PLATFORM_MODULE_KEYS = [
  'crm',
  'sales',
  'warehouse',
  'expenses',
  'analytics',
  'rental',
  'children',
  'attendance',
  'plans',
  'packages',
] as const

export type PlatformModuleKey = (typeof PLATFORM_MODULE_KEYS)[number]

export type OrganizationModuleStatus = 'enabled' | 'disabled'

export function isPlatformModuleKey(value: string): value is PlatformModuleKey {
  return (PLATFORM_MODULE_KEYS as readonly string[]).includes(value)
}
