import { Fragment, useMemo, useState, type FormEvent } from 'react'
import {
  createCustomerDebtPaymentForUser,
  listCustomerDebtGroupsForUser,
  listSaleDebtRowsForUser,
  buildFinanceDebtsSheet,
  mapSaleDebtsToExportRows,
} from '../../../core/services'
import type { CustomerDebtGroup, SaleDebtRow } from '../../../core/services/customer-debts'
import { useAccess } from '../../context/access-context'
import { useCompanies } from '../../context/company-context'
import { useContacts } from '../../context/contact-context'
import { useCustomers } from '../../context/customer-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { ReconciliationStatementDialog } from '../../../modules/crm/customers/ReconciliationStatementDialog'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { Badge, Button, EmptyState, Input, Modal, Table } from '../../../shared/ui'
import { WorkbookExportButton } from '../../../shared/components/WorkbookExportButton'
import { formatMoney } from '../../../modules/sales/pos-format'
import type { TranslationKey } from '../../../core/localization/translations'

const METHODS = ['cash', 'card', 'bank_transfer', 'other'] as const

const METHOD_LABEL: Record<'cash' | 'card' | 'bank_transfer' | 'other', TranslationKey> = {
  cash: 'paymentCash',
  card: 'paymentCard',
  bank_transfer: 'paymentBankTransfer',
  other: 'paymentOther',
}

const STATUS_LABEL: Record<SaleDebtRow['status'], TranslationKey> = {
  unpaid: 'paymentUnpaid',
  partially_paid: 'paymentPartial',
  paid: 'paymentPaid',
}

type PayingTarget = {
  customerId: string
  saleId?: string
  saleNumber?: string
  remainingAmount: number
}

export function CustomerDebtsPage({ embedded = false }: { embedded?: boolean }) {
  const { t, locale } = useLocalization()
  const { settings } = useOrganization()
  const { currentUser, hasFinancialAccess } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { getCustomer } = useCustomers()
  const { getContact } = useContacts()
  const { getCompany } = useCompanies()
  const [query, setQuery] = useState('')
  const [paying, setPaying] = useState<PayingTarget | null>(null)
  const [reconcilingId, setReconcilingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash')
  const [bankName, setBankName] = useState('')
  const [accountReference, setAccountReference] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const listed = useMemo(() => {
    void version
    return listCustomerDebtGroupsForUser(persistence, currentUser)
  }, [currentUser, persistence, version])

  const saleRows = useMemo(() => {
    void version
    return listSaleDebtRowsForUser(persistence, currentUser)
  }, [currentUser, persistence, version])

  if (!currentUser) {
    return <AuthRequiredState />
  }

  if (!listed.ok) {
    return <p className="workspace-muted">{t('ACCESS_DENIED')}</p>
  }

  const customerName = (id: string) => {
    const customer = getCustomer(id)
    if (!customer) {
      return id.slice(-6)
    }
    if (customer.contactId) {
      const contact = getContact(customer.contactId)
      return contact ? `${contact.firstName} ${contact.lastName}` : id.slice(-6)
    }
    if (customer.companyId) {
      return getCompany(customer.companyId)?.name ?? id.slice(-6)
    }
    return id.slice(-6)
  }

  const canPay = hasFinancialAccess('payments.create')
  const needle = query.trim().toLowerCase()
  const groups = listed.value.filter((group) => {
    if (!needle) {
      return true
    }
    if (customerName(group.customerId).toLowerCase().includes(needle)) {
      return true
    }
    return group.sales.some((sale) => sale.saleNumber.toLowerCase().includes(needle))
  })
  const totalRemaining = groups.reduce((sum, group) => sum + group.remainingAmount, 0)
  const exportRows = saleRows.ok ? saleRows.value : []
  const debtSheet = buildFinanceDebtsSheet(
    mapSaleDebtsToExportRows(exportRows, {
      customerName,
      responsible: () => '',
    }),
  )

  const openPay = (target: PayingTarget) => {
    setPaying(target)
    setAmount(String(target.remainingAmount))
    setMethod('cash')
    setError(null)
  }

  const handlePay = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!paying) {
      return
    }
    const saved = createCustomerDebtPaymentForUser(persistence, currentUser, {
      customerId: paying.customerId,
      saleId: paying.saleId,
      amount: Number(amount),
      method,
      bankName: bankName.trim() || undefined,
      accountReference: accountReference.trim() || undefined,
      paymentReference: paymentReference.trim() || undefined,
      comment: comment.trim() || undefined,
    })
    if (!saved.ok) {
      setError(
        saved.error.code === 'PAYMENT_LIMIT_EXCEEDED'
          ? t('PAYMENT_LIMIT_EXCEEDED')
          : t('INVALID_INPUT'),
      )
      return
    }
    setPaying(null)
    setAmount('')
    setComment('')
    setPaymentReference('')
    setError(null)
  }

  const toggleGroup = (group: CustomerDebtGroup) => {
    setExpandedId((current) => (current === group.customerId ? null : group.customerId))
  }

  return (
    <section className={embedded ? 'finance-panel' : 'workspace-page'}>
      {embedded ? (
        <header className="finance-panel__intro">
          <h3>{t('financeTabDebts')}</h3>
          <WorkbookExportButton filename="finance-debts.xlsx" sheets={[debtSheet]} />
        </header>
      ) : (
        <>
          <h2 className="workspace-toolbar__title">{t('navCounterpartyDebts')}</h2>
          <WorkbookExportButton filename="finance-debts.xlsx" sheets={[debtSheet]} />
        </>
      )}
      <p className="finance-overview__period">
        {t('debtTotal')}: {formatMoney(totalRemaining, locale, settings.currency)}
      </p>
      <div className="filter-bar">
        <Input
          value={query}
          placeholder={t('navCustomers')}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {groups.length === 0 ? (
        <EmptyState title={t('debtsEmpty')} />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>{t('navCustomers')}</th>
              <th className="is-num">{t('debtSalesCount')}</th>
              <th className="is-num">{t('customerSalesTotal')}</th>
              <th className="is-num">{t('customerPaidTotal')}</th>
              <th className="is-num">{t('debtRemaining')}</th>
              <th>{t('status')}</th>
              <th>{t('transferActions')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.customerId}>
                <tr>
                  <td>{customerName(group.customerId)}</td>
                  <td className="is-num">{group.saleCount}</td>
                  <td className="is-num">{formatMoney(group.charged, locale, settings.currency)}</td>
                  <td className="is-num">{formatMoney(group.paidAmount, locale, settings.currency)}</td>
                  <td className="is-num">{formatMoney(group.remainingAmount, locale, settings.currency)}</td>
                  <td>
                    <Badge
                      tone={
                        group.status === 'paid'
                          ? 'success'
                          : group.status === 'partially_paid'
                            ? 'warning'
                            : 'danger'
                      }
                    >
                      {t(STATUS_LABEL[group.status])}
                    </Badge>
                  </td>
                  <td>
                    <div className="table-actions">
                      <Button variant="ghost" onClick={() => toggleGroup(group)}>
                        {expandedId === group.customerId ? t('debtHideDetails') : t('debtDetails')}
                      </Button>
                      <Button variant="ghost" onClick={() => setReconcilingId(group.customerId)}>
                        {t('reconciliationStatement')}
                      </Button>
                      {canPay && group.remainingAmount > 0 ? (
                        <Button
                          onClick={() =>
                            openPay({
                              customerId: group.customerId,
                              remainingAmount: group.remainingAmount,
                            })
                          }
                        >
                          {t('debtAcceptPayment')}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                {expandedId === group.customerId
                  ? (
                      <>
                        <tr className="pos-history__item">
                          <td colSpan={7}>
                            <dl className="debt-breakdown">
                              <dt>{t('debtSalesGross')}</dt>
                              <dd>{formatMoney(group.grossCharged, locale, settings.currency)}</dd>
                              <dt>{t('debtReturnsTotal')}</dt>
                              <dd>
                                {group.returnedAmount
                                  ? `−${formatMoney(group.returnedAmount, locale, settings.currency)}`
                                  : formatMoney(0, locale, settings.currency)}
                              </dd>
                              <dt>{t('customerPaidTotal')}</dt>
                              <dd>{formatMoney(group.grossPaid, locale, settings.currency)}</dd>
                              <dt>{t('debtMoneyRefunds')}</dt>
                              <dd>{formatMoney(group.refundedAmount, locale, settings.currency)}</dd>
                              <dt className="debt-breakdown__total">{t('debtRemaining')}</dt>
                              <dd className="debt-breakdown__total">
                                {formatMoney(group.remainingAmount, locale, settings.currency)}
                              </dd>
                            </dl>
                          </td>
                        </tr>
                        {group.sales.map((row) => (
                      <tr key={row.saleId} className="pos-history__item">
                        <td colSpan={2}>
                          {t('posSaleNumber')}
                          {row.saleNumber}
                        </td>
                        <td className="is-num">{formatMoney(row.charged, locale, settings.currency)}</td>
                        <td className="is-num">{formatMoney(row.paidAmount, locale, settings.currency)}</td>
                        <td className="is-num">{formatMoney(row.remainingAmount, locale, settings.currency)}</td>
                        <td>{t(STATUS_LABEL[row.status])}</td>
                        <td>
                          {canPay && row.remainingAmount > 0 ? (
                            <Button
                              onClick={() =>
                                openPay({
                                  customerId: row.customerId,
                                  saleId: row.saleId,
                                  saleNumber: row.saleNumber,
                                  remainingAmount: row.remainingAmount,
                                })
                              }
                            >
                              {t('debtAcceptPayment')}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                      </>
                    )
                  : null}
              </Fragment>
            ))}
          </tbody>
        </Table>
      )}

      {paying ? (
        <Modal title={t('debtAcceptPayment')} onClose={() => setPaying(null)}>
          <form className="settings-section" onSubmit={handlePay}>
            <p>
              {customerName(paying.customerId)}
              {paying.saleNumber ? ` · ${t('posSaleNumber')}${paying.saleNumber}` : ''}
            </p>
            <p>
              {t('debtRemaining')}:{' '}
              {formatMoney(paying.remainingAmount, locale, settings.currency)}
            </p>
            <label className="warehouse-field">
              <span className="settings-field__label">{t('paymentMethod')}</span>
              <select
                className="warehouse-input"
                value={method}
                onChange={(event) =>
                  setMethod(event.target.value as (typeof METHODS)[number])
                }
              >
                {METHODS.map((item) => (
                  <option key={item} value={item}>
                    {t(METHOD_LABEL[item])}
                  </option>
                ))}
              </select>
            </label>
            <label className="warehouse-field">
              <span className="settings-field__label">{t('paymentAmount')}</span>
              <input
                className="warehouse-input"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </label>
            <label className="warehouse-field">
              <span className="settings-field__label">{t('debtBank')}</span>
              <input
                className="warehouse-input"
                value={bankName}
                onChange={(event) => setBankName(event.target.value)}
              />
            </label>
            <label className="warehouse-field">
              <span className="settings-field__label">{t('debtAccount')}</span>
              <input
                className="warehouse-input"
                value={accountReference}
                onChange={(event) => setAccountReference(event.target.value)}
              />
            </label>
            <label className="warehouse-field">
              <span className="settings-field__label">{t('debtPaymentNumber')}</span>
              <input
                className="warehouse-input"
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
              />
            </label>
            <label className="warehouse-field">
              <span className="settings-field__label">{t('paymentComment')}</span>
              <input
                className="warehouse-input"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
            <div className="modal__actions">
              <Button type="button" variant="ghost" onClick={() => setPaying(null)}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="primary">
                {t('confirmPayment')}
              </Button>
            </div>
            {error ? <p className="field__error">{error}</p> : null}
          </form>
        </Modal>
      ) : null}

      {reconcilingId ? (
        <ReconciliationStatementDialog
          customerId={reconcilingId}
          customerName={customerName(reconcilingId)}
          onClose={() => setReconcilingId(null)}
        />
      ) : null}
    </section>
  )
}
