import { RoleAccessPanel } from './RoleAccessPanel'
import type { UserRole } from '../../core/types'
import { useLocalization } from '../../app/context/localization-context'

type RolePermissionPreviewProps = {
  role: UserRole
}

export function RolePermissionPreview({ role }: RolePermissionPreviewProps) {
  const { t } = useLocalization()

  return (
    <div className="settings-section">
      <h3>{t('basePermissionsRole')}</h3>
      <RoleAccessPanel role={role} compact />
    </div>
  )
}
