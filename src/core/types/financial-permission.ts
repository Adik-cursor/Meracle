import type { UserRole } from './user-role'
import { getAccessScope, type AccessScope } from './access-scope'

export type FinancialPermissionGroup =
  | 'SALES'
  | 'PAYMENTS'
  | 'RETURNS'
  | 'REFUNDS'
  | 'ANALYTICS'
  | 'ADMINISTRATION'

export type FinancialPermission =
  | 'sales.read'
  | 'sales.read_amount'
  | 'sales.create'
  | 'sales.update'
  | 'sales.confirm'
  | 'sales.complete'
  | 'sales.documents.create'
  | 'payments.read'
  | 'payments.create'
  | 'payments.cancel'
  | 'returns.read'
  | 'returns.create'
  | 'returns.complete'
  | 'refunds.read'
  | 'refunds.create'
  | 'refunds.cancel'
  | 'financial_analytics.read'
  | 'financial_documents.manage'
  | 'expenses.read'
  | 'expenses.create'

export const FINANCIAL_PERMISSION_GROUPS: Record<
  FinancialPermissionGroup,
  readonly FinancialPermission[]
> = {
  SALES: [
    'sales.read',
    'sales.read_amount',
    'sales.create',
    'sales.update',
    'sales.confirm',
    'sales.complete',
    'sales.documents.create',
  ],
  PAYMENTS: ['payments.read', 'payments.create', 'payments.cancel'],
  RETURNS: ['returns.read', 'returns.create', 'returns.complete'],
  REFUNDS: ['refunds.read', 'refunds.create', 'refunds.cancel'],
  ANALYTICS: ['financial_analytics.read', 'expenses.read', 'expenses.create'],
  ADMINISTRATION: ['financial_documents.manage'],
}

const ALL_FINANCIAL_PERMISSIONS: readonly FinancialPermission[] = [
  ...FINANCIAL_PERMISSION_GROUPS.SALES,
  ...FINANCIAL_PERMISSION_GROUPS.PAYMENTS,
  ...FINANCIAL_PERMISSION_GROUPS.RETURNS,
  ...FINANCIAL_PERMISSION_GROUPS.REFUNDS,
  ...FINANCIAL_PERMISSION_GROUPS.ANALYTICS,
  ...FINANCIAL_PERMISSION_GROUPS.ADMINISTRATION,
]

const SALES_EMPLOYEE_PERMISSIONS: readonly FinancialPermission[] = [
  'sales.read',
  'sales.read_amount',
  'sales.create',
  'sales.update',
  'sales.confirm',
  'sales.complete',
  'sales.documents.create',
  'payments.read',
  'payments.create',
  'returns.read',
]

const SALES_MANAGER_PERMISSIONS: readonly FinancialPermission[] = [
  ...SALES_EMPLOYEE_PERMISSIONS,
  'returns.create',
  'returns.complete',
  'refunds.read',
  'financial_analytics.read',
  'expenses.read',
]

const BRANCH_DIRECTOR_PERMISSIONS: readonly FinancialPermission[] = [
  ...SALES_MANAGER_PERMISSIONS,
  'payments.cancel',
  'refunds.create',
  'refunds.cancel',
  'financial_documents.manage',
  'expenses.create',
]

const OFFICE_EMPLOYEE_PERMISSIONS: readonly FinancialPermission[] = [
  'expenses.read',
  'expenses.create',
]

const ACCOUNTANT_PERMISSIONS: readonly FinancialPermission[] = [
  'sales.read',
  'sales.read_amount',
  'payments.read',
  'returns.read',
  'refunds.read',
  'financial_analytics.read',
  'expenses.read',
]

export const ROLE_FINANCIAL_PERMISSIONS: Record<
  UserRole,
  readonly FinancialPermission[]
> = {
  sales_employee: SALES_EMPLOYEE_PERMISSIONS,
  sales_manager: SALES_MANAGER_PERMISSIONS,
  branch_director: BRANCH_DIRECTOR_PERMISSIONS,
  commercial_director: ALL_FINANCIAL_PERMISSIONS,
  owner: ALL_FINANCIAL_PERMISSIONS,
  warehouse_manager: [],
  office_employee: OFFICE_EMPLOYEE_PERMISSIONS,
  accountant: ACCOUNTANT_PERMISSIONS,
  kindergarten_admin: [
    'expenses.read',
    'expenses.create',
    'payments.read',
    'payments.create',
    'financial_analytics.read',
  ],
}

export function getFinancialPermissions(
  role: UserRole,
): readonly FinancialPermission[] {
  return ROLE_FINANCIAL_PERMISSIONS[role]
}

export function hasFinancialPermission(
  role: UserRole,
  permission: FinancialPermission,
): boolean {
  return ROLE_FINANCIAL_PERMISSIONS[role].includes(permission)
}

export function getFinancialAccessScope(role: UserRole): AccessScope {
  return getAccessScope(role)
}
