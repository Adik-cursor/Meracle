import { useRental } from '../../context/rental-context'
import { useCompanies } from '../../context/company-context'
import { useContacts } from '../../context/contact-context'
import { useCustomers } from '../../context/customer-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { useAppPath } from '../useAppPath'
import { rentalBookingBalance } from '../../../core/services'
import { getCustomerDisplayName } from '../../../modules/crm/customers/customer-name'
import { formatMoney } from '../../../modules/sales/pos-format'
import { Button, EmptyState } from '../../../shared/ui'
import { WorkbookExportButton } from '../../../shared/components/WorkbookExportButton'
import { rentalStatusLabelKey } from '../../../modules/rental/rental-status'

type RentalFinancePageProps = {
  dueOnly?: boolean
}

export function RentalFinancePage({ dueOnly = false }: RentalFinancePageProps) {
  const { t, locale } = useLocalization()
  const { navigate } = useAppPath()
  const { settings } = useOrganization()
  const { bookings } = useRental()
  const { getCustomer } = useCustomers()
  const { contacts } = useContacts()
  const { companies } = useCompanies()
  const money = (value: number) => formatMoney(value, locale, settings.currency)
  const rows = bookings.filter((booking) =>
    dueOnly ? rentalBookingBalance(booking) > 0 : booking.status !== 'cancelled',
  )

  return (
    <div className="finance-panel">
      <header className="finance-panel__intro">
        <h3>{dueOnly ? t('financeTabDebts') : t('financeTabPayments')}</h3>
        <WorkbookExportButton
          filename={dueOnly ? 'finance-debts.xlsx' : 'finance-payments.xlsx'}
          sheets={[
            {
              name: dueOnly ? 'Задолженности' : 'Оплаты',
              headers: dueOnly
                ? [
                    'Клиент',
                    'Основание',
                    'Дата',
                    'Начислено',
                    'Оплачено',
                    'Задолженность',
                    'Срок оплаты',
                    'Статус',
                    'Ответственный',
                  ]
                : [
                    'Дата',
                    'Номер операции',
                    'Клиент',
                    'Основание',
                    'Тип',
                    'Сумма',
                    'Валюта',
                    'Статус',
                    'Ответственный',
                  ],
              rows: rows.map((booking) => {
                const customer = getCustomer(booking.customerId)
                const name = customer
                  ? getCustomerDisplayName(customer, contacts, companies)
                  : booking.customerId
                return dueOnly
                  ? [
                      name,
                      booking.id.slice(-6).toUpperCase(),
                      booking.startAt,
                      booking.total,
                      booking.paidAmount,
                      rentalBookingBalance(booking),
                      booking.endAt,
                      booking.status,
                      '',
                    ]
                  : [
                      booking.startAt,
                      booking.id.slice(-6).toUpperCase(),
                      name,
                      booking.status,
                      'rental',
                      booking.paidAmount,
                      settings.currency,
                      booking.status,
                      '',
                    ]
              }),
            },
          ]}
        />
      </header>
      {rows.length === 0 ? (
        <EmptyState title={t('rentalHistoryEmpty')} />
      ) : (
        <div className="finance-table-wrap">
        <table className="finance-salary-table">
          <thead>
            <tr>
              <th>{t('navCustomers')}</th>
              <th>{t('status')}</th>
              <th className="is-num">{t('rentalTotal')}</th>
              <th className="is-num">{t('rentalPrepayment')}</th>
              <th className="is-num">{t('rentalPaid')}</th>
              <th className="is-num">{t('rentalDue')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((booking) => {
              const customer = getCustomer(booking.customerId)
              return (
                <tr key={booking.id}>
                  <td>
                    {customer ? getCustomerDisplayName(customer, contacts, companies) : booking.customerId}
                  </td>
                  <td>{t(rentalStatusLabelKey(booking))}</td>
                  <td className="is-num">{money(booking.total)}</td>
                  <td className="is-num">{money(booking.prepayment)}</td>
                  <td className="is-num">{money(booking.paidAmount)}</td>
                  <td className="is-num">{money(rentalBookingBalance(booking))}</td>
                  <td>
                    {rentalBookingBalance(booking) > 0 ? (
                      <Button
                        variant="ghost"
                        onClick={() => navigate(`/rental/bookings/${booking.id}`)}
                      >
                        {t('rentalAcceptPayment')}
                      </Button>
                    ) : <span className="finance-muted">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}
