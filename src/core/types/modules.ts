export type OrganizationModule =
  | 'crm'
  | 'contacts'
  | 'companies'
  | 'deals'
  | 'tasks'
  | 'activities'
  | 'warehouses'
  | 'reports'
  | 'sales'
  | 'expenses'
  | 'analytics'
  | 'rental'
  | 'children'
  | 'attendance'
  | 'plans'
  | 'packages'

export type OrganizationModules = Record<OrganizationModule, boolean>

export function isSalesModuleAvailable(modules: OrganizationModules): boolean {
  return modules.sales === true
}
