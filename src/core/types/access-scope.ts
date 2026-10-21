import type { UserRole } from './user-role'

export type AccessScope =
  | 'own'
  | 'department'
  | 'branch'
  | 'warehouse'
  | 'organization'

export const ROLE_ACCESS_SCOPE: Record<UserRole, AccessScope> = {
  sales_employee: 'own',
  sales_manager: 'department',
  branch_director: 'branch',
  warehouse_manager: 'warehouse',
  commercial_director: 'organization',
  owner: 'organization',
  office_employee: 'own',
  accountant: 'organization',
  kindergarten_admin: 'organization',
}

export function getAccessScope(role: UserRole): AccessScope {
  return ROLE_ACCESS_SCOPE[role]
}
