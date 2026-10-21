import { useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useCompanies } from '../../context/company-context'
import { useContacts } from '../../context/contact-context'
import { useCustomers } from '../../context/customer-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { useProducts } from '../../context/product-context'
import { useRental } from '../../context/rental-context'
import { useUsers } from '../../context/user-context'
import { rentalCustomerPhone } from '../../../core/services'
import type { RentalReturnCondition } from '../../../core/types'
import { getCustomerDisplayName } from '../../../modules/crm/customers/customer-name'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { ProductImageThumb } from '../../../modules/inventory/components/ProductImageThumb'
import { formatDateTime } from '../../../modules/rental/rental-datetime'
import { rentalStatusLabelKey, rentalWhatsAppHref } from '../../../modules/rental/rental-status'
import { PaymentForm } from '../../../modules/sales/components/PaymentForm'
import { formatMoney } from '../../../modules/sales/pos-format'
import { ActionRow, Button, KpiStrip, PageHeader, RowMenu, Select, StatusBadge, useToast } from '../../../shared/ui'
import type { RentalBookingRead } from '../../../core/services'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { useAppPath } from '../useAppPath'

type RentalBookingPageProps = {
  bookingId: string
}

const RETURN_OPTIONS: RentalReturnCondition[] = [
  'ok',
  'damaged',
  'incomplete',
  'other',
]

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

export function RentalBookingPage({ bookingId }: RentalBookingPageProps) {
  const { t, locale } = useLocalization()
  const { showToast } = useToast()
  const { modules, settings } = useOrganization()
  const { hasFinancialAccess } = useAccess()
  const { navigate } = useAppPath()
  const {
    getBooking,
    reserveBooking,
    cancelBooking,
    issueBooking,
    returnBooking,
    payBooking,
  } = useRental()
  const { customers } = useCustomers()
  const { contacts, getContact } = useContacts()
  const { companies } = useCompanies()
  const { products } = useProducts()
  const { getUser } = useUsers()
  const [condition, setCondition] = useState<RentalReturnCondition>('ok')
  const [returnComment, setReturnComment] = useState('')
  const [paying, setPaying] = useState(false)
  const booking = getBooking(bookingId)

  if (!modules.rental) {
    return (
      <PagePlaceholder
        title={t('MODULE_NOT_ENABLED')}
        description={t('MODULE_NOT_ENABLED')}
      />
    )
  }

  if (!booking) {
    return (
      <PagePlaceholder
        title={t('pageNotFound')}
        description={t('pageNotFoundDescription')}
      />
    )
  }

  const customer = customers.find((item) => item.id === booking.customerId)
  const phone = customer
    ? rentalCustomerPhone(customer, {
        getContact: (id) => getContact(id),
        getCompany: (id) => companies.find((company) => company.id === id),
      })
    : undefined
  const whatsapp = phone ? rentalWhatsAppHref(phone) : undefined
  const due = Math.max(0, booking.total - booking.paidAmount)
  const actorName = (id?: string) => {
    if (!id) {
      return '—'
    }
    const user = getUser(id)
    return user ? userDisplayName(user) : id
  }
  const money = (value: number) => formatMoney(value, locale, settings.currency)
  const when = (iso?: string) =>
    iso ? formatDateTime(iso, locale, settings.timezone) : '—'

  return (
    <section className="workspace-page rental-booking-page">
      <PageHeader
        title={t('rentalBooking')}
        actions={
          <ActionRow>
            <Button type="button" onClick={() => navigate('/rental')}>
              {t('rentalBack')}
            </Button>
            {booking.status === 'draft' ? (
              <Button
                variant="primary"
                onClick={() => {
                  if (!reserveBooking(booking.id)) {
                    showToast(t('rentalActionFailed'))
                  }
                }}
              >
                {t('rentalReserve')}
              </Button>
            ) : null}
            {booking.status === 'reserved' ? (
              <Button
                variant="primary"
                onClick={() => {
                  if (!issueBooking(booking.id)) {
                    showToast(t('rentalActionFailed'))
                  }
                }}
              >
                {t('rentalIssue')}
              </Button>
            ) : null}
            {booking.status !== 'cancelled' &&
            due > 0 &&
            hasFinancialAccess('payments.create') &&
            !paying ? (
              <Button variant="primary" type="button" onClick={() => setPaying(true)}>
                + {t('rentalAcceptPayment')}
              </Button>
            ) : null}
            {booking.status === 'draft' || booking.status === 'reserved' ? (
              <RowMenu
                label={t('moreActions')}
                items={[
                  {
                    id: 'cancel',
                    label: t('rentalCancel'),
                    danger: true,
                    onSelect: () => {
                      if (!cancelBooking(booking.id)) {
                        showToast(t('rentalActionFailed'))
                      }
                    },
                  },
                ]}
              />
            ) : null}
          </ActionRow>
        }
      />

      <div className="deal-detail__summary">
        <StatusBadge tone={rentalTone(booking)}>
          {t(rentalStatusLabelKey(booking))}
        </StatusBadge>
      </div>

      <KpiStrip
        items={[
          {
            id: 'customer',
            label: t('customer'),
            value: customer
              ? getCustomerDisplayName(customer, contacts, companies)
              : booking.customerId,
          },
          {
            id: 'period',
            label: t('rentalPeriod'),
            value: `${when(booking.startAt)} — ${when(booking.endAt)}`,
          },
          {
            id: 'items',
            label: t('navProducts'),
            value: String(booking.items.length),
          },
          {
            id: 'total',
            label: t('rentalTotal'),
            value: money(booking.total),
          },
        ]}
      />

      <div className="record-stack">
      <section className="record-section">
        <h3>{t('customer')}</h3>
        <p>
          {customer ? getCustomerDisplayName(customer, contacts, companies) : booking.customerId}
        </p>
        <p>
          {t('phone')}: {phone ?? '—'}
        </p>
        {phone ? (
          <p className="rental-contact-actions">
            <a href={`tel:${phone}`}>{t('rentalCall')}</a>
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noreferrer">
                {t('rentalWhatsapp')}
              </a>
            ) : null}
          </p>
        ) : null}
      </section>

      <section className="record-section">
        <h3>{t('rentalPeriod')}</h3>
        <p>
          {t('rentalIssueAt')}: {when(booking.startAt)}
        </p>
        <p>
          {t('rentalReturnAt')}: {when(booking.endAt)}
        </p>
      </section>

      <section className="record-section">
        <h3>{t('navProducts')}</h3>
      <ul className="rental-item-list">
        {booking.items.map((item) => {
          const product = products.find((entry) => entry.id === item.productId)
          return (
            <li key={item.id} className="rental-item">
              <ProductImageThumb imageUrl={product?.imageUrl} name={product?.name ?? item.productId} />
              <div>
                <p>{product?.name ?? item.productId}</p>
                <p className="workspace-muted">
                  {t('rentalQuantity')}: {item.quantity} {t('rentalPcs')}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
      </section>

      <section className="record-section">
        <h3>{t('price')}</h3>
        <p>
          {t('rentalSubtotal')}: {money(booking.subtotal)}
        </p>
        <p>
          {t('rentalDiscount')}: {money(booking.discount)}
        </p>
        <p>
          {t('rentalTotal')}: {money(booking.total)}
        </p>
      </section>

      <section className="record-section">
        <h3>{t('rentalPrepayment')}</h3>
        <p>{money(booking.prepayment)}</p>
      </section>

      <section className="record-section">
        <h3>{t('payment')}</h3>
        <p>
          {t('rentalPaid')}: {money(booking.paidAmount)}
        </p>
        <p className="record-emphasis">
          {t('rentalDue')}: {money(due)}
        </p>
      </section>
      </div>

      {paying ? (
        <PaymentForm
          dueAmount={due}
          currency={settings.currency}
          onSubmit={(draft) => {
            const created = payBooking(booking.id, draft)
            if (created) {
              setPaying(false)
            }
            return created
          }}
          onCancel={() => setPaying(false)}
        />
      ) : null}

      <p>
        {t('rentalIssuedBy')}: {actorName(booking.issuedBy)} {when(booking.issuedAt)}
      </p>
      <p>
        {t('rentalReturnedBy')}: {actorName(booking.returnedBy)} {when(booking.returnedAt)}
      </p>

      {booking.status === 'issued' ? (
        <section className="record-section">
          <label className="warehouse-field">
            <span className="settings-field__label">{t('rentalReturnCondition')}</span>
            <Select
              value={condition}
              onChange={(event) =>
                setCondition(event.target.value as RentalReturnCondition)
              }
            >
              {RETURN_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(
                    option === 'ok'
                      ? 'rentalReturnOk'
                      : option === 'damaged'
                        ? 'rentalReturnDamaged'
                        : option === 'incomplete'
                          ? 'rentalReturnIncomplete'
                          : 'rentalReturnOther',
                  )}
                </option>
              ))}
            </Select>
          </label>
          <textarea
            className="warehouse-input"
            value={returnComment}
            onChange={(event) => setReturnComment(event.target.value)}
          />
          <Button
            variant="primary"
            onClick={() => {
              if (!returnBooking(booking.id, condition, returnComment)) {
                showToast(t('rentalActionFailed'))
              }
            }}
          >
            {t('rentalAcceptReturn')}
          </Button>
        </section>
      ) : null}
    </section>
  )
}
