import { useMemo } from 'react'
import {
  buildFinancePaymentsSheet,
  listCustomerDebtPaymentsForUser,
  mapDebtPaymentsToExportRows,
} from '../../../core/services'
import { useAccess } from '../../context/access-context'
import { useCompanies } from '../../context/company-context'
import { useContacts } from '../../context/contact-context'
import { useCustomers } from '../../context/customer-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { useUsers } from '../../context/user-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { EmptyState, Table } from '../../../shared/ui'
import { WorkbookExportButton } from '../../../shared/components/WorkbookExportButton'
import { formatMoney } from '../../../modules/sales/pos-format'
import { userDisplayName } from '../../../modules/crm/users/user-name'

export function CustomerDebtJournalPage({ embedded = false }: { embedded?: boolean }) {
  const { t, locale } = useLocalization()
  const { settings } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { getCustomer } = useCustomers()
  const { getContact } = useContacts()
  const { getCompany } = useCompanies()
  const { getUser } = useUsers()

  const listed = useMemo(() => {
    void version
    return listCustomerDebtPaymentsForUser(persistence, currentUser)
  }, [currentUser, persistence, version])

  if (!currentUser) {
    return <AuthRequiredState />
  }

  if (!listed.ok) {
    return <p className="workspace-muted">{t('ACCESS_DENIED')}</p>
  }

  const customerName = (id: string) => {
    const customer = getCustomer(id)
    if (customer?.contactId) {
      const contact = getContact(customer.contactId)
      return contact ? `${contact.firstName} ${contact.lastName}` : id.slice(-6)
    }
    if (customer?.companyId) {
      return getCompany(customer.companyId)?.name ?? id.slice(-6)
    }
    return id.slice(-6)
  }

  return (
    <section className={embedded ? 'finance-panel' : 'workspace-page'}>
      {embedded ? (
        <header className="finance-panel__intro">
          <h3>{t('financeTabPayments')}</h3>
          <WorkbookExportButton
            filename="finance-payments.xlsx"
            sheets={[
              buildFinancePaymentsSheet(
                mapDebtPaymentsToExportRows(listed.value, {
                  customerName,
                  responsibleName: (userId) => {
                    const actor = getUser(userId)
                    return actor ? userDisplayName(actor) : userId.slice(-6)
                  },
                  currency: settings.currency,
                }),
              ),
            ]}
          />
        </header>
      ) : (
        <>
        <h2 className="workspace-toolbar__title">{t('navDebtJournal')}</h2>
        <WorkbookExportButton
          filename="finance-payments.xlsx"
          sheets={[
            buildFinancePaymentsSheet(
              mapDebtPaymentsToExportRows(listed.value, {
                customerName,
                responsibleName: (userId) => {
                  const actor = getUser(userId)
                  return actor ? userDisplayName(actor) : userId.slice(-6)
                },
                currency: settings.currency,
              }),
            ),
          ]}
        />
        </>
      )}
      {listed.value.length === 0 ? (
        <EmptyState title={t('debtJournalEmpty')} />
      ) : (
        <Table mobileLayout="cards">
          <thead>
            <tr>
              <th>{t('movementDate')}</th>
              <th>{t('navCustomers')}</th>
              <th>{t('navEmployees')}</th>
              <th>{t('paymentAmount')}</th>
              <th>{t('payment')}</th>
              <th>{t('debtBank')}</th>
              <th>{t('debtPaymentNumber')}</th>
              <th>{t('paymentComment')}</th>
              <th>{t('debtRemaining')}</th>
            </tr>
          </thead>
          <tbody>
            {listed.value.map((row) => {
              const actor = getUser(row.actorUserId)
              return (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')}</td>
                  <td>{customerName(row.customerId)}</td>
                  <td>{actor ? userDisplayName(actor) : row.actorUserId.slice(-6)}</td>
                  <td>{formatMoney(row.amount, locale, settings.currency)}</td>
                  <td>{row.method}</td>
                  <td>{row.bankName ?? '—'}</td>
                  <td>{row.paymentReference ?? '—'}</td>
                  <td>{row.comment ?? '—'}</td>
                  <td>{formatMoney(row.remainingAfter, locale, settings.currency)}</td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
    </section>
  )
}
