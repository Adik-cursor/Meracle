import { useMemo, useState } from 'react'
import { useAuth } from '../../app/context/auth-context'
import { useCompanies } from '../../app/context/company-context'
import { useContacts } from '../../app/context/contact-context'
import { useCustomers } from '../../app/context/customer-context'
import { useLocalization } from '../../app/context/localization-context'
import { useOrganization } from '../../app/context/organization-context'
import { usePersistence, usePersistenceVersion } from '../../app/context/persistence-context'
import { useProducts } from '../../app/context/product-context'
import { AuthRequiredState } from '../../app/components/AuthRequiredState'
import { useAppPath } from '../../app/routes/useAppPath'
import {
  currentMotivationPeriodKey,
  customRangeFromDateInputs,
  getCompanyDashboardForUser,
  rentalCustomerPhone,
  resolveAnalyticsRange,
  type AnalyticsPeriod,
  type RentalDashboardBookingRow,
  type RentalDashboardCashflowPoint,
} from '../../core/services'
import type { TranslationKey } from '../../core/localization/translations'
import { getCustomerDisplayName } from '../crm/customers/customer-name'
import { ProductImageThumb } from '../inventory/components/ProductImageThumb'
import { formatMoney } from '../sales/pos-format'
import { Button } from '../../shared/ui'
import { rentalStatusLabelKey } from './rental-status'

const PERIODS: { id: AnalyticsPeriod; label: TranslationKey }[] = [
  { id: 'today', label: 'analyticsPeriodToday' },
  { id: '7d', label: 'analyticsPeriod7d' },
  { id: 'month', label: 'analyticsPeriodThisMonth' },
  { id: 'custom', label: 'periodCustom' },
]

function formatClock(iso: string, locale: 'ru' | 'kk', timeZone?: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return date.toLocaleTimeString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
    timeZone: timeZone || undefined,
    hour: '2-digit',
    minute: '2-digit',
  })
}

function periodCaption(
  period: AnalyticsPeriod,
  locale: 'ru' | 'kk',
  customFrom: string,
  customTo: string,
): string {
  if (period === 'custom' && customFrom && customTo) {
    return `${customFrom} → ${customTo}`
  }
  if (period === 'today') {
    return new Date().toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
      day: 'numeric',
      month: 'long',
    })
  }
  if (period === '7d') {
    return locale === 'kk' ? '7 күн' : '7 дней'
  }
  return new Date().toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
    month: 'long',
    year: 'numeric',
  })
}

function formatDay(iso: string, locale: 'ru' | 'kk', timeZone?: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return date.toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
    timeZone: timeZone || undefined,
    day: '2-digit',
    month: '2-digit',
  })
}

function CashflowChart({
  series,
  paidLabel,
  expensesLabel,
  emptyLabel,
}: {
  series: RentalDashboardCashflowPoint[]
  paidLabel: string
  expensesLabel: string
  emptyLabel: string
}) {
  const source = series.slice(-7)
  if (source.length === 0) {
    return <p className="rental-dashboard__empty">{emptyLabel}</p>
  }

  const max = Math.max(...source.flatMap((point) => [point.paid, point.expenses]), 1)
  const width = 640
  const height = 128
  const padX = 16
  const padTop = 12
  const padBottom = 28
  const innerWidth = width - padX * 2
  const innerHeight = height - padTop - padBottom
  const slot = innerWidth / source.length
  const bar = Math.max(10, Math.min(28, slot * 0.32))

  return (
    <figure className="rental-dashboard__chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        {[0.25, 0.5, 0.75, 1].map((line) => {
          const y = padTop + innerHeight - innerHeight * line
          return (
            <line
              key={line}
              className="rental-dashboard__chart-grid"
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
            />
          )
        })}
        {source.map((point, index) => {
          const x = padX + index * slot + slot / 2
          const paidH = Math.max((point.paid / max) * innerHeight, point.paid > 0 ? 6 : 0)
          const expH = Math.max((point.expenses / max) * innerHeight, point.expenses > 0 ? 6 : 0)
          const label = `${point.bucket.slice(8, 10)}.${point.bucket.slice(5, 7)}`
          return (
            <g key={point.bucket}>
              <rect
                className="rental-dashboard__chart-paid"
                x={x - bar - 2}
                y={padTop + innerHeight - paidH}
                width={bar}
                height={paidH}
                rx="1"
              />
              <rect
                className="rental-dashboard__chart-expenses"
                x={x + 2}
                y={padTop + innerHeight - expH}
                width={bar}
                height={expH}
                rx="1"
              />
              <text className="rental-dashboard__chart-label" x={x} y={height - 8} textAnchor="middle">
                {label}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>
        <span>{paidLabel}</span>
        <span>{expensesLabel}</span>
      </figcaption>
    </figure>
  )
}

export function RentalDashboardSections() {
  const { t, locale } = useLocalization()
  const { navigate } = useAppPath()
  const { currentUser } = useAuth()
  const { settings, modules } = useOrganization()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { customers } = useCustomers()
  const { contacts } = useContacts()
  const { companies } = useCompanies()
  const { products } = useProducts()
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const dashboard = useMemo(() => {
    void version
    const nowIso = new Date().toISOString()
    const customReady = Boolean(customFrom && customTo)
    const range =
      period === 'custom'
        ? customReady
          ? customRangeFromDateInputs(customFrom, customTo)
          : resolveAnalyticsRange('month', nowIso)
        : resolveAnalyticsRange(period, nowIso)
    return getCompanyDashboardForUser(
      persistence,
      currentUser,
      currentMotivationPeriodKey(),
      {
        range,
        timeZone: settings.timezone,
      },
    )
  }, [currentUser, customFrom, customTo, period, persistence, settings.timezone, version])

  if (!currentUser) {
    return <AuthRequiredState />
  }

  if (!dashboard.ok || !dashboard.value.rental) {
    return <AuthRequiredState />
  }

  const rental = dashboard.value.rental
  const money = (value: number) => formatMoney(value, locale, settings.currency)
  const customerName = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId)
    return customer
      ? getCustomerDisplayName(customer, contacts, companies)
      : customerId
  }
  const customerPhone = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId)
    if (!customer) {
      return t('rentalPhoneMissing')
    }
    return (
      rentalCustomerPhone(customer, {
        getContact: (id) => contacts.find((contact) => contact.id === id),
        getCompany: (id) => companies.find((company) => company.id === id),
      }) ?? t('rentalPhoneMissing')
    )
  }
  const productById = (productId?: string) =>
    productId ? products.find((product) => product.id === productId) : undefined
  const productName = (productId?: string) => productById(productId)?.name ?? productId ?? '—'
  const openRental = () => navigate('/rental')
  const openBooking = (row: RentalDashboardBookingRow) =>
    navigate(`/rental/bookings/${row.bookingId}`)
  const paidValue = rental.paymentsIncluded ? money(rental.paidAmount) : '—'
  const expensesValue = rental.expensesIncluded ? money(rental.expenses) : '—'
  const netValue = rental.paymentsIncluded ? money(rental.netResult) : '—'
  const netTone =
    !rental.paymentsIncluded || rental.netResult === 0
      ? ''
      : rental.netResult > 0
        ? 'rental-dashboard__tone--up'
        : 'rental-dashboard__tone--down'

  const overdueRows = [...rental.dueReturns, ...rental.upcomingIssues].filter(
    (row, index, list) =>
      row.viewStatus === 'overdue' &&
      list.findIndex((item) => item.bookingId === row.bookingId) === index,
  )

  return (
    <div className="rental-dashboard dash-grid dash-span-12">
      <header className="rental-dashboard__header dash-span-12">
        <div>
          <h2 className="rental-dashboard__title">{t('platformModuleRental')}</h2>
          <p className="rental-dashboard__kicker">{periodCaption(period, locale, customFrom, customTo)}</p>
        </div>
        <div className="rental-dashboard__periods" role="group" aria-label={t('analyticsPeriod')}>
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                period === item.id
                  ? 'rental-dashboard__period rental-dashboard__period--active'
                  : 'rental-dashboard__period'
              }
              onClick={() => setPeriod(item.id)}
            >
              {t(item.label)}
            </button>
          ))}
          {period === 'custom' ? (
            <div className="rental-dashboard__custom">
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
              />
            </div>
          ) : null}
        </div>
      </header>

      <section className="rental-dashboard__hero dash-span-12">
        <div>
          <p className="rental-dashboard__label">{t('rentalPaid')}</p>
          <p className="rental-dashboard__hero-value">{paidValue}</p>
          <p className="rental-dashboard__hero-note">{t('rentalPaidPeriod')}</p>
        </div>
        <dl className="rental-dashboard__ledger">
          <div>
            <dt>{t('rentalTotal')}</dt>
            <dd>{money(rental.rentalTotal)}</dd>
          </div>
          <div>
            <dt>{t('rentalDue')}</dt>
            <dd>{money(rental.dueAmount)}</dd>
          </div>
          <div>
            <dt>{t('rentalPrepayment')}</dt>
            <dd>{money(rental.prepayment)}</dd>
          </div>
          <div>
            <dt>{t('kpiExpenses')}</dt>
            <dd>{expensesValue}</dd>
          </div>
          <div className="rental-dashboard__ledger-result">
            <dt>{t('rentalNetResult')}</dt>
            <dd className={netTone}>{netValue}</dd>
          </div>
        </dl>
      </section>

      <section
        className={`rental-dashboard__panel ${modules.plans === true ? 'dash-span-8' : 'dash-span-12'}`}
        aria-labelledby="rental-today"
      >
          <h3 id="rental-today">{t('rentalTodayBlock')}</h3>
          <div className="rental-dashboard__today-row">
            <button type="button" onClick={openRental}>
              <span>{t('rentalNewBookings')}</span>
              <strong>{rental.newBookingsToday}</strong>
            </button>
            <button type="button" onClick={openRental}>
              <span>{t('rentalIssued')}</span>
              <strong>{rental.issuedToday}</strong>
            </button>
            <button type="button" onClick={openRental}>
              <span>{t('rentalReturned')}</span>
              <strong>{rental.returnsToday}</strong>
            </button>
            <button type="button" onClick={openRental}>
              <span>{t('rentalOverdue')}</span>
              <strong className={rental.overdue > 0 ? 'rental-dashboard__tone--down' : undefined}>
                {rental.overdue}
              </strong>
            </button>
          </div>
        </section>

        {modules.plans === true && rental.planTarget > 0 ? (
          <section className="rental-dashboard__panel dash-span-4">
            <p className="rental-dashboard__label">{t('rentalPlanMonth')}</p>
            <p className="rental-dashboard__plan-sum">
              {money(rental.planPaid)}
              <span> / {money(rental.planTarget)}</span>
            </p>
            <p className="rental-dashboard__plan-pct">{Math.round(rental.planCompletion)}%</p>
            <div className="rental-dashboard__plan-track" aria-hidden="true">
              <span style={{ width: `${Math.min(100, rental.planCompletion)}%` }} />
            </div>
            <p className="rental-dashboard__muted">
              {t('rentalPlanRemaining')}: {money(rental.planRemaining)}
            </p>
          </section>
        ) : modules.plans === true ? (
          <section className="rental-dashboard__panel rental-dashboard__panel--compact dash-span-4">
            <p className="rental-dashboard__label">{t('rentalPlanMonth')}</p>
            <p className="rental-dashboard__muted">{t('rentalPlanEmpty')}</p>
            <Button variant="ghost" onClick={() => navigate('/company/plans')}>
              {t('dashboardOpenAction')}
            </Button>
          </section>
        ) : null}

      <section className="rental-dashboard__panel dash-span-8">
          <h3>{t('rentalUpcomingIssues')}</h3>
          {rental.upcomingIssues.length === 0 ? (
            <p className="rental-dashboard__empty">{t('rentalNoUpcomingIssues')}</p>
          ) : (
            <ul className="rental-dashboard__timeline">
              {rental.upcomingIssues.map((row) => {
                const product = productById(row.productId)
                return (
                  <li key={row.bookingId}>
                    <button
                      type="button"
                      className="rental-dashboard__booking"
                      onClick={() => openBooking(row)}
                    >
                      <time className="rental-dashboard__booking-time">
                        {formatClock(row.startAt, locale, settings.timezone)}
                      </time>
                      <ProductImageThumb
                        imageUrl={product?.imageUrl}
                        name={productName(row.productId)}
                      />
                      <span className="rental-dashboard__booking-who">
                        <strong>{productName(row.productId)}</strong>
                        <small>
                          {customerName(row.customerId)} · {customerPhone(row.customerId)}
                          {row.quantity ? ` · ${row.quantity} ${t('rentalPcs')}` : ''}
                        </small>
                      </span>
                      <span className="rental-dashboard__booking-period">
                        {formatDay(row.startAt, locale, settings.timezone)} →{' '}
                        {formatDay(row.endAt, locale, settings.timezone)}
                      </span>
                      <span className="rental-dashboard__booking-money">
                        <small>
                          {t('rentalPrepayment')} {money(row.prepayment)}
                        </small>
                        <strong>
                          {t('rentalDue')} {money(row.dueAmount)}
                        </strong>
                      </span>
                      <span className="rental-dashboard__booking-action">
                        {t('dashboardOpenAction')}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="rental-dashboard__panel dash-span-4">
          <h3>{t('rentalDueReturnsToday')}</h3>
          {rental.dueReturns.length === 0 ? (
            <p className="rental-dashboard__empty">{t('rentalNoDueReturns')}</p>
          ) : (
            <ul className="rental-dashboard__timeline">
              {rental.dueReturns.map((row) => {
                const product = productById(row.productId)
                return (
                  <li key={row.bookingId}>
                    <button
                      type="button"
                      className={
                        row.viewStatus === 'overdue'
                          ? 'rental-dashboard__booking rental-dashboard__booking--return rental-dashboard__booking--overdue'
                          : 'rental-dashboard__booking rental-dashboard__booking--return'
                      }
                      onClick={() => openBooking(row)}
                    >
                      <time className="rental-dashboard__booking-time">
                        {formatClock(row.endAt, locale, settings.timezone)}
                      </time>
                      <ProductImageThumb
                        imageUrl={product?.imageUrl}
                        name={productName(row.productId)}
                      />
                      <span className="rental-dashboard__booking-who">
                        <strong>{productName(row.productId)}</strong>
                        <small>{customerName(row.customerId)}</small>
                      </span>
                      <span className="rental-dashboard__booking-period">
                        {formatDay(row.endAt, locale, settings.timezone)}
                      </span>
                      <span className="rental-dashboard__booking-money">
                        <strong>
                          {row.quantity} {t('rentalPcs')}
                        </strong>
                        <small>{t(rentalStatusLabelKey(row))}</small>
                      </span>
                      <span className="rental-dashboard__booking-action">
                        {t('dashboardOpenAction')}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

      <section className="rental-dashboard__panel rental-dashboard__panel--compact dash-span-12">
        <h3>{t('rentalOverdue')}</h3>
        {rental.overdue > 0 ? (
          <>
            <p className="rental-dashboard__overdue-count">{rental.overdue}</p>
            <ul className="rental-dashboard__timeline">
              {overdueRows.map((row) => {
                const product = productById(row.productId)
                return (
                  <li key={row.bookingId}>
                    <button
                      type="button"
                      className="rental-dashboard__booking rental-dashboard__booking--overdue"
                      onClick={() => openBooking(row)}
                    >
                      <time className="rental-dashboard__booking-time">
                        {formatClock(row.endAt, locale, settings.timezone)}
                      </time>
                      <ProductImageThumb
                        imageUrl={product?.imageUrl}
                        name={productName(row.productId)}
                      />
                      <span className="rental-dashboard__booking-who">
                        <strong>{productName(row.productId)}</strong>
                        <small>{customerName(row.customerId)}</small>
                      </span>
                      <span className="rental-dashboard__booking-period">
                        {formatDay(row.endAt, locale, settings.timezone)}
                      </span>
                      <span className="rental-dashboard__booking-money">
                        <small>{t(rentalStatusLabelKey(row))}</small>
                      </span>
                      <span className="rental-dashboard__booking-action">
                        {t('dashboardOpenAction')}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <p className="rental-dashboard__empty">{t('rentalNoOverdue')}</p>
        )}
      </section>

      <section className="rental-dashboard__panel dash-span-8">
          <h3>{t('rentalFinanceBlock')}</h3>
          <CashflowChart
            series={rental.cashflow}
            paidLabel={t('rentalPaidByDay')}
            expensesLabel={t('rentalExpensesByDay')}
            emptyLabel={t('analyticsNoPeriodData')}
          />
        </section>
        <section className="rental-dashboard__panel dash-span-4">
          <h3>{t('rentalPopularItems')}</h3>
          {rental.popularProducts.length === 0 ? (
            <p className="rental-dashboard__empty">{t('rentalNoPopularItems')}</p>
          ) : (
            <ul className="rental-dashboard__popular">
              {rental.popularProducts.map((row) => {
                const product = productById(row.productId)
                return (
                  <li key={row.productId}>
                    <ProductImageThumb
                      imageUrl={product?.imageUrl}
                      name={productName(row.productId)}
                    />
                    <span className="rental-dashboard__popular-name">
                      <strong>{productName(row.productId)}</strong>
                      <small>
                        {row.count} {t('rentalRentalsCount')}
                      </small>
                    </span>
                    <span className="rental-dashboard__popular-sum">{money(row.total)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

      <section className="rental-dashboard__panel rental-dashboard__actions dash-span-12">
        <h3>{t('dashboardQuickActions')}</h3>
        <div className="rental-dashboard__actions-row">
          <Button variant="primary" onClick={openRental}>
            + {t('rentalNewBooking')}
          </Button>
          <Button onClick={() => navigate('/finance')}>{t('quickNewExpense')}</Button>
          <Button onClick={openRental}>{t('rentalOpenCalendar')}</Button>
          <Button onClick={() => navigate('/finance?tab=analytics')}>{t('dashboardOpenAnalytics')}</Button>
        </div>
      </section>
    </div>
  )
}

export function RentalCompanyDashboard() {
  return (
    <section className="workspace-page rental-dashboard dash-grid">
      <RentalDashboardSections />
    </section>
  )
}
