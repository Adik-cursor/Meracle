import type { InternalReceipt, Locale } from '../../../core/types'
import { useLocalization } from '../../../app/context/localization-context'
import { useOrganization } from '../../../app/context/organization-context'
import { usePersistence } from '../../../app/context/persistence-context'
import { useUsers } from '../../../app/context/user-context'
import { useWarehouses } from '../../../app/context/warehouse-context'
import { Button } from '../../../shared/ui'
import { userDisplayName } from '../../crm/users/user-name'
import { getCustomerDisplayName } from '../../crm/customers/customer-name'
import { printInternalReceipt } from '../print-internal-receipt'

type InternalReceiptViewProps = {
  receipt: InternalReceipt
  locale: Locale
  onPrint?: () => void
}

function methodKey(method: InternalReceipt['paymentMethod']) {
  if (method === 'cash') {
    return 'paymentCash' as const
  }
  if (method === 'card') {
    return 'paymentCard' as const
  }
  if (method === 'bank_transfer') {
    return 'paymentBankTransfer' as const
  }
  if (method === 'invoice') {
    return 'paymentInvoice' as const
  }
  if (method === 'other') {
    return 'paymentOther' as const
  }
  return 'paymentMethod' as const
}

function formatDate(isoDate: string, locale: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return isoDate
  }

  return date.toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')
}

function formatReceiptMoney(value: number, locale: Locale, currency: string): string {
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'
  const amount = value.toLocaleString(numberLocale)
  if (currency === 'KZT') {
    return `${amount} ₸`
  }

  return `${amount} ${currency}`
}

function formatSaleNumber(saleId: string): string {
  return saleId.slice(-6).toUpperCase()
}

export function InternalReceiptView({
  receipt,
  locale,
  onPrint = printInternalReceipt,
}: InternalReceiptViewProps) {
  const { t } = useLocalization()
  const { organization } = useOrganization()
  const persistence = usePersistence()
  const { users } = useUsers()
  const { warehouses } = useWarehouses()
  const cashier = users.find((user) => user.id === receipt.cashierId)
  const warehouse = receipt.warehouseId
    ? warehouses.find((item) => item.id === receipt.warehouseId)
    : undefined
  const org = persistence.organizations.getById(receipt.organizationId)
  const companyName = org?.legalName?.trim() || org?.name.trim() || organization.name
  const orgTaxId = org?.taxId?.trim() || org?.bin?.trim()
  const sale = persistence.sales.getById(receipt.saleId)
  const customer = sale?.customerId
    ? persistence.customers.getById(sale.customerId)
    : undefined
  const contacts = persistence.contacts.list(receipt.organizationId)
  const customerName = customer
    ? getCustomerDisplayName(customer, contacts, [])
    : ''
  const taxLabel = customer?.type === 'company' ? t('bin') : t('iin')
  const saleTotal = sale?.total ?? receipt.subtotal

  return (
    <div className="pos-receipt-sheet">
      <div className="internal-receipt__actions">
        <Button variant="primary" onClick={onPrint}>
          {t('printReceipt')}
        </Button>
      </div>
      <article className="internal-receipt" id="internal-receipt-print">
        <header className="internal-receipt__header">
          <p className="internal-receipt__brand">{companyName}</p>
          {orgTaxId ? (
            <p>
              {t('bin')}: {orgTaxId}
            </p>
          ) : null}
          {org?.legalAddress ? <p>{org.legalAddress}</p> : null}
          <h2>
            {receipt.receiptType === 'return'
              ? t('returnReceiptTitle')
              : t('saleReceiptTitle')}
          </h2>
          <p>
            {t('receiptNumberLabel')} {receipt.receiptNumber}
          </p>
          <p>
            {t('receiptDateTime')}: {formatDate(receipt.createdAt, locale)}
          </p>
          <p>
            {t('posSeller')}: {cashier ? userDisplayName(cashier) : receipt.cashierId}
          </p>
          {warehouse ? (
            <p>
              {t('inventoryWarehouse')}: {warehouse.name}
            </p>
          ) : null}
          <p>
            {t('posSaleNumber')} {formatSaleNumber(receipt.saleId)}
          </p>
          {customerName ? (
            <p>
              {t('customer')}: {customerName}
            </p>
          ) : null}
          {customer?.taxId ? (
            <p>
              {taxLabel}: {customer.taxId}
            </p>
          ) : null}
        </header>

        <div className="internal-receipt__rule" aria-hidden="true" />

        <ul className="internal-receipt__lines">
          {receipt.items.map((item, index) => (
            <li key={`${item.productId}-${index}`} className="internal-receipt__line">
              <p className="internal-receipt__item-name">{item.name}</p>
              <p className="internal-receipt__item-meta">
                {t('sku')}: {item.sku}
              </p>
              <div className="internal-receipt__item-row">
                <span>
                  {item.quantity} × {formatReceiptMoney(item.unitPrice, locale, receipt.currency)}
                </span>
                <span>{formatReceiptMoney(item.total, locale, receipt.currency)}</span>
              </div>
              {item.discount > 0 ? (
                <p className="internal-receipt__item-meta">
                  {t('saleDiscount')}: {formatReceiptMoney(item.discount, locale, receipt.currency)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="internal-receipt__rule" aria-hidden="true" />

        <div className="internal-receipt__totals">
          <p>
            <span>{t('saleSubtotal')}</span>
            <span>{formatReceiptMoney(receipt.subtotal, locale, receipt.currency)}</span>
          </p>
          <p>
            <span>{t('saleDiscount')}</span>
            <span>{formatReceiptMoney(receipt.discount, locale, receipt.currency)}</span>
          </p>
          <p className="internal-receipt__due">
            <span>{t('saleAmountLabel')}</span>
            <span>{formatReceiptMoney(saleTotal, locale, receipt.currency)}</span>
          </p>
          <p className="internal-receipt__due">
            <span>{t('receiptPaidAmount')}</span>
            <span>{formatReceiptMoney(receipt.total, locale, receipt.currency)}</span>
          </p>
        </div>

        {receipt.paymentMethod ? (
          <div className="internal-receipt__payment">
            <p>
              {t('paymentMethod')}: {t(methodKey(receipt.paymentMethod))}
              {receipt.methodDetail ? ` · ${receipt.methodDetail}` : ''}
            </p>
            {receipt.tenderedAmount != null ? (
              <p className="internal-receipt__item-row">
                <span>{t('posTendered')}</span>
                <span>
                  {formatReceiptMoney(receipt.tenderedAmount, locale, receipt.currency)}
                </span>
              </p>
            ) : null}
            {receipt.changeAmount != null ? (
              <p className="internal-receipt__item-row">
                <span>{t('posChange')}</span>
                <span>
                  {formatReceiptMoney(receipt.changeAmount, locale, receipt.currency)}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        {receipt.comment ? (
          <p className="internal-receipt__comment">
            {t('saleComment')}: {receipt.comment}
          </p>
        ) : null}

        {receipt.referenceReceiptId ? (
          <p>
            {t('referenceReceipt')}: {formatSaleNumber(receipt.referenceSaleId ?? '')}
          </p>
        ) : null}

        <footer className="internal-receipt__footer">
          <div className="internal-receipt__rule" aria-hidden="true" />
          <p>{t('receiptInternalNote')}</p>
          <p>{t('receiptThanks')}</p>
        </footer>
      </article>
    </div>
  )
}
