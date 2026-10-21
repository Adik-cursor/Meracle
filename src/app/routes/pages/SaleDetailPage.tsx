import { useEffect, useMemo, useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useCompanies } from '../../context/company-context'
import { useContacts } from '../../context/contact-context'
import { useCustomers } from '../../context/customer-context'
import { useInternalReceipts } from '../../context/internal-receipt-context'
import { useLocalization } from '../../context/localization-context'
import { usePayments } from '../../context/payment-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { useProducts } from '../../context/product-context'
import { useSales } from '../../context/sales-context'
import { useUsers } from '../../context/user-context'
import { useWarehouses } from '../../context/warehouse-context'
import { InternalReceiptView } from '../../../modules/sales/components/InternalReceiptView'
import { printInternalReceipt } from '../../../modules/sales/print-internal-receipt'
import { formatMoney } from '../../../modules/sales/pos-format'
import { getCustomerDisplayName } from '../../../modules/crm/customers/customer-name'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { isPhysicalProduct } from '../../../core/types/product'
import { useAppPath } from '../useAppPath'
import { getSaleIdFromPath } from '../app.routes'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { Badge, Button, Modal, Table } from '../../../shared/ui'
import type { PaymentMethod, SalePaymentStatus, SaleStatus } from '../../../core/types'
import {
  createDeliveryNoteForUser,
  createSaleInvoiceForUser,
  createSupplyContractForUser,
  downloadSaleInvoicePdf,
  generateDeliveryNotePdfForUser,
  generateSaleInvoicePdfForUser,
  generateSupplyContractPdfForUser,
  issueInternalSaleReceiptForUser,
  listDeliveryNotesForUser,
  listSaleInvoicesForUser,
  listSupplyContractsForUser,
  logSaleInvoicePdfDiagnostics,
  openSaleInvoicePdf,
} from '../../../core/services'
import { SupplyContractFormModal } from '../../../modules/sales/components/SupplyContractFormModal'
import type { TranslationKey } from '../../../core/localization/translations'

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

export function SaleDetailPage() {
  const { t, locale } = useLocalization()
  const { pathname, search, navigate } = useAppPath()
  const { currentUser, hasFinancialAccess } = useAccess()
  const { getSale, getSaleAccess } = useSales()
  const { listBySaleId } = useInternalReceipts()
  const { getSalePayments, getSalePaymentStatus, getSalePaidAmount, getSaleDueAmount } =
    usePayments()
  const { products } = useProducts()
  const { getCustomer } = useCustomers()
  const { contacts } = useContacts()
  const { companies } = useCompanies()
  const { warehouses } = useWarehouses()
  const { users } = useUsers()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const saleId = getSaleIdFromPath(pathname)
  const [error, setError] = useState<string | null>(null)
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false)
  const [contractFormOpen, setContractFormOpen] = useState(false)
  const showReceipt = new URLSearchParams(search).get('receipt') === '1'
  const canCreateReturn = hasFinancialAccess('returns.create')
  const canReadReturn = hasFinancialAccess('returns.read')
  const canRefund = hasFinancialAccess('refunds.create')
  const canIssueDocs =
    hasFinancialAccess('sales.documents.create') ||
    hasFinancialAccess('financial_documents.manage')

  const invoices = useMemo(() => {
    void version
    if (!saleId) {
      return []
    }
    const listed = listSaleInvoicesForUser(persistence, currentUser, saleId)
    return listed.ok ? listed.value.filter((item) => item.status !== 'cancelled') : []
  }, [currentUser, persistence, saleId, version])

  const deliveryNotes = useMemo(() => {
    void version
    if (!saleId) {
      return []
    }
    const listed = listDeliveryNotesForUser(persistence, currentUser, saleId)
    return listed.ok ? listed.value : []
  }, [currentUser, persistence, saleId, version])

  const supplyContracts = useMemo(() => {
    void version
    if (!saleId) {
      return []
    }
    const listed = listSupplyContractsForUser(persistence, currentUser, saleId)
    return listed.ok ? listed.value : []
  }, [currentUser, persistence, saleId, version])

  useEffect(() => {
    if (showReceipt) {
      setReceiptPreviewOpen(true)
    }
  }, [showReceipt])

  if (!currentUser) {
    return <AuthRequiredState />
  }

  if (!saleId) {
    return (
      <PagePlaceholder
        title={t('saleNotFound')}
        description={t('pageNotFoundDescription')}
      />
    )
  }

  const access = getSaleAccess(saleId)
  if (!access.ok) {
    if (access.code === 'SALE_NOT_FOUND') {
      return (
        <PagePlaceholder
          title={t('saleNotFound')}
          description={t('pageNotFoundDescription')}
        />
      )
    }

    if (access.code === 'MODULE_NOT_ENABLED') {
      return (
        <PagePlaceholder
          title={t('MODULE_NOT_ENABLED')}
          description={t('MODULE_NOT_ENABLED')}
        />
      )
    }

    return (
      <PagePlaceholder title={t('ACCESS_DENIED')} description={t('ACCESS_DENIED')} />
    )
  }

  const record = getSale(saleId)
  const sale = access.sale
  const items = record?.items ?? []
  const canReadAmount = record?.financialView?.canReadAmount === true
  const receipts = listBySaleId(sale.id)
  const invoice = invoices[0]
  const note = deliveryNotes[0]
  const supplyContract = supplyContracts[0]
  const receipt = receipts[0]
  const payments = getSalePayments(sale.id)
  const paymentStatus = getSalePaymentStatus(sale.id)
  const paidAmount = getSalePaidAmount(sale.id)
  const remainingAmount = getSaleDueAmount(sale.id)
  const method =
    sale.settlementMethod === 'on_credit' ? 'on_credit' : payments[0]?.method
  const sellerId = payments[0]?.createdBy
  const seller = sellerId ? users.find((user) => user.id === sellerId) : undefined
  const warehouse = sale.warehouseId
    ? warehouses.find((item) => item.id === sale.warehouseId)
    : undefined
  const customer = sale.customerId ? getCustomer(sale.customerId) : undefined
  const customerName = customer
    ? getCustomerDisplayName(customer, contacts, companies)
    : '—'

  const openInvoice = (mode: 'open' | 'download', invoiceId: string) => {
    void generateSaleInvoicePdfForUser(persistence, currentUser, invoiceId)
      .then((pdf) => {
        if (!pdf.ok) {
          logSaleInvoicePdfDiagnostics(`SaleDetailPage.${mode}`, pdf.error)
          setError(pdf.error.code)
          return
        }
        if (mode === 'download') {
          downloadSaleInvoicePdf(pdf.value.filename, pdf.value.bytes)
          return
        }
        openSaleInvoicePdf(pdf.value.bytes)
      })
      .catch((caught: unknown) => {
        logSaleInvoicePdfDiagnostics(`SaleDetailPage.${mode}`, caught)
        setError('INVOICE_PDF_FAILED')
      })
  }

  const openNote = (mode: 'open' | 'download', noteId: string) => {
    void generateDeliveryNotePdfForUser(persistence, currentUser, noteId)
      .then((pdf) => {
        if (!pdf.ok) {
          setError(pdf.error.code)
          return
        }
        if (mode === 'download') {
          downloadSaleInvoicePdf(pdf.value.filename, pdf.value.bytes)
          return
        }
        openSaleInvoicePdf(pdf.value.bytes)
      })
      .catch(() => setError('DELIVERY_NOTE_PDF_FAILED'))
  }

  const openContract = (mode: 'open' | 'download', contractId: string) => {
    void generateSupplyContractPdfForUser(persistence, currentUser, contractId)
      .then((pdf) => {
        if (!pdf.ok) {
          setError(pdf.error.code)
          return
        }
        if (mode === 'download') {
          downloadSaleInvoicePdf(pdf.value.filename, pdf.value.bytes)
          return
        }
        openSaleInvoicePdf(pdf.value.bytes)
      })
      .catch(() => setError('SUPPLY_CONTRACT_PDF_FAILED'))
  }

  const hasDebt = remainingAmount > 0

  return (
    <section className="workspace-page sale-detail">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">
          {t('navPosSale')} {sale.id.slice(-4).toUpperCase()}
        </h2>
        <Button onClick={() => navigate('/sales')}>{t('backToDeals')}</Button>
      </div>
      {error ? <p className="warehouse-field__error">{t(error as TranslationKey)}</p> : null}

      <dl className="sale-detail__meta">
        <div>
          <dt>{t('status')}</dt>
          <dd>
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
          </dd>
        </div>
        <div>
          <dt>{t('saleTotal')}</dt>
          <dd>{canReadAmount ? formatMoney(sale.total, locale, sale.currency) : '—'}</dd>
        </div>
        <div>
          <dt>{t('customer')}</dt>
          <dd>{customerName}</dd>
        </div>
        <div>
          <dt>{t('posSeller')}</dt>
          <dd>{seller ? userDisplayName(seller) : '—'}</dd>
        </div>
        <div>
          <dt>{t('inventoryWarehouse')}</dt>
          <dd>
            {warehouse?.name ??
              (sale.warehouseId ? sale.warehouseId : t('warehouseNotRequired'))}
          </dd>
        </div>
      </dl>

      <section className="sale-detail__cart">
        <h3>{t('saleComposition')}</h3>
        <Table className="sale-detail__cart-table">
          <thead>
            <tr>
              <th>{t('saleItems')}</th>
              <th>{t('saleQuantity')}</th>
              <th>{t('saleUnitPrice')}</th>
              <th>{t('saleTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const product = products.find((entry) => entry.id === item.productId)
              const physical = isPhysicalProduct(product)
              return (
                <tr key={item.id}>
                  <td data-label={t('saleItems')}>
                    {product?.name ?? item.productId}{' '}
                    <Badge tone={physical ? 'neutral' : 'info'}>
                      {physical ? t('itemTypeProduct') : t('itemTypeService')}
                    </Badge>
                    {canReadAmount && item.discount ? (
                      <div className="pos-history__note">
                        {t('saleDiscount')}: {formatMoney(item.discount, locale, sale.currency)}
                      </div>
                    ) : null}
                  </td>
                  <td data-label={t('saleQuantity')}>{item.quantity}</td>
                  <td data-label={t('saleUnitPrice')}>
                    {canReadAmount
                      ? formatMoney(item.unitPrice, locale, sale.currency)
                      : '—'}
                  </td>
                  <td className="is-num" data-label={t('saleTotal')}>
                    {canReadAmount ? formatMoney(item.total, locale, sale.currency) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
        <p className="sale-detail__grand-total">
          {t('saleLineTotal')}{' '}
          {canReadAmount ? formatMoney(sale.total, locale, sale.currency) : '—'}
        </p>
      </section>

      <section className="sale-detail__payment">
        <h3>{t('payment')}</h3>
        <dl className="sale-detail__payment-summary">
          <div>
            <dt>{t('status')}</dt>
            <dd>
              {canReadAmount ? t(PAYMENT_STATUS_LABEL[paymentStatus]) : '—'}
              {method ? <Badge tone={method === 'on_credit' ? 'warning' : 'info'}>{t(METHOD_LABEL[method])}</Badge> : null}
            </dd>
          </div>
          {canReadAmount && sale.settlementMethod === 'on_credit' ? (
            <>
              <div>
                <dt>{t('customerPaidTotal')}</dt>
                <dd>{formatMoney(paidAmount, locale, sale.currency)}</dd>
              </div>
              <div className="sale-detail__payment-due">
                <dt>{t('debtRemaining')}</dt>
                <dd>{formatMoney(remainingAmount, locale, sale.currency)}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </section>

      <section className="sale-detail__docs">
        <h3>{t('documentsAndActions')}</h3>

        <div className="sale-detail__doc">
          <p>{t('invoice')}</p>
          {invoice ? (
            <>
              <p className="sale-detail__doc-meta">
                {t('invoice')} №{invoice.invoiceNumber}
              </p>
              <div className="sale-detail__doc-actions">
                <Button type="button" onClick={() => openInvoice('open', invoice.id)}>
                  {t('open')}
                </Button>
                <Button type="button" onClick={() => openInvoice('download', invoice.id)}>
                  {t('downloadInvoicePdf')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="sale-detail__doc-meta">{t('invoiceNotIssued')}</p>
              {canIssueDocs ? (
                <div className="sale-detail__doc-actions">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      const created = createSaleInvoiceForUser(persistence, currentUser, {
                        saleId: sale.id,
                      })
                      setError(created.ok ? null : created.error.code)
                    }}
                  >
                    {t('createInvoice')}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="sale-detail__doc">
          <p>{t('deliveryNote')}</p>
          {note ? (
            <>
              <p className="sale-detail__doc-meta">
                {t('deliveryNote')} №{note.documentNumber}
              </p>
              <div className="sale-detail__doc-actions">
                <Button type="button" onClick={() => openNote('open', note.id)}>
                  {t('open')}
                </Button>
                <Button type="button" onClick={() => openNote('download', note.id)}>
                  {t('downloadDeliveryNotePdf')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="sale-detail__doc-meta">{t('deliveryNoteNotIssued')}</p>
              {canIssueDocs && sale.status === 'completed' ? (
                <div className="sale-detail__doc-actions">
                  <Button
                    type="button"
                    onClick={() => {
                      const created = createDeliveryNoteForUser(persistence, currentUser, {
                        saleId: sale.id,
                      })
                      setError(created.ok ? null : created.error.code)
                    }}
                  >
                    {t('createDeliveryNote')}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>

        {supplyContract || hasDebt ? (
        <div className="sale-detail__doc">
          <p>{t('supplyContract')}</p>
          {supplyContract ? (
            <>
              <p className="sale-detail__doc-meta">
                {t('supplyContract')} №{supplyContract.number}
              </p>
              <div className="sale-detail__doc-actions">
                <Button type="button" onClick={() => openContract('open', supplyContract.id)}>
                  {t('open')}
                </Button>
                <Button
                  type="button"
                  onClick={() => openContract('download', supplyContract.id)}
                >
                  {t('downloadSupplyContractPdf')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="sale-detail__doc-meta">{t('supplyContractNotIssued')}</p>
              {canIssueDocs ? (
                <div className="sale-detail__doc-actions">
                  <Button type="button" onClick={() => setContractFormOpen(true)}>
                    {t('createSupplyContract')}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
        ) : null}

        <div className="sale-detail__doc">
          <p>{t('internalReceipt')}</p>
          {receipt ? (
            <>
              <p className="sale-detail__doc-meta">
                {t('receiptNumberLabel')} {receipt.receiptNumber}
              </p>
              <div className="sale-detail__doc-actions">
                <Button
                  type="button"
                  onClick={() => {
                    setReceiptPreviewOpen(true)
                    navigate(`/sales/${sale.id}?receipt=1`)
                  }}
                >
                  {t('openReceipt')}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setReceiptPreviewOpen(true)
                    window.setTimeout(() => printInternalReceipt(), 50)
                  }}
                >
                  {t('printReceipt')}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setReceiptPreviewOpen(true)
                    window.setTimeout(() => printInternalReceipt(), 50)
                  }}
                >
                  {t('downloadReceiptPdf')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="sale-detail__doc-meta">{t('receiptNotIssued')}</p>
              <div className="sale-detail__doc-actions">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    const issued = issueInternalSaleReceiptForUser(
                      persistence,
                      currentUser,
                      sale.id,
                    )
                    if (!issued.ok) {
                      setError(issued.error.code)
                      return
                    }
                    setError(null)
                  }}
                >
                  {t('issueInternalReceipt')}
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="sale-detail__doc">
          <p>{t('posReturn')}</p>
          {sale.status === 'completed' && (canCreateReturn || canReadReturn) ? (
            <div className="sale-detail__doc-actions">
              <Button
                type="button"
                onClick={() => {
                  if (!canCreateReturn) {
                    setError('returnsCreateDenied')
                    return
                  }
                  navigate(`/sales/returns?saleId=${sale.id}`)
                }}
              >
                {t('posReturn')}
              </Button>
            </div>
          ) : (
            <p className="pos-history__note">—</p>
          )}
        </div>

        <div className="sale-detail__doc">
          <p>{t('posRefund')}</p>
          {sale.status === 'completed' && canRefund ? (
            <div className="sale-detail__doc-actions">
              <Button type="button" onClick={() => navigate('/sales/payment-refunds')}>
                {t('posRefund')}
              </Button>
            </div>
          ) : (
            <p className="pos-history__note">—</p>
          )}
        </div>
      </section>

      {contractFormOpen ? (
        <SupplyContractFormModal
          saleTotal={sale.total}
          paidAmount={paidAmount}
          remainingAmount={remainingAmount}
          defaultDate={sale.createdAt.slice(0, 10)}
          onClose={() => setContractFormOpen(false)}
          onSubmit={(draft) => {
            const created = createSupplyContractForUser(persistence, currentUser, {
              ...draft,
              saleId: sale.id,
            })
            if (!created.ok) {
              setError(created.error.code)
              return
            }
            setError(null)
            setContractFormOpen(false)
          }}
        />
      ) : null}
      {receiptPreviewOpen && receipt ? (
        <Modal
          title={`${t('receiptNumberLabel')} ${receipt.receiptNumber}`}
          onClose={() => {
            setReceiptPreviewOpen(false)
            if (showReceipt) {
              navigate(`/sales/${sale.id}`)
            }
          }}
        >
          <div className="receipt-preview">
            <InternalReceiptView
              receipt={receipt}
              locale={locale}
              onPrint={printInternalReceipt}
            />
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
