import { useMemo, useState } from 'react'
import type { User } from '../../core/types'
import type { TranslationKey } from '../../core/localization/translations'
import { checkInSelfForUser, hasEffectiveCarePermission, isModuleEnabledForOrganization, isPlatformOwner } from '../../core/services'
import { todayExpenseDateInput } from '../../core/services/expenses'
import { useAuth } from '../context/auth-context'
import { useLocalization } from '../context/localization-context'
import { usePersistence, usePersistenceVersion } from '../context/persistence-context'
import { Button } from '../../shared/ui'
import { CameraPhotoCapture } from './CameraPhotoCapture'

function requiresShiftCheckIn(persistence: ReturnType<typeof usePersistence>, user: User): boolean {
  return (
    !isPlatformOwner(user) &&
    user.role !== 'owner' &&
    (hasEffectiveCarePermission(user, 'attendance.self') ||
      hasEffectiveCarePermission(user, 'attendance.manage')) &&
    isModuleEnabledForOrganization(persistence, user.organizationId, 'attendance')
  )
}

export function ShiftOpeningGate() {
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { currentUser, isAuthenticated } = useAuth()
  const { t } = useLocalization()
  const [photo, setPhoto] = useState<string | null>(null)
  const [error, setError] = useState<TranslationKey | null>(null)

  const shiftAlreadyOpen = useMemo(() => {
    void version
    if (!currentUser) return true
    const today = todayExpenseDateInput()
    return persistence.attendanceRecords
      .list(currentUser.organizationId)
      .some((record) => record.employeeId === currentUser.id && record.date === today &&
        Boolean(record.checkInPhoto))
  }, [currentUser, persistence, version])

  const mustOpenShift = Boolean(
    isAuthenticated && currentUser && requiresShiftCheckIn(persistence, currentUser) && !shiftAlreadyOpen,
  )

  if (!mustOpenShift || !currentUser) return null

  const openShift = () => {
    if (!photo) return
    const result = checkInSelfForUser(persistence, currentUser, photo)
    if (!result.ok && result.error.code !== 'ALREADY_CHECKED_IN') {
      setError('loginShiftOpenFailed')
    }
  }

  return (
    <div className="modal-backdrop shift-opening-gate" role="presentation">
      <section className="modal shift-opening-gate__dialog" role="dialog" aria-modal="true" aria-labelledby="shift-opening-title">
        <h2 className="modal__title" id="shift-opening-title">{t('openShift')}</h2>
        <p className="workspace-muted">{t('shiftCameraInstruction')}</p>
        <CameraPhotoCapture photo={photo} onChange={setPhoto} />
        {error ? <p className="shift-opening-gate__error" role="alert">{t(error)}</p> : null}
        <div className="shift-opening-gate__actions">
          <Button variant="primary" disabled={!photo} onClick={openShift}>{t('openShift')}</Button>
        </div>
      </section>
    </div>
  )
}
