import { useMemo } from 'react'
import type { User } from '../../../core/types'
import { listAttendanceForEmployeeForUser } from '../../../core/services'
import { useAccess } from '../../../app/context/access-context'
import { useLocalization } from '../../../app/context/localization-context'
import { useOrganization } from '../../../app/context/organization-context'
import { usePersistence, usePersistenceVersion } from '../../../app/context/persistence-context'

type EmployeeAttendancePanelProps = {
  user: User
}

export function EmployeeAttendancePanel({ user }: EmployeeAttendancePanelProps) {
  const { t, locale } = useLocalization()
  const { modules } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'
  const records = useMemo(() => {
    void version
    if (modules.attendance !== true) {
      return []
    }
    const listed = listAttendanceForEmployeeForUser(persistence, currentUser, user.id)
    return listed.ok ? listed.value : []
  }, [currentUser, modules.attendance, persistence, user.id, version])

  if (modules.attendance !== true) {
    return <p className="workspace-muted">{t('MODULE_NOT_ENABLED')}</p>
  }

  if (records.length === 0) {
    return (
      <div className="settings-section">
        <h3>{t('employeeTabAttendance')}</h3>
        <p className="workspace-muted">—</p>
      </div>
    )
  }

  return (
    <div className="settings-section">
      <h3>{t('employeeTabAttendance')}</h3>
      <table className="compensation-history">
        <tbody>
          {records.slice(0, 40).map((record) => (
            <tr key={record.id}>
              <td>{new Date(`${record.date}T00:00:00`).toLocaleDateString(numberLocale)}</td>
              <td>{record.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
