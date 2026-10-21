import { Fragment, useMemo, useState } from 'react'
import type { TranslationKey } from '../../../core/localization/translations'
import type { SaleRecord } from '../../../app/context/sales-context'
import { useAccess } from '../../../app/context/access-context'
import { useInternalReceipts } from '../../../app/context/internal-receipt-context'
import { usePayments } from '../../../app/context/payment-context'
import { useLocalization } from '../../../app/context/localization-context'
import { usePersistence, usePersistenceVersion } from '../../../app/context/persistence-context'
import {
  createDeliveryNoteForUser,
  createSaleInvoiceForUser,
  issueInternalSaleReceiptForUser,
  listDeliveryNotesForUser,
  listSaleInvoicesForUser,
} from '../../../core/services'
import type { Locale, PaymentMethod, Product, SalePaymentStatus, SaleStatus, User } from '../../../core/types'
import { isPhysicalProduct } from '../../../core/types/product'
import { Badge, Button, EmptyState, Table } from '../../../shared/ui'
import { formatMoney } from '../pos-format'
import { userDisplayName } from '../../crm/users/user-name'

type PosHistoryProps = {
  records: SaleRecord[]
  warehouseNameById: Record<string, string>
  productById: Record<string, Product>
  users: User[]
  locale: Locale
  onOpenSale: (saleId: string) => void
}

const STATUS_LABEL: Record<SaleStatus, TranslationKey> = {
  draft: 'saleStatusDraft',
  confirmed: 'saleStatusConfirmed',
  completed: 'saleStatusCompleted',
  cancelled: 'saleStatusCancelled',
}

const PAYMENT_STATUS_LABEL: Record<SalePaymentStatus, TranslationKey> = {
  unpaid: 'paymentUnpaid',
  partially_paid: 'paymentPartial',
  paid: 'paymentPaid',
}

const METHOD_LABEL: Record<PaymentMethod, TranslationKey> = {
  cash: 'paymentCash',
  card: 'paymentCard',
  bank_transfer: 'paymentBankTransfer',
  invoice: 'paymentInvoice',
  on_credit: 'paymentOnCredit',
  other: 'paymentOther',
}

function formatDate(isoDate: string, locale: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return isoDate
  }

  return date.toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')
}

export function PosHistory({
  records,
  warehouseNameById,
  productById,
  users,
  locale,
  onOpenSale,
}: PosHistoryProps) {
  const { t } = useLocalization()
  const { currentUser, hasFinancialAccess } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { listBySaleId } = useInternalReceipts()
  const { getSalePayments, getSalePaymentStatus, getSalePaidAmount, getSaleDueAmount } = usePayments()
  const userById = Object.fromEntries(users.map((user) => [user.id, user]))
  const [selectedSaleId, setSelectedSaleId] = useState('')
  const [expandedSaleIds, setExpandedSaleIds] = useState<Record<string, boolean>>({})
  const [docsError, setDocsError] = useState<string | null>(null)
  const canIssueDocs =
    hasFinancialAccess('sales.documents.create') ||
    hasFinancialAccess('financial_documents.manage')
  const invoicesBySaleId = useMemo(() => {
    void version
    const listed = listSaleInvoicesForUser(persistence, currentUser)
    const map = new Map<string, string>()
    if (listed.ok) {
      for (const invoice of listed.value) {
        if (invoice.status !== 'cancelled' && !map.has(invoice.saleId)) {
          map.set(invoice.saleId, invoice.invoiceNumber)
        }
      }
    }
    return map
  }, [currentUser, persistence, version])
  const notesBySaleId = useMemo(() => {
    void version
    const listed = listDeliveryNotesForUser(persistence, currentUser)
    const map = new Map<string, string>()
    if (listed.ok) {
      for (const note of listed.value) {
        if (!map.has(note.saleId)) {
          map.set(note.saleId, note.documentNumber)
        }
      }
    }
    return map
  }, [currentUser, persistence, version])

  if (records.length === 0) {
    return <EmptyState title={t('noSales')} />
  }

  return (
    <div className="pos-history">
      {docsError ? <p className="pos-ticket__error">{t(docsError as TranslationKey)}</p> : null}
      <Table className="pos-history__table">
        <thead>
          <tr>
            <th>{t('posSaleNumber')}</th>
            <th>{t('movementDate')}</th>
            <th>{t('posSeller')}</th>
            <th>{t('inventoryWarehouse')}</th>
            <th>{t('saleTotal')}</th>
            <th>{t('status')}</th>
            <th>{t('payment')}</th>
            <th>{t('documents')}</th>
            <th>{t('transferActions')}</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const { sale, financialView } = record
            const canReadAmount = financialView?.canReadAmount === true
            const payments = getSalePayments(sale.id)
            const sellerId = payments[0]?.createdBy
            const seller = sellerId ? userById[sellerId] : undefined
            const paymentStatus = getSalePaymentStatus(sale.id)
            const paidAmount = getSalePaidAmount(sale.id)
            const remainingAmount = getSaleDueAmount(sale.id)
            const method =
              sale.settlementMethod === 'on_credit'
                ? 'on_credit'
                : payments[0]?.method

            const hasPhysical = record.items.some((item) =>
              isPhysicalProduct(productById[item.productId]),
            )
            const hasService = record.items.some(
              (item) => !isPhysicalProduct(productById[item.productId]),
            )

            return (
              <Fragment key={sale.id}>
              <tr
                className={[
                  'pos-history__row',
                  selectedSaleId === sale.id ? 'is-selected' : '',
                  expandedSaleIds[sale.id] ? 'is-expanded' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedSaleId(sale.id)}
              >
                <td data-label={t('posSaleNumber')}>
                  <Button
                    className="pos-history__compact-btn"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedSaleId(sale.id)
                      onOpenSale(sale.id)
                    }}
                  >
                    {sale.id.slice(-4).toUpperCase()}
                  </Button>
                  {sale.note ? (
                    <div className="pos-history__note">{sale.note}</div>
                  ) : null}
                </td>
                <td data-label={t('movementDate')}>{formatDate(sale.createdAt, locale)}</td>
                <td data-label={t('posSeller')}>{seller ? userDisplayName(seller) : '—'}</td>
                <td data-label={t('inventoryWarehouse')}>
                  {sale.warehouseId
                    ? (warehouseNameById[sale.warehouseId] ?? sale.warehouseId)
                    : t('warehouseNotRequired')}
                  {hasPhysical && hasService ? (
                    <>
                      {' · '}
                      {t('mixedSale')}
                    </>
                  ) : null}
                </td>
                <td className="is-num" data-label={t('saleTotal')}>
                  {canReadAmount
                    ? formatMoney(sale.total, locale, sale.currency)
                    : '—'}
                </td>
                <td data-label={t('status')}>
                  <Badge
                    tone={
                      sale.status === 'completed'
                        ? 'success'
                        : sale.status === 'cancelled'
                          ? 'danger'
                          : sale.status === 'confirmed'
                            ? 'info'
                            : 'neutral'
                    }
                  >
                    {t(STATUS_LABEL[sale.status])}
                  </Badge>
                </td>
                <td data-label={t('payment')}>
                  {canReadAmount ? (
                    <>
                      {t(PAYMENT_STATUS_LABEL[paymentStatus])}
                      {method ? ` · ${t(METHOD_LABEL[method])}` : ''}
                      {sale.settlementMethod === 'on_credit' ? (
                        <div className="pos-history__note">
                          {t('customerPaidTotal')}:{' '}
                          {formatMoney(paidAmount, locale, sale.currency)}
                          {' · '}
                          {t('debtRemaining')}:{' '}
                          {formatMoney(remainingAmount, locale, sale.currency)}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="pos-history__docs-cell" data-label={t('documents')}>
                  <div className="pos-history__docs">
                    {invoicesBySaleId.has(sale.id) ? (
                      <Button
                        type="button"
                        className="pos-history__compact-btn"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenSale(sale.id)
                        }}
                      >
                        {t('invoice')}
                      </Button>
                    ) : canIssueDocs ? (
                      <Button
                        type="button"
                        className="pos-history__compact-btn"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!currentUser) {
                            return
                          }
                          const created = createSaleInvoiceForUser(persistence, currentUser, {
                            saleId: sale.id,
                          })
                          setDocsError(created.ok ? null : created.error.code)
                        }}
                      >
                        {t('createInvoice')}
                      </Button>
                    ) : null}
                    {notesBySaleId.has(sale.id) ? (
                      <Button
                        type="button"
                        className="pos-history__compact-btn"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenSale(sale.id)
                        }}
                      >
                        {t('deliveryNote')}
                      </Button>
                    ) : canIssueDocs && sale.status === 'completed' ? (
                      <Button
                        type="button"
                        className="pos-history__compact-btn"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!currentUser) {
                            return
                          }
                          const created = createDeliveryNoteForUser(persistence, currentUser, {
                            saleId: sale.id,
                          })
                          setDocsError(created.ok ? null : created.error.code)
                        }}
                      >
                        {t('createDeliveryNote')}
                      </Button>
                    ) : null}
                    {listBySaleId(sale.id)[0] ? (
                      <Button
                        type="button"
                        className="pos-history__compact-btn"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenSale(sale.id)
                        }}
                      >
                        {t('internalReceipt')}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="pos-history__compact-btn"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!currentUser) {
                            return
                          }
                          const issued = issueInternalSaleReceiptForUser(
                            persistence,
                            currentUser,
                            sale.id,
                          )
                          setDocsError(issued.ok ? null : issued.error.code)
                        }}
                      >
                        {t('issueInternalReceipt')}
                      </Button>
                    )}
                  </div>
                </td>
                <td className="pos-history__actions-cell" data-label={t('transferActions')}>
                  <div className="pos-history__actions">
                    <Button
                      className="pos-history__compact-btn"
                      onClick={(event) => {
                        event.stopPropagation()
                        setExpandedSaleIds((current) => ({
                          ...current,
                          [sale.id]: !current[sale.id],
                        }))
                      }}
                    >
                      {`${t('saleItems')} (${record.items.length})`}
                    </Button>
                  </div>
                </td>
              </tr>
              {expandedSaleIds[sale.id] ? (
                <tr className="pos-history__items-row">
                  <td colSpan={9}>
                    <div className="pos-history__items">
                      <div className="pos-history__items-title">{t('saleItemsInSale')}</div>
                      {record.items.map((item) => {
                        const product = productById[item.productId]
                        const physical = isPhysicalProduct(product)
                        return (
                          <div key={item.id} className="pos-history__item-line">
                            <span className="pos-history__item-name">
                              {product?.name ?? item.productId}{' '}
                              <Badge tone={physical ? 'neutral' : 'info'}>
                                {physical
                                  ? t('itemTypeProduct')
                                  : t('itemTypeService')}
                              </Badge>
                            </span>
                            <span>
                              {item.quantity} ×{' '}
                              {canReadAmount
                                ? formatMoney(item.unitPrice, locale, sale.currency)
                                : '—'}
                            </span>
                            <span className="is-num">
                              {canReadAmount
                                ? formatMoney(item.total, locale, sale.currency)
                                : '—'}
                            </span>
                            {canReadAmount && item.discount ? (
                              <span className="pos-history__item-discount">
                                {t('saleDiscount')}:{' '}
                                {formatMoney(item.discount, locale, sale.currency)}
                              </span>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}
