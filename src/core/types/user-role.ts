export type UserRole =
  | 'owner'
  | 'commercial_director'
  | 'branch_director'
  | 'sales_manager'
  | 'sales_employee'
  | 'warehouse_manager'
  | 'office_employee'
  | 'accountant'
  | 'kindergarten_admin'

export const USER_ROLES: readonly UserRole[] = [
  'owner',
  'commercial_director',
  'branch_director',
  'sales_manager',
  'sales_employee',
  'warehouse_manager',
  'office_employee',
  'accountant',
  'kindergarten_admin',
]
