import type { FinancialPermission, UserRole, WarehousePermission } from '../../core/types'
import { getAccessScope } from '../../core/types/access-scope'
import { getFinancialPermissions } from '../../core/types/financial-permission'
import { getWarehousePermissions } from '../../core/types/warehouse-permission'
import type { TranslationKey } from '../../core/localization/translations'
import type { ModuleAccessFlags } from '../../core/services/module-access'
import { permissionGroupEnabled } from '../../core/services/module-access'

export type AccessUiGroup =
  | 'sales'
  | 'payments'
  | 'returns'
  | 'refunds'
  | 'warehouse'
  | 'analytics'
  | 'employees'
  | 'company'
  | 'children'
  | 'attendance'

type CapabilityBase = {
  group: AccessUiGroup
  labelKey: TranslationKey
  dangerous?: boolean
}

export type PermissionCapability =
  | (CapabilityBase & { domain: 'financial'; permission: FinancialPermission })
  | (CapabilityBase & { domain: 'warehouse'; permission: WarehousePermission })

export const ACCESS_GROUP_LABEL: Record<AccessUiGroup, TranslationKey> = {
  sales: 'accessGroupSales',
  payments: 'accessGroupPayments',
  returns: 'accessGroupReturns',
  refunds: 'accessGroupRefunds',
  warehouse: 'accessGroupWarehouse',
  analytics: 'accessGroupAnalytics',
  employees: 'accessGroupEmployees',
  company: 'accessGroupCompany',
  children: 'navChildren',
  attendance: 'navAttendance',
}

export const ACCESS_GROUP_ORDER: readonly AccessUiGroup[] = [
  'children',
  'attendance',
  'sales',
  'payments',
  'returns',
  'refunds',
  'warehouse',
  'analytics',
  'employees',
  'company',
]

export const PERMISSION_CAPABILITIES: readonly PermissionCapability[] = [
  { domain: 'financial', permission: 'sales.read', group: 'sales', labelKey: 'permSalesRead' },
  {
    domain: 'financial',
    permission: 'sales.read_amount',
    group: 'sales',
    labelKey: 'permSalesReadAmount',
  },
  { domain: 'financial', permission: 'sales.create', group: 'sales', labelKey: 'permSalesCreate' },
  { domain: 'financial', permission: 'sales.update', group: 'sales', labelKey: 'permSalesUpdate' },
  { domain: 'financial', permission: 'sales.confirm', group: 'sales', labelKey: 'permSalesConfirm' },
  {
    domain: 'financial',
    permission: 'sales.complete',
    group: 'sales',
    labelKey: 'permSalesComplete',
  },
  {
    domain: 'financial',
    permission: 'sales.documents.create',
    group: 'sales',
    labelKey: 'permSalesDocumentsCreate',
  },
  {
    domain: 'financial',
    permission: 'payments.read',
    group: 'payments',
    labelKey: 'permPaymentsRead',
  },
  {
    domain: 'financial',
    permission: 'payments.create',
    group: 'payments',
    labelKey: 'permPaymentsCreate',
  },
  {
    domain: 'financial',
    permission: 'payments.cancel',
    group: 'payments',
    labelKey: 'permPaymentsCancel',
    dangerous: true,
  },
  {
    domain: 'financial',
    permission: 'returns.read',
    group: 'returns',
    labelKey: 'permReturnsRead',
  },
  {
    domain: 'financial',
    permission: 'returns.create',
    group: 'returns',
    labelKey: 'permReturnsCreate',
  },
  {
    domain: 'financial',
    permission: 'returns.complete',
    group: 'returns',
    labelKey: 'permReturnsComplete',
  },
  {
    domain: 'financial',
    permission: 'refunds.read',
    group: 'refunds',
    labelKey: 'permRefundsRead',
  },
  {
    domain: 'financial',
    permission: 'refunds.create',
    group: 'refunds',
    labelKey: 'permRefundsCreate',
    dangerous: true,
  },
  {
    domain: 'financial',
    permission: 'refunds.cancel',
    group: 'refunds',
    labelKey: 'permRefundsCancel',
    dangerous: true,
  },
  {
    domain: 'financial',
    permission: 'financial_analytics.read',
    group: 'analytics',
    labelKey: 'permAnalyticsRead',
  },
  {
    domain: 'financial',
    permission: 'expenses.read',
    group: 'analytics',
    labelKey: 'permExpensesRead',
  },
  {
    domain: 'financial',
    permission: 'expenses.create',
    group: 'analytics',
    labelKey: 'permExpensesCreate',
  },
  {
    domain: 'financial',
    permission: 'financial_documents.manage',
    group: 'company',
    labelKey: 'permFinancialDocuments',
    dangerous: true,
  },
  {
    domain: 'warehouse',
    permission: 'products.read',
    group: 'warehouse',
    labelKey: 'permProductsRead',
  },
  {
    domain: 'warehouse',
    permission: 'inventory.read',
    group: 'warehouse',
    labelKey: 'permWarehouseRead',
  },
  {
    domain: 'warehouse',
    permission: 'inventory.adjust',
    group: 'warehouse',
    labelKey: 'permInventoryAdjust',
    dangerous: true,
  },
  {
    domain: 'warehouse',
    permission: 'movements.read',
    group: 'warehouse',
    labelKey: 'permMovementsRead',
  },
  {
    domain: 'warehouse',
    permission: 'receipt.create',
    group: 'warehouse',
    labelKey: 'permReceiptCreate',
  },
  {
    domain: 'warehouse',
    permission: 'receipt.complete',
    group: 'warehouse',
    labelKey: 'permReceiptComplete',
  },
  {
    domain: 'warehouse',
    permission: 'transfer.create',
    group: 'warehouse',
    labelKey: 'permTransferCreate',
  },
  {
    domain: 'warehouse',
    permission: 'transfer.complete',
    group: 'warehouse',
    labelKey: 'permTransferComplete',
  },
  {
    domain: 'warehouse',
    permission: 'writeoff.create',
    group: 'warehouse',
    labelKey: 'permWriteoffCreate',
    dangerous: true,
  },
  {
    domain: 'warehouse',
    permission: 'writeoff.complete',
    group: 'warehouse',
    labelKey: 'permWriteoffComplete',
    dangerous: true,
  },
  {
    domain: 'warehouse',
    permission: 'audit.create',
    group: 'warehouse',
    labelKey: 'permAuditCreate',
  },
  {
    domain: 'warehouse',
    permission: 'audit.complete',
    group: 'warehouse',
    labelKey: 'permAuditComplete',
  },
  {
    domain: 'warehouse',
    permission: 'sales.create',
    group: 'warehouse',
    labelKey: 'permWarehouseSaleCreate',
  },
  {
    domain: 'warehouse',
    permission: 'sales.complete',
    group: 'warehouse',
    labelKey: 'permWarehouseSaleComplete',
  },
  {
    domain: 'warehouse',
    permission: 'returns.create',
    group: 'warehouse',
    labelKey: 'permWarehouseReturnCreate',
  },
  {
    domain: 'warehouse',
    permission: 'returns.complete',
    group: 'warehouse',
    labelKey: 'permWarehouseReturnComplete',
  },
  {
    domain: 'warehouse',
    permission: 'payments.read',
    group: 'warehouse',
    labelKey: 'permWarehousePaymentsRead',
  },
  {
    domain: 'warehouse',
    permission: 'analytics.read',
    group: 'analytics',
    labelKey: 'permWarehouseAnalytics',
  },
  {
    domain: 'warehouse',
    permission: 'warehouses.manage',
    group: 'company',
    labelKey: 'permWarehousesManage',
    dangerous: true,
  },
]

export const CARE_PERMISSION_CAPABILITIES: readonly {
  group: AccessUiGroup
  permission: 'children.read' | 'children.manage' | 'attendance.read' | 'attendance.manage' | 'attendance.self'
  labelKey: TranslationKey
}[] = [
  { group: 'children', permission: 'children.read', labelKey: 'permChildrenRead' },
  { group: 'children', permission: 'children.manage', labelKey: 'permChildrenManage' },
  { group: 'attendance', permission: 'attendance.read', labelKey: 'permAttendanceRead' },
  { group: 'attendance', permission: 'attendance.manage', labelKey: 'permAttendanceManage' },
  { group: 'attendance', permission: 'attendance.self', labelKey: 'permAttendanceSelf' },
]

export type RoleFunctionFlag = {
  id: string
  group: AccessUiGroup
  labelKey: TranslationKey
  enabled: boolean
}

export function getRoleFunctionFlags(role: UserRole): readonly RoleFunctionFlag[] {
  const canReadEmployees =
    role !== 'sales_employee' &&
    role !== 'warehouse_manager' &&
    role !== 'office_employee'
  const canManageEmployees =
    role === 'owner' ||
    role === 'commercial_director' ||
    role === 'branch_director' ||
    role === 'kindergarten_admin'
  const branchCompany = canManageEmployees

  return [
    {
      id: 'employees.read',
      group: 'employees',
      labelKey: 'permEmployeesRead',
      enabled: canReadEmployees,
    },
    {
      id: 'employees.manage',
      group: 'employees',
      labelKey: 'permEmployeesManage',
      enabled: canManageEmployees,
    },
    {
      id: 'branches.manage',
      group: 'company',
      labelKey: 'permBranchesManage',
      enabled: branchCompany,
    },
    {
      id: 'departments.manage',
      group: 'company',
      labelKey: 'permDepartmentsManage',
      enabled: branchCompany,
    },
    {
      id: 'access.manage',
      group: 'company',
      labelKey: 'permAccessManage',
      enabled: canManageEmployees,
    },
  ]
}

export type ScopeFlagId =
  | 'own'
  | 'branch'
  | 'department'
  | 'organization'
  | 'warehouse'

export type ScopeFlag = {
  id: ScopeFlagId
  labelKey: TranslationKey
  included: boolean
}

export function capabilitiesForModules(
  modules: ModuleAccessFlags,
): readonly PermissionCapability[] {
  return PERMISSION_CAPABILITIES.filter((capability) => {
    if (
      capability.domain === 'warehouse' &&
      (capability.permission === 'sales.create' ||
        capability.permission === 'sales.complete' ||
        capability.permission === 'returns.create' ||
        capability.permission === 'returns.complete')
    ) {
      return modules.warehouses === true && modules.sales === true
    }
    if (capability.permission === 'financial_analytics.read') {
      return modules.analytics === true
    }
    if (capability.permission === 'expenses.read' || capability.permission === 'expenses.create') {
      return modules.expenses === true || modules.children === true
    }
    return permissionGroupEnabled(capability.group, modules)
  })
}

export function careCapabilitiesForModules(modules: ModuleAccessFlags) {
  return CARE_PERMISSION_CAPABILITIES.filter((item) =>
    permissionGroupEnabled(item.group, modules),
  )
}

export function getRoleScopeFlags(
  role: UserRole,
  modules: ModuleAccessFlags = {},
): readonly ScopeFlag[] {
  const scope = getAccessScope(role)
  const organization = scope === 'organization'
  const showWarehouse = modules.warehouses === true
  const showSalesStructure = modules.sales === true
  const showBranch = showSalesStructure || showWarehouse
  const branch =
    showBranch &&
    (organization ||
      scope === 'branch' ||
      scope === 'department' ||
      role === 'sales_employee')
  const department =
    showSalesStructure && (organization || scope === 'branch' || scope === 'department')
  const warehouse = showWarehouse && (organization || scope === 'warehouse')

  return [
    {
      id: 'own',
      labelKey: showSalesStructure ? 'accessScopeOwn' : 'accessScopeOwnData',
      included: true,
    },
    { id: 'branch', labelKey: 'accessScopeBranch', included: Boolean(branch) },
    { id: 'department', labelKey: 'accessScopeDepartment', included: Boolean(department) },
    { id: 'organization', labelKey: 'accessScopeOrganization', included: organization },
    { id: 'warehouse', labelKey: 'accessScopeWarehouse', included: Boolean(warehouse) },
  ]
}

export function isBaseFinancialPermission(
  role: UserRole,
  permission: FinancialPermission,
): boolean {
  return getFinancialPermissions(role).includes(permission)
}

export function isBaseWarehousePermission(
  role: UserRole,
  permission: WarehousePermission,
): boolean {
  return getWarehousePermissions(role).includes(permission)
}

export function capabilityField(capability: PermissionCapability): string {
  return `${capability.domain}:${capability.permission}`
}

export function findCapabilityByField(field: string): PermissionCapability | undefined {
  return PERMISSION_CAPABILITIES.find((item) => capabilityField(item) === field)
}
