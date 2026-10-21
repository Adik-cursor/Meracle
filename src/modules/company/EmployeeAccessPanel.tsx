import type { User, UserRole } from '../../core/types'
import {
  canDelegateFinancialPermission,
  canDelegateWarehousePermission,
  canManageEmployees,
  hasEffectiveFinancialPermission,
  hasEffectiveWarehousePermission,
} from '../../core/services'
import { getFinancialPermissions as roleFinancial } from '../../core/types/financial-permission'
import { getWarehousePermissions as roleWarehouse } from '../../core/types/warehouse-permission'
import { useAccess } from '../../app/context/access-context'
import { useLocalization } from '../../app/context/localization-context'
import { getCarePermissions } from '../../core/types/care-permission'
import { useOrganization } from '../../app/context/organization-context'
import { useUsers, type UserDraft } from '../../app/context/user-context'
import { USER_ROLE_LABEL_KEY } from '../crm/users/user-role-label'
import { AccessGroupedCards, type AccessRow } from './AccessGroupedCards'
import { AccessScopeLegend } from './AccessScopeLegend'
import {
  capabilityField,
  capabilitiesForModules,
  careCapabilitiesForModules,
  getRoleFunctionFlags,
  type PermissionCapability,
} from './permission-ui'
import { assignableEmployeeRolesForModules } from '../../core/services'

type EmployeeAccessPanelProps = {
  user: User
}

function draftFromUser(user: User, role: UserRole): UserDraft {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role,
    status: user.status,
    phone: user.phone,
    jobTitle: user.jobTitle,
    accountEnabled: user.accountEnabled,
    careGroupId: user.careGroupId,
    managerId: user.managerId,
    branchId: user.branchId,
    departmentId: user.departmentId,
    warehouseId: user.warehouseId,
  }
}

export function EmployeeAccessPanel({ user }: EmployeeAccessPanelProps) {
  const { t } = useLocalization()
  const { currentUser } = useAccess()
  const { modules } = useOrganization()
  const { setPermissionOverride, removePermissionOverride, updateUser } = useUsers()
  const baseFinancial = roleFinancial(user.role)
  const baseWarehouse = roleWarehouse(user.role)
  const canEdit =
    Boolean(currentUser) &&
    canManageEmployees(currentUser) &&
    currentUser?.id !== user.id
  const capabilities = capabilitiesForModules(modules)
  const careCapabilities = careCapabilitiesForModules(modules)
  const assignableRoles = assignableEmployeeRolesForModules(currentUser, modules, user.role)
  const roleOptions = assignableRoles.includes(user.role)
    ? assignableRoles
    : [user.role, ...assignableRoles]

  const isBase = (capability: PermissionCapability) =>
    capability.domain === 'financial'
      ? baseFinancial.includes(capability.permission)
      : baseWarehouse.includes(capability.permission)

  const isEffective = (capability: PermissionCapability) =>
    capability.domain === 'financial'
      ? hasEffectiveFinancialPermission(user, capability.permission)
      : hasEffectiveWarehousePermission(user, capability.permission)

  const canDelegate = (capability: PermissionCapability) => {
    if (!currentUser) {
      return false
    }
    return capability.domain === 'financial'
      ? canDelegateFinancialPermission(currentUser, capability.permission)
      : canDelegateWarehousePermission(currentUser, capability.permission)
  }

  const overrideHint = (capability: PermissionCapability) => {
    const override = (user.permissionOverrides ?? []).find(
      (item) =>
        item.domain === capability.domain && item.permission === capability.permission,
    )
    if (!override) {
      return t('accessLogBase')
    }
    return override.effect === 'allow'
      ? t('accessOverrideAllowHint')
      : t('accessOverrideDenyHint')
  }

  const applyToggle = (capability: PermissionCapability, nextOn: boolean) => {
    if (capability.dangerous && !window.confirm(t('accessConfirmDanger'))) {
      return
    }

    if (nextOn) {
      if (isBase(capability)) {
        removePermissionOverride(user.id, capability.domain, capability.permission)
        return
      }
      setPermissionOverride(user.id, capability.domain, capability.permission, 'allow')
      return
    }

    if (isBase(capability)) {
      setPermissionOverride(user.id, capability.domain, capability.permission, 'deny')
      return
    }

    removePermissionOverride(user.id, capability.domain, capability.permission)
  }

  const applyRole = (nextRole: UserRole) => {
    if (nextRole === user.role) {
      return
    }
    if (!window.confirm(t('accessConfirmRoleChange'))) {
      return
    }
    updateUser(user.id, draftFromUser(user, nextRole))
  }

  const baseRows: AccessRow[] = [
    ...capabilities.map((capability) => ({
      id: capabilityField(capability),
      group: capability.group,
      label: t(capability.labelKey),
      description: t('accessLogBase'),
      on: isBase(capability),
      disabled: true,
    })),
    ...careCapabilities.map((capability) => ({
      id: `care:${capability.permission}`,
      group: capability.group,
      label: t(capability.labelKey),
      description: t('accessLogBase'),
      on: getCarePermissions(user.role).includes(capability.permission),
      disabled: true,
    })),
    ...getRoleFunctionFlags(user.role).map((flag) => ({
      id: flag.id,
      group: flag.group,
      label: t(flag.labelKey),
      on: flag.enabled,
      disabled: true,
    })),
  ]

  const additionalRows: AccessRow[] = capabilities.filter((capability) => {
    const override = (user.permissionOverrides ?? []).some(
      (item) =>
        item.domain === capability.domain && item.permission === capability.permission,
    )
    return override || canDelegate(capability)
  }).map((capability) => {
    const delegatable = canDelegate(capability)
    return {
      id: capabilityField(capability),
      group: capability.group,
      label: t(capability.labelKey),
      description: overrideHint(capability),
      on: isEffective(capability),
      disabled: !canEdit || !delegatable,
      onToggle:
        canEdit && delegatable
          ? (next: boolean) => applyToggle(capability, next)
          : undefined,
    }
  })

  const effectiveRows: AccessRow[] = [
    ...capabilities.map((capability) => ({
      id: capabilityField(capability),
      group: capability.group,
      label: t(capability.labelKey),
      on: isEffective(capability),
      mark: isEffective(capability) ? ('on' as const) : ('off' as const),
    })),
    ...careCapabilities.map((capability) => ({
      id: `eff-care:${capability.permission}`,
      group: capability.group,
      label: t(capability.labelKey),
      on: getCarePermissions(user.role).includes(capability.permission),
      mark: getCarePermissions(user.role).includes(capability.permission)
        ? ('on' as const)
        : ('off' as const),
    })),
    ...getRoleFunctionFlags(user.role).map((flag) => ({
      id: `eff-${flag.id}`,
      group: flag.group,
      label: t(flag.labelKey),
      on: flag.enabled,
      mark: flag.enabled ? ('on' as const) : ('off' as const),
    })),
  ]

  return (
    <div className="access-panel">
      <label className="field">
        <span>{t('userRole')}</span>
        <select
          className="warehouse-input"
          value={user.role}
          disabled={!canEdit}
          onChange={(event) => applyRole(event.target.value as UserRole)}
        >
          {roleOptions.map((item) => (
            <option key={item} value={item} disabled={!assignableRoles.includes(item)}>
              {t(USER_ROLE_LABEL_KEY[item])}
            </option>
          ))}
        </select>
      </label>

      <h3>{t('basePermissionsRole')}</h3>
      <p className="access-hint">{t('accessBaseReadonlyHint')}</p>
      <AccessScopeLegend role={user.role} />
      <AccessGroupedCards rows={baseRows} />

      <h3>{t('individualPermissions')}</h3>
      <p className="access-hint">{t('accessAdditionalHint')}</p>
      {additionalRows.length === 0 ? <p>—</p> : <AccessGroupedCards rows={additionalRows} />}

      <h3>{t('effectivePermissions')}</h3>
      <AccessGroupedCards rows={effectiveRows} mode="marks" compact />
    </div>
  )
}
