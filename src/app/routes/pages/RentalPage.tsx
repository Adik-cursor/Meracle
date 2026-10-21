import { useMemo, useState } from 'react'
import { listProductCategoriesForUser } from '../../../core/services'
import { useAccess } from '../../context/access-context'
import { useCompanies } from '../../context/company-context'
import { useContacts } from '../../context/contact-context'
import { useCustomers } from '../../context/customer-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { useProducts } from '../../context/product-context'
import { useRental } from '../../context/rental-context'
import { useAppPath } from '../useAppPath'
import { RentalBookingForm } from '../../../modules/rental/RentalBookingForm'
import { RentalCalendar } from '../../../modules/rental/RentalCalendar'
import {
  addDays,
  addMonths,
  dayKey,
  formatDateTime,
} from '../../../modules/rental/rental-datetime'
import { rentalStatusLabelKey } from '../../../modules/rental/rental-status'
import { getCustomerDisplayName } from '../../../modules/crm/customers/customer-name'
import { ProductImageThumb } from '../../../modules/inventory/components/ProductImageThumb'
import { formatMoney } from '../../../modules/sales/pos-format'
import {
  ActionRow,
  Button,
  EmptyState,
  FilterBar,
  KpiStrip,
  Modal,
  PageHeader,
  SectionTabs,
  StatusBadge,
} from '../../../shared/ui'
import type { RentalBookingRead } from '../../../core/services'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'

function rentalTone(
  booking: Pick<RentalBookingRead, 'status' | 'viewStatus'>,
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (booking.viewStatus === 'overdue') {
    return 'danger'
  }
  if (booking.status === 'returned') {
    return 'success'
  }
  if (booking.status === 'issued' || booking.viewStatus === 'active') {
    return 'info'
  }
  if (booking.status === 'reserved') {
    return 'warning'
  }
  return 'neutral'
}

export function RentalPage() {
  const { t, locale } = useLocalization()
  const { modules, settings } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { bookings, reminders, analytics, at } = useRental()
  const { customers } = useCustomers()
  const { contacts } = useContacts()
  const { companies } = useCompanies()
  const { products } = useProducts()
  const { navigate } = useAppPath()
  const [creating, setCreating] = useState(false)
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('week')
  const [cursorDay, setCursorDay] = useState(dayKey(at))

  const categories = useMemo(() => {
    void version
    const listed = listProductCategoriesForUser(persistence, currentUser)
    return listed.ok ? listed.value : []
  }, [currentUser, persistence, version])

  if (!modules.rental) {
    return (
      <PagePlaceholder
        title={t('MODULE_NOT_ENABLED')}
        description={t('MODULE_NOT_ENABLED')}
      />
    )
  }

  const totals = analytics?.totals
  const customerName = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId)
    return customer
      ? getCustomerDisplayName(customer, contacts, companies)
      : customerId
  }
  const bookingLabel = (booking: (typeof bookings)[number]) => {
    const item = booking.items[0]
    const product = item
      ? products.find((entry) => entry.id === item.productId)
      : undefined
    const quantity = item?.quantity ?? 0
    const start = formatDateTime(booking.startAt, locale, settings.timezone)
    const end = formatDateTime(booking.endAt, locale, settings.timezone)
    return (
      <span className="rental-cal__event-body">
        <ProductImageThumb imageUrl={product?.imageUrl} name={product?.name ?? ''} />
        <span>
          <strong>{customerName(booking.customerId)}</strong>
          <small>
            {product?.name ?? item?.productId ?? ''} · {quantity} {t('rentalPcs')}
          </small>
          <small>
            {start} → {end}
          </small>
          <StatusBadge tone={rentalTone(booking)}>
            {t(rentalStatusLabelKey(booking))}
          </StatusBadge>
        </span>
      </span>
    )
  }
  const shiftCursor = (direction: -1 | 1) => {
    if (mode === 'day') {
      setCursorDay(addDays(cursorDay, direction))
      return
    }
    if (mode === 'week') {
      setCursorDay(addDays(cursorDay, direction * 7))
      return
    }
    setCursorDay(addMonths(cursorDay, direction))
  }
  const upcoming = bookings
    .filter((booking) => booking.status === 'reserved' || booking.status === 'issued')
    .slice(0, 8)

  return (
    <section className="workspace-page rental-page">
      <PageHeader
        title={t('platformModuleRental')}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            + {t('rentalNewBooking')}
          </Button>
        }
      />

      <FilterBar
        filters={
          <SectionTabs
            label={t('platformModuleRental')}
            activeId={mode}
            onSelect={(id) => setMode(id as 'day' | 'week' | 'month')}
            tabs={[
              { id: 'day', label: t('rentalDay') },
              { id: 'week', label: t('rentalWeek') },
              { id: 'month', label: t('rentalMonth') },
            ]}
          />
        }
        actions={
          <ActionRow>
            <Button type="button" onClick={() => shiftCursor(-1)}>
              ‹
            </Button>
            <span className="workspace-muted">{cursorDay}</span>
            <Button type="button" onClick={() => shiftCursor(1)}>
              ›
            </Button>
          </ActionRow>
        }
      />

      <RentalCalendar
        mode={mode}
        cursorDay={cursorDay}
        bookings={bookings}
        locale={locale}
        timeZone={settings.timezone}
        onSelect={(id) => navigate(`/rental/bookings/${id}`)}
        labelFor={bookingLabel}
      />

      <KpiStrip
        variant="primary"
        items={[
          {
            id: 'due',
            label: t('rentalDue'),
            value: formatMoney(totals?.dueAmount ?? 0, locale, settings.currency),
          },
        ]}
      />
      <KpiStrip
        items={[
          {
            id: 'issue',
            label: t('rentalIssueToday'),
            value: String(reminders.filter((item) => item.kind === 'issue_today').length),
          },
          {
            id: 'return',
            label: t('rentalReturnToday'),
            value: String(reminders.filter((item) => item.kind === 'return_today').length),
          },
          {
            id: 'overdue',
            label: t('rentalOverdue'),
            value: String(totals?.overdue ?? 0),
          },
          {
            id: 'bookings',
            label: t('rentalKpiBookings'),
            value: String(totals?.bookings ?? 0),
          },
          {
            id: 'total',
            label: t('rentalTotal'),
            value: formatMoney(totals?.rentalTotal ?? 0, locale, settings.currency),
          },
          {
            id: 'prepayment',
            label: t('rentalPrepayment'),
            value: formatMoney(totals?.prepayment ?? 0, locale, settings.currency),
          },
          {
            id: 'paid',
            label: t('rentalPaid'),
            value: formatMoney(totals?.paidAmount ?? 0, locale, settings.currency),
          },
        ]}
      />

      <div className="rental-side">
        <section>
          <h3>{t('rentalReminders')}</h3>
          {reminders.length === 0 ? (
            <EmptyState title={t('rentalNoReminders')} />
          ) : (
            <ul className="rental-reminder-list">
              {reminders.map((item) => (
                <li key={`${item.kind}-${item.booking.id}`}>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => navigate(`/rental/bookings/${item.booking.id}`)}
                  >
                    <StatusBadge tone={rentalTone(item.booking)}>
                      {t(
                        item.kind === 'overdue'
                          ? 'rentalOverdue'
                          : item.kind === 'issue_today'
                            ? 'rentalIssueToday'
                            : item.kind === 'return_today'
                              ? 'rentalReturnToday'
                              : item.kind === 'issue_tomorrow'
                                ? 'rentalIssueTomorrow'
                                : 'rentalReturnTomorrow',
                      )}
                    </StatusBadge>
                    {' · '}
                    {customerName(item.booking.customerId)}
                    {' · '}
                    {formatDateTime(
                      item.kind.startsWith('return')
                        ? item.booking.endAt
                        : item.booking.startAt,
                      locale,
                      settings.timezone,
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3>{t('rentalUpcoming')}</h3>
          {upcoming.length === 0 ? (
            <EmptyState title={t('rentalHistoryEmpty')} />
          ) : (
            upcoming.map((booking) => (
              <button
                key={booking.id}
                type="button"
                className="link-button"
                onClick={() => navigate(`/rental/bookings/${booking.id}`)}
              >
                <StatusBadge tone={rentalTone(booking)}>
                  {t(rentalStatusLabelKey(booking))}
                </StatusBadge>
                {' · '}
                {customerName(booking.customerId)} ·{' '}
                {formatDateTime(booking.startAt, locale, settings.timezone)}
              </button>
            ))
          )}
        </section>
      </div>

      {creating ? (
        <Modal title={t('rentalNewBooking')} onClose={() => setCreating(false)}>
          <RentalBookingForm
            categories={categories}
            onCreated={(id) => {
              setCreating(false)
              navigate(`/rental/bookings/${id}`)
            }}
            onCancel={() => setCreating(false)}
            onEditCustomer={() => navigate('/customers')}
          />
        </Modal>
      ) : null}
    </section>
  )
}
