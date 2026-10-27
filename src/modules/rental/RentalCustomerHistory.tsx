import { useLocalization } from '../../app/context/localization-context'
import { useOrganization } from '../../app/context/organization-context'
import { useRental } from '../../app/context/rental-context'
import { useAppPath } from '../../app/routes/useAppPath'
import type { Id } from '../../core/types'

type RentalCustomerHistoryProps = {
  customerId: Id
}

export function RentalCustomerHistory({ customerId }: RentalCustomerHistoryProps) {
  const { t } = useLocalization()
  const { modules } = useOrganization()
  const { bookings } = useRental()
  const { navigate } = useAppPath()

  if (!modules.rental) {
    return null
  }

  const rows = bookings.filter((booking) => booking.customerId === customerId)
  const active = rows.filter(
    (booking) => booking.status === 'issued' || booking.viewStatus === 'overdue',
  )
  const completed = rows.filter((booking) => booking.status === 'returned')
  const due = rows
    .filter((booking) => booking.status !== 'cancelled')
    .reduce(
      (sum, booking) =>
        sum + Math.max(0, booking.total - booking.paidAmount),
      0,
    )
  const total = rows
    .filter((booking) => booking.status !== 'cancelled')
    .reduce((sum, booking) => sum + booking.total, 0)
  const problems = completed.filter(
    (booking) => booking.returnCondition && booking.returnCondition !== 'ok',
  )

  return (
    <section className="settings-section">
      <h3>{t('rentalHistory')}</h3>
      {rows.length === 0 ? (
        <p className="workspace-muted">{t('rentalHistoryEmpty')}</p>
      ) : (
        <>
          <p className="workspace-muted">
            {t('rentalInUse')}: {active.length} · {t('rentalReturned')}: {completed.length}{' '}
            · {t('rentalTotal')}: {total} · {t('rentalDue')}: {due} ·{' '}
            {t('rentalProblemReturns')}: {problems.length}
          </p>
          <ul className="rental-reminder-list">
            {rows.map((booking) => (
              <li key={booking.id}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => navigate(`/rental/bookings/${booking.id}`)}
                >
                  {booking.viewStatus} · {booking.startAt.slice(0, 16)} · {booking.total}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
