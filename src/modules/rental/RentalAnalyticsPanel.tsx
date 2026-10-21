import { useState } from 'react'
import { useCompanies } from '../../app/context/company-context'
import { useContacts } from '../../app/context/contact-context'
import { useCustomers } from '../../app/context/customer-context'
import { useLocalization } from '../../app/context/localization-context'
import { useOrganization } from '../../app/context/organization-context'
import { useProducts } from '../../app/context/product-context'
import { useRental } from '../../app/context/rental-context'
import { rentalCustomerPhone } from '../../core/services'
import { getCustomerDisplayName } from '../crm/customers/customer-name'
import { formatDateTime } from './rental-datetime'
import { rentalStatusLabelKey } from './rental-status'
import { formatMoney } from '../sales/pos-format'
import { Button } from '../../shared/ui'

type ReportId =
  | 'bookings'
  | 'customers'
  | 'products'
  | 'returns'
  | 'overdue'
  | 'payments'

export function RentalAnalyticsPanel() {
  const { t, locale } = useLocalization()
  const { modules, settings } = useOrganization()
  const { analytics } = useRental()
  const { customers } = useCustomers()
  const { contacts } = useContacts()
  const { companies } = useCompanies()
  const { products } = useProducts()
  const [report, setReport] = useState<ReportId>('bookings')

  if (!modules.rental || !analytics) {
    return null
  }

  const money = (value: number) => formatMoney(value, locale, settings.currency)
  const customerName = (id: string) => {
    const customer = customers.find((item) => item.id === id)
    return customer
      ? getCustomerDisplayName(customer, contacts, companies)
      : id
  }
  const phoneOf = (id: string) => {
    const customer = customers.find((item) => item.id === id)
    return customer
      ? rentalCustomerPhone(customer, {
          getContact: (contactId) => contacts.find((item) => item.id === contactId),
          getCompany: (companyId) => companies.find((company) => company.id === companyId),
        }) ?? '—'
      : '—'
  }
  const productName = (id: string) =>
    products.find((item) => item.id === id)?.name ?? id
  const productLabel = (ids: string[]) =>
    ids.map(productName).join(', ')

  const downloadCsv = () => {
    const header = [
      t('navCustomers'),
      t('phone'),
      t('navNomenclature'),
      t('rentalQuantity'),
      t('rentalPeriod'),
      t('rentalTotal'),
      t('rentalPrepayment'),
      t('rentalPaid'),
      t('rentalDue'),
      t('rentalStatus'),
      t('rentalIssued'),
      t('rentalReturned'),
    ]
    const lines = analytics.rows.map((row) =>
      [
        customerName(row.customerId),
        phoneOf(row.customerId),
        productLabel(row.productIds),
        row.quantity,
        `${formatDateTime(row.startAt, locale, settings.timezone)} — ${formatDateTime(row.endAt, locale, settings.timezone)}`,
        row.total,
        row.prepayment,
        row.paidAmount,
        row.dueAmount,
        t(rentalStatusLabelKey(row)),
        row.issuedAt
          ? formatDateTime(row.issuedAt, locale, settings.timezone)
          : '',
        row.returnedAt
          ? formatDateTime(row.returnedAt, locale, settings.timezone)
          : '',
      ]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(','),
    )
    const blob = new Blob([`\uFEFF${[header.join(','), ...lines].join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'rental-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const totals = analytics.totals

  return (
    <section className="settings-section">
      <h3>{t('platformModuleRental')}</h3>
      <div className="rental-kpi">
        <p>
          {t('rentalKpiBookings')}: {totals.bookings}
        </p>
        <p>
          {t('rentalIssued')}: {totals.issued}
        </p>
        <p>
          {t('rentalReturned')}: {totals.returned}
        </p>
        <p>
          {t('rentalInUse')}: {totals.active}
        </p>
        <p>
          {t('rentalOverdue')}: {totals.overdue}
        </p>
        <p>
          {t('rentalRentedQty')}: {totals.rentedQuantity} {t('rentalPcs')}
        </p>
        <p>
          {t('rentalTotal')}: {money(totals.rentalTotal)}
        </p>
        <p>
          {t('rentalPrepayment')}: {money(totals.prepayment)}
        </p>
        <p>
          {t('rentalPaid')}: {money(totals.paidAmount)}
        </p>
        <p>
          {t('rentalDue')}: {money(totals.dueAmount)}
        </p>
      </div>

      <div className="nomenclature-filters" role="tablist">
        {(
          [
            ['bookings', 'rentalReportBookings'],
            ['customers', 'rentalReportCustomers'],
            ['products', 'rentalReportProducts'],
            ['returns', 'rentalReportReturns'],
            ['overdue', 'rentalReportOverdue'],
            ['payments', 'rentalReportPayments'],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            className={
              report === id
                ? 'nomenclature-filter nomenclature-filter--active'
                : 'nomenclature-filter'
            }
            onClick={() => setReport(id)}
          >
            {t(key)}
          </button>
        ))}
      </div>

      {report === 'bookings' || report === 'returns' || report === 'overdue' || report === 'payments' ? (
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>{t('navCustomers')}</th>
                <th>{t('phone')}</th>
                <th>{t('navNomenclature')}</th>
                <th>{t('rentalQuantity')}</th>
                <th>{t('rentalPeriod')}</th>
                <th>{t('rentalTotal')}</th>
                <th>{t('rentalPrepayment')}</th>
                <th>{t('rentalPaid')}</th>
                <th>{t('rentalDue')}</th>
                <th>{t('rentalStatus')}</th>
                <th>{t('rentalIssued')}</th>
                <th>{t('rentalReturned')}</th>
              </tr>
            </thead>
            <tbody>
              {(report === 'bookings'
                ? analytics.rows
                : report === 'returns'
                  ? analytics.returns
                  : report === 'overdue'
                    ? analytics.overdue
                    : analytics.payments
              ).map((row) => (
                <tr key={row.bookingId}>
                  <td>{customerName(row.customerId)}</td>
                  <td>{phoneOf(row.customerId)}</td>
                  <td>{productLabel(row.productIds)}</td>
                  <td>
                    {row.quantity} {t('rentalPcs')}
                  </td>
                  <td>
                    {formatDateTime(row.startAt, locale, settings.timezone)} —{' '}
                    {formatDateTime(row.endAt, locale, settings.timezone)}
                  </td>
                  <td>{money(row.total)}</td>
                  <td>{money(row.prepayment)}</td>
                  <td>{money(row.paidAmount)}</td>
                  <td>{money(row.dueAmount)}</td>
                  <td>{t(rentalStatusLabelKey(row))}</td>
                  <td>
                    {row.issuedAt
                      ? formatDateTime(row.issuedAt, locale, settings.timezone)
                      : '—'}
                  </td>
                  <td>
                    {row.returnedAt
                      ? formatDateTime(row.returnedAt, locale, settings.timezone)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>
                  {report === 'customers'
                    ? t('navCustomers')
                    : t('navNomenclature')}
                </th>
                {report === 'products' ? (
                  <>
                    <th>{t('rentalStock')}</th>
                    <th>{t('rentalBookedQty')}</th>
                    <th>{t('rentalAvailable')}</th>
                  </>
                ) : null}
                <th>{t('rentalKpiBookings')}</th>
                <th>{t('rentalQuantity')}</th>
                <th>{t('rentalTotal')}</th>
                <th>{t('rentalPaid')}</th>
                <th>{t('rentalDue')}</th>
              </tr>
            </thead>
            <tbody>
              {(report === 'customers'
                ? analytics.byCustomer
                : analytics.byProduct
              ).map((row) => (
                <tr key={row.key}>
                  <td>
                    {report === 'customers'
                      ? customerName(row.key)
                      : productName(row.key)}
                  </td>
                  {report === 'products' ? (
                    <>
                      <td>{row.stock}</td>
                      <td>{row.booked}</td>
                      <td>{row.available}</td>
                    </>
                  ) : null}
                  <td>{row.count}</td>
                  <td>
                    {row.quantity} {t('rentalPcs')}
                  </td>
                  <td>{money(row.total)}</td>
                  <td>{money(row.paidAmount)}</td>
                  <td>{money(row.dueAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button type="button" onClick={downloadCsv}>
        {t('rentalExportCsv')}
      </Button>
    </section>
  )
}
