import type { UserRole } from './user-role'

export type CarePermission =
  | 'children.read'
  | 'children.manage'
  | 'attendance.read'
  | 'attendance.manage'
  | 'attendance.self'

const ALL_CARE_PERMISSIONS: readonly CarePermission[] = [
  'children.read',
  'children.manage',
  'attendance.read',
  'attendance.manage',
  'attendance.self',
]

const READ_CARE_PERMISSIONS: readonly CarePermission[] = [
  'children.read',
  'attendance.read',
  'attendance.self',
]

const TEACHER_PERMISSIONS: readonly CarePermission[] = [
  'children.read',
  'attendance.read',
  'attendance.manage',
  'attendance.self',
]

export const ROLE_CARE_PERMISSIONS: Record<UserRole, readonly CarePermission[]> = {
  owner: ALL_CARE_PERMISSIONS,
  commercial_director: ALL_CARE_PERMISSIONS,
  branch_director: ALL_CARE_PERMISSIONS,
  kindergarten_admin: ALL_CARE_PERMISSIONS,
  office_employee: ALL_CARE_PERMISSIONS,
  sales_manager: READ_CARE_PERMISSIONS,
  sales_employee: TEACHER_PERMISSIONS,
  accountant: READ_CARE_PERMISSIONS,
  warehouse_manager: ['attendance.read', 'attendance.self'],
}

export function getCarePermissions(role: UserRole): readonly CarePermission[] {
  return ROLE_CARE_PERMISSIONS[role]
}

export function hasCarePermission(role: UserRole, permission: CarePermission): boolean {
  return ROLE_CARE_PERMISSIONS[role].includes(permission)
}
