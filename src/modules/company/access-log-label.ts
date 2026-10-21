import type { TranslationKey } from '../../core/localization/translations'
import { USER_ROLES, type UserRole, type UserStatus } from '../../core/types'
import { USER_ROLE_LABEL_KEY } from '../crm/users/user-role-label'
import { USER_STATUS_LABEL_KEY } from '../crm/users/employee-status-label'
import { findCapabilityByField } from './permission-ui'

const STRUCTURE_FIELD_KEY: Record<string, TranslationKey> = {
  role: 'userRole',
  branchId: 'navBranches',
  departmentId: 'navDepartments',
  warehouseId: 'navWarehouses',
  status: 'status',
  permissionOverrides: 'individualPermissions',
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  phone: 'phone',
  jobTitle: 'employeeJobTitle',
  managerId: 'employeeManager',
}

function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole)
}

function isUserStatus(value: string): value is UserStatus {
  return value === 'active' || value === 'invited' || value === 'disabled'
}

export function accessLogFieldKey(field: string): TranslationKey | undefined {
  return findCapabilityByField(field)?.labelKey
}

export function accessLogEffectKey(
  value: string,
): 'accessLogAllow' | 'accessLogDeny' | 'accessLogBase' | undefined {
  if (value === 'allow') {
    return 'accessLogAllow'
  }
  if (value === 'deny') {
    return 'accessLogDeny'
  }
  if (value === 'base') {
    return 'accessLogBase'
  }
  return undefined
}

export function accessLogFieldDisplay(
  field: string,
  t: (key: TranslationKey) => string,
): string {
  const permissionKey = accessLogFieldKey(field)
  if (permissionKey) {
    return t(permissionKey)
  }

  const structureKey = STRUCTURE_FIELD_KEY[field]
  if (structureKey) {
    return t(structureKey)
  }

  return t('employeeTabActivity')
}

export function accessLogValueDisplay(
  value: string,
  t: (key: TranslationKey) => string,
  resolveId?: (id: string) => string | undefined,
): string {
  if (!value) {
    return '—'
  }

  const effectKey = accessLogEffectKey(value)
  if (effectKey) {
    return t(effectKey)
  }

  if (isUserStatus(value)) {
    return t(USER_STATUS_LABEL_KEY[value])
  }

  if (isUserRole(value)) {
    return t(USER_ROLE_LABEL_KEY[value])
  }

  const resolved = resolveId?.(value)
  if (resolved) {
    return resolved
  }

  if (value.includes('.')) {
    const permissionKey = accessLogFieldKey(value)
    return permissionKey ? t(permissionKey) : t('accessLogBase')
  }

  return value
}
