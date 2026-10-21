import type { UserRole } from '../../core/types'
import { getCarePermissions } from '../../core/types/care-permission'
import { getFinancialPermissions } from '../../core/types/financial-permission'
import { getWarehousePermissions } from '../../core/types/warehouse-permission'
import { useLocalization } from '../../app/context/localization-context'
import { useOrganization } from '../../app/context/organization-context'
import { AccessGroupedCards, type AccessRow } from './AccessGroupedCards'
import { AccessScopeLegend } from './AccessScopeLegend'
import {
  getRoleFunctionFlags,
  capabilitiesForModules,
  careCapabilitiesForModules,
  capabilityField,
} from './permission-ui'

type RoleAccessPanelProps = {
  role: UserRole
  compact?: boolean
}

export function RoleAccessPanel({ role, compact = false }: RoleAccessPanelProps) {
  const { t } = useLocalization()
  const { modules } = useOrganization()
  const financial = getFinancialPermissions(role)
  const warehouse = getWarehousePermissions(role)
  const capabilities = capabilitiesForModules(modules)
  const careCapabilities = careCapabilitiesForModules(modules)

  const rows: AccessRow[] = [
    ...capabilities.map((capability) => {
      const on =
        capability.domain === 'financial'
          ? financial.includes(capability.permission)
          : warehouse.includes(capability.permission)
      return {
        id: capabilityField(capability),
        group: capability.group,
        label: t(capability.labelKey),
        on,
        disabled: true,
      }
    }),
    ...careCapabilities.map((capability) => ({
      id: `care:${capability.permission}`,
      group: capability.group,
      label: t(capability.labelKey),
      on: getCarePermissions(role).includes(capability.permission),
      disabled: true,
    })),
    ...getRoleFunctionFlags(role).map((flag) => ({
      id: flag.id,
      group: flag.group,
      label: t(flag.labelKey),
      on: flag.enabled,
      disabled: true,
    })),
  ]

  return (
    <div className={compact ? 'access-panel access-panel--compact' : 'access-panel'}>
      {!compact ? <p className="access-hint">{t('accessBaseReadonlyHint')}</p> : null}
      <AccessScopeLegend role={role} />
      <AccessGroupedCards rows={rows} />
    </div>
  )
}
