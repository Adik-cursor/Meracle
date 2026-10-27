import type { BaseEntity, Id } from './common'
import type { PermissionOverride } from './permission-override'
import type { UserRole } from './user-role'

export type UserStatus = 'invited' | 'active' | 'disabled'

export type PlatformRole = 'platform_owner'

export type User = BaseEntity & {
  email: string
  firstName: string
  lastName: string
  /** Системный уровень платформы. Не является ролью организации. */
  platformRole?: PlatformRole
  /** Роль доступа. Не заменяет branchId/departmentId. */
  role: UserRole
  status: UserStatus
  phone?: string
  /** Employee portrait stored as a resized local data URL. */
  avatarUrl?: string
  jobTitle?: string
  /**
   * Пользователь с входом в Meracle CRM.
   * undefined/true — аккаунт есть (Dental/Rental и владельцы).
   * false — только запись сотрудника без login.
   */
  accountEnabled?: boolean
  /** Группа Kindergarten (CareGroup той же организации). Не Department. */
  careGroupId?: Id
  managerId?: Id
  lastLoginAt?: string
  /** Филиал той же организации. Обязателен для sales_employee, sales_manager, branch_director, warehouse_manager. */
  branchId?: Id
  /** Отдел той же организации и того же филиала. Обязателен для sales_employee и sales_manager. */
  departmentId?: Id
  /**
   * Рабочий / основной склад.
   * Для sales_employee и warehouse_manager обязателен и совпадает с access scope.
   * Для остальных ролей может существовать, но не ограничивает WarehouseAccess.
   */
  warehouseId?: Id
  permissionOverrides?: PermissionOverride[]
  /** Индивидуальный оклад. Не является бонусом и не создаёт зарплатную систему. */
  salaryAmount?: number
}
