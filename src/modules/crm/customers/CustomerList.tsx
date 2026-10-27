import { useLocalization } from '../../../app/context/localization-context'
import type { Company, Contact, Customer } from '../../../core/types'
import { CustomerCard } from './CustomerCard'
import { getCustomerDisplayName } from './customer-name'
import type { CustomerDebtView } from '../../../core/services/customer-debts'

type CustomerListProps = {
  customers: Customer[]
  contacts: Contact[]
  companies: Company[]
  debtsByCustomerId?: Record<string, CustomerDebtView>
  currency?: string
  locale?: 'ru' | 'kk'
  showFinance?: boolean
  onEdit: (customer: Customer) => void
  onSetStatus: (customer: Customer) => void
  onReconciliation?: (customer: Customer) => void
}

export function CustomerList({
  customers,
  contacts,
  companies,
  debtsByCustomerId,
  currency,
  locale,
  showFinance = false,
  onEdit,
  onSetStatus,
  onReconciliation,
}: CustomerListProps) {
  const { t } = useLocalization()

  return (
    <div className="inventory-table-wrap">
      <table className="inventory-table data-table--mobile-cards">
        <thead>
          <tr>
            <th>{t('customerType')}</th>
            <th>{t('customerName')}</th>
            <th>{t('phone')}</th>
            <th>{t('email')}</th>
            <th>{t('taxId')}</th>
            {showFinance ? (
              <>
                <th>{t('customerSalesTotal')}</th>
                <th>{t('customerPaidTotal')}</th>
                <th>{t('debtAmount')}</th>
              </>
            ) : null}
            <th>{t('status')}</th>
            <th>{t('transferActions')}</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              name={getCustomerDisplayName(customer, contacts, companies)}
              phone={
                customer.contactId
                  ? (contacts.find((item) => item.id === customer.contactId)?.phone ?? '')
                  : ''
              }
              email={
                customer.contactId
                  ? (contacts.find((item) => item.id === customer.contactId)?.email ?? '')
                  : ''
              }
              finance={
                showFinance
                  ? (debtsByCustomerId?.[customer.id] ?? {
                      customerId: customer.id,
                      totalDebt: 0,
                      paidAmount: 0,
                      remainingDebt: 0,
                      overdueAmount: 0,
                      status: 'clear',
                    })
                  : undefined
              }
              currency={currency}
              locale={locale}
              onEdit={onEdit}
              onSetStatus={onSetStatus}
              onReconciliation={onReconciliation}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
