import type { UserRole } from './user-role'
import { getAccessScope, type AccessScope } from './access-scope'

export type WarehousePermissionGroup =
  | 'CATALOG'
  | 'INVENTORY'
  | 'OPERATIONS'
  | 'SALES'
  | 'RETURNS'
  | 'ANALYTICS'
  | 'ADMINISTRATION'

export type WarehousePermission =
  | 'products.read'
  | 'products.manage'
  | 'inventory.read'
  | 'inventory.adjust'
  | 'movements.read'
  | 'receipt.create'
  | 'receipt.complete'
  | 'writeoff.create'
  | 'writeoff.complete'
  | 'audit.create'
  | 'audit.complete'
  | 'transfer.create'
  | 'transfer.complete'
  | 'sales.create'
  | 'sales.complete'
  | 'returns.create'
  | 'returns.complete'
  | 'payments.read'
  | 'analytics.read'
  | 'warehouses.manage'

export const WAREHOUSE_PERMISSION_GROUPS: Record<
  WarehousePermissionGroup,
  readonly WarehousePermission[]
> = {
  CATALOG: ['products.read', 'products.manage'],
  INVENTORY: ['inventory.read', 'inventory.adjust'],
  OPERATIONS: [
    'movements.read',
    'receipt.create',
    'receipt.complete',
    'writeoff.create',
    'writeoff.complete',
    'audit.create',
    'audit.complete',
    'transfer.create',
    'transfer.complete',
  ],
  SALES: ['sales.create', 'sales.complete', 'payments.read'],
  RETURNS: ['returns.create', 'returns.complete'],
  ANALYTICS: ['analytics.read'],
  ADMINISTRATION: ['warehouses.manage'],
}

const OWNER_PERMISSIONS: readonly WarehousePermission[] = [
  ...WAREHOUSE_PERMISSION_GROUPS.CATALOG,
  ...WAREHOUSE_PERMISSION_GROUPS.INVENTORY,
  ...WAREHOUSE_PERMISSION_GROUPS.OPERATIONS,
  ...WAREHOUSE_PERMISSION_GROUPS.SALES,
  ...WAREHOUSE_PERMISSION_GROUPS.RETURNS,
  ...WAREHOUSE_PERMISSION_GROUPS.ANALYTICS,
  ...WAREHOUSE_PERMISSION_GROUPS.ADMINISTRATION,
]

const COMMERCIAL_DIRECTOR_PERMISSIONS: readonly WarehousePermission[] = [
  'products.read',
  'products.manage',
  'inventory.read',
  'movements.read',
  'sales.create',
  'sales.complete',
  'returns.create',
  'returns.complete',
  'payments.read',
  'analytics.read',
  'warehouses.manage',
]

const BRANCH_DIRECTOR_PERMISSIONS: readonly WarehousePermission[] = [
  'products.read',
  'inventory.read',
  'inventory.adjust',
  'movements.read',
  'receipt.create',
  'receipt.complete',
  'writeoff.create',
  'writeoff.complete',
  'audit.create',
  'audit.complete',
  'transfer.create',
  'transfer.complete',
  'sales.create',
  'sales.complete',
  'returns.create',
  'returns.complete',
  'payments.read',
  'analytics.read',
]

const SALES_MANAGER_PERMISSIONS: readonly WarehousePermission[] = [
  'products.read',
  'inventory.read',
  'movements.read',
  'sales.create',
  'sales.complete',
  'returns.create',
  'returns.complete',
  'payments.read',
  'analytics.read',
]

const SALES_EMPLOYEE_PERMISSIONS: readonly WarehousePermission[] = [
  'products.read',
  'inventory.read',
  'movements.read',
  'sales.create',
  'sales.complete',
  'payments.read',
]

const WAREHOUSE_MANAGER_PERMISSIONS: readonly WarehousePermission[] = [
  'products.read',
  'products.manage',
  'inventory.read',
  'inventory.adjust',
  'movements.read',
  'receipt.create',
  'receipt.complete',
  'writeoff.create',
  'writeoff.complete',
  'audit.create',
  'audit.complete',
  'transfer.create',
  'transfer.complete',
]

export const ROLE_WAREHOUSE_PERMISSIONS: Record<
  UserRole,
  readonly WarehousePermission[]
> = {
  owner: OWNER_PERMISSIONS,
  commercial_director: COMMERCIAL_DIRECTOR_PERMISSIONS,
  branch_director: BRANCH_DIRECTOR_PERMISSIONS,
  sales_manager: SALES_MANAGER_PERMISSIONS,
  sales_employee: SALES_EMPLOYEE_PERMISSIONS,
  warehouse_manager: WAREHOUSE_MANAGER_PERMISSIONS,
  office_employee: [],
  accountant: ['products.read'],
  kindergarten_admin: [],
}

export function getWarehousePermissions(
  role: UserRole,
): readonly WarehousePermission[] {
  return ROLE_WAREHOUSE_PERMISSIONS[role]
}

export function hasWarehousePermission(
  role: UserRole,
  permission: WarehousePermission,
): boolean {
  return ROLE_WAREHOUSE_PERMISSIONS[role].includes(permission)
}

export function getWarehouseAccessScope(role: UserRole): AccessScope {
  return getAccessScope(role)
}
