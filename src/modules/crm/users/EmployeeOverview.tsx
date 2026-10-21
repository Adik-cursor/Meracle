import type { User } from '../../../core/types'
import { useLocalization } from '../../../app/context/localization-context'
import { EmployeeIdentitySummary } from './EmployeeIdentitySummary'

type EmployeeOverviewProps = {
  user: User
}

export function EmployeeOverview({ user }: EmployeeOverviewProps) {
  const { t } = useLocalization()

  return (
    <div className="settings-section">
      <h3>{t('employeeTabProfile')}</h3>
      <EmployeeIdentitySummary user={user} />
    </div>
  )
}
