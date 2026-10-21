import { useState } from 'react'
import type { Locale, PaymentMethod, Product, SaleInvoice } from '../../../core/types'
import { isPhysicalProduct } from '../../../core/types/product'
import { useLocalization } from '../../../app/context/localization-context'
import type { SaleItemDraft } from '../../../app/context/sales-context'
import { Button, Input, Modal, Select } from '../../../shared/ui'
import { calcLineTotal, calcSaleTotals } from '../sale-stock'
import { formatMoney } from '../pos-format'

const METHODS: PaymentMethod[] = ['cash', 'card', 'bank_transfer', 'other', 'on_credit']

const POS_BANKS = ['Kaspi', 'Halyk', 'Jusan', 'Freedom', 'Forte'] as const

type PosTicketProps = {
  items: SaleItemDraft[]
  products: Product[]
  customerName: string
  customerTaxId: string
  method: PaymentMethod
  tenderedInput: string
  comment: string
  bankName: string
  terminalName: string
  accountReference: string
  paymentReference: string
  paymentComment: string
  methodDetail: string
  locale: Locale
  currency: string
  error: string | null
  invoiceHint: string | null
  canPay: boolean
  canConfirmPayment: boolean
  canSettleOnCredit: boolean
  canIssueInvoice: boolean
  canManageInvoice: boolean
  insufficientFunds: boolean
  hasCustomer: boolean
  dueDate: string
  invoice: SaleInvoice | null
  getAvailable: (productId: string) => number
  onMethodChange: (method: PaymentMethod) => void
  onTenderedChange: (value: string) => void
  onCommentChange: (value: string) => void
  onDueDateChange: (value: string) => void
  onBankNameChange: (value: string) => void
  onTerminalNameChange: (value: string) => void
  onAccountReferenceChange: (value: string) => void
  onPaymentReferenceChange: (value: string) => void
  onPaymentCommentChange: (value: string) => void
  onMethodDetailChange: (value: string) => void
  onQuantityChange: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
  onPriceChange: (productId: string, unitPrice: number) => void
  onDiscountChange: (productId: string, discount: number) => void
  canEditPrice: boolean
  onPay: () => void
  onIssueInvoice: () => void
  onOpenInvoice: () => void
  onDownloadInvoice: () => void
  onOpenCustomer?: () => void
  onCloseCart?: () => void
}

function methodLabel(method: PaymentMethod) {
  if (method === 'cash') {
    return 'paymentCash' as const
  }
  if (method === 'card') {
    return 'paymentCard' as const
  }
  if (method === 'bank_transfer') {
    return 'paymentBankTransfer' as const
  }
  if (method === 'on_credit') {
    return 'paymentOnCredit' as const
  }
  if (method === 'invoice') {
    return 'paymentInvoice' as const
  }
  return 'paymentOther' as const
}

function invoiceStatusLabel(status: SaleInvoice['status']) {
  if (status === 'paid') {
    return 'invoiceStatusPaid' as const
  }
  if (status === 'cancelled') {
    return 'invoiceStatusCancelled' as const
  }
  return 'invoiceStatusIssued' as const
}

export function PosTicket({
  items,
  products,
  customerName,
  customerTaxId,
  method,
  tenderedInput,
  comment,
  bankName,
  terminalName,
  accountReference,
  paymentReference,
  paymentComment,
  methodDetail,
  locale,
  currency,
  error,
  invoiceHint,
  canPay,
  canConfirmPayment,
  canSettleOnCredit,
  canIssueInvoice,
  canManageInvoice,
  insufficientFunds,
  hasCustomer,
  dueDate,
  invoice,
  getAvailable,
  onMethodChange,
  onTenderedChange,
  onCommentChange,
  onDueDateChange,
  onBankNameChange,
  onTerminalNameChange,
  onAccountReferenceChange,
  onPaymentReferenceChange,
  onPaymentCommentChange,
  onMethodDetailChange,
  onQuantityChange,
  onRemove,
  onPriceChange,
  onDiscountChange,
  canEditPrice,
  onPay,
  onIssueInvoice,
  onOpenInvoice,
  onDownloadInvoice,
  onOpenCustomer,
  onCloseCart,
}: PosTicketProps) {
  const { t } = useLocalization()
  const [payOpen, setPayOpen] = useState(false)
  const lineTotals = items.map((item) =>
    calcLineTotal(item.quantity, item.unitPrice, item.discount),
  )
  const totals = calcSaleTotals(lineTotals, 0)
  const grossSubtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  )
  const lineDiscountTotal = items.reduce((sum, item) => sum + item.discount, 0)
  const tendered = Number(tenderedInput)
  const paid = Number.isFinite(tendered) && tendered > 0 ? tendered : 0
  const change = Math.max(0, Math.round((paid - totals.total) * 100) / 100)

  return (
    <aside className="pos-ticket">
      <div className="pos-ticket__head">
        <div className="pos-ticket__head-row">
          <h2 className="pos-pane__title">{t('posOpenCart')}</h2>
          {onCloseCart ? (
            <button type="button" className="pos-ticket__close" onClick={onCloseCart}>
              {t('posCloseCart')}
            </button>
          ) : null}
        </div>
        {hasCustomer ? (
          <p className="pos-ticket__customer">
            {customerName}
            {customerTaxId ? ` · ${customerTaxId}` : ''}
          </p>
        ) : null}
      </div>

      <div className="pos-ticket__items">
        {items.length === 0 ? (
          <p className="pos-ticket__empty">{t('posEmptyCart')}</p>
        ) : (
          items.map((item) => {
            const product = products.find((entry) => entry.id === item.productId)
            const physical = isPhysicalProduct(product)
            const available = getAvailable(item.productId)
            const lineTotal = calcLineTotal(
              item.quantity,
              item.unitPrice,
              item.discount,
            )
            const subtotal = item.quantity * item.unitPrice

            return (
              <article key={item.productId} className="pos-line">
                <div className="pos-line__top">
                  <div className="pos-line__identity">
                    <span className="pos-line__name">
                      {product?.name ?? item.productId}
                    </span>
                    <span className="pos-line__sku">SKU: {product?.sku ?? '—'}</span>
                  </div>
                  <button
                    type="button"
                    className="pos-line__remove"
                    onClick={() => onRemove(item.productId)}
                  >
                    {t('removeSaleItem')}
                  </button>
                </div>
                <div className="pos-line__meta">
                  <div className="pos-line__controls">
                    <button
                      type="button"
                      className="pos-qty"
                      onClick={() => onQuantityChange(item.productId, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="pos-qty__value">{item.quantity}</span>
                    <button
                      type="button"
                      className="pos-qty"
                      disabled={physical && item.quantity >= available}
                      onClick={() => onQuantityChange(item.productId, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <Input
                    className="pos-line__price-input"
                    type="number"
                    min="0"
                    step="any"
                    value={item.unitPrice}
                    disabled={!canEditPrice}
                    aria-label={t('salePrice')}
                    onChange={(event) =>
                      onPriceChange(item.productId, Number(event.target.value))
                    }
                  />
                  <strong className="pos-line__sum">
                    {formatMoney(lineTotal, locale, currency)}
                  </strong>
                </div>
                {canEditPrice ? (
                  <label className="pos-line__discount">
                    <span className="pos-line__field-label">{t('saleDiscount')}</span>
                    <Input
                      className="pos-line__discount-input"
                      type="number"
                      min="0"
                      max={subtotal}
                      step="any"
                      value={item.discount}
                      aria-label={t('saleDiscount')}
                      onChange={(event) =>
                        onDiscountChange(item.productId, Number(event.target.value))
                      }
                    />
                  </label>
                ) : null}
              </article>
            )
          })
        )}
      </div>

      {items.length > 0 ? (
        <details className="pos-ticket__comment-fold">
          <summary>{comment.trim() ? comment : t('saleComment')}</summary>
          <Input
            name="saleComment"
            value={comment}
            placeholder={t('saleCommentPlaceholder')}
            onChange={(event) => onCommentChange(event.target.value)}
          />
        </details>
      ) : null}

      <div className="pos-ticket__summary">
        <div className="pos-totals">
          <div className="pos-totals__row">
            <span>{t('saleSubtotal')}</span>
            <span>{formatMoney(grossSubtotal, locale, currency)}</span>
          </div>
          <div className="pos-totals__row">
            <span>{t('saleDiscount')}</span>
            <span>{formatMoney(lineDiscountTotal, locale, currency)}</span>
          </div>
          <div className="pos-totals__row pos-totals__row--due">
            <span>{t('saleTotal')}</span>
            <span>{formatMoney(totals.total, locale, currency)}</span>
          </div>
        </div>
        {invoice ? (
          <div className="pos-invoice">
            <p>
              {t('invoice')} №{invoice.invoiceNumber} ·{' '}
              {t(invoiceStatusLabel(invoice.status))}
            </p>
            <div className="pos-ticket__invoice-actions">
              <Button
                type="button"
                disabled={false}
                aria-disabled={false}
                onClick={() => onOpenInvoice()}
              >
                {t('openInvoice')}
              </Button>
              <Button
                type="button"
                disabled={false}
                aria-disabled={false}
                onClick={() => onDownloadInvoice()}
              >
                {t('downloadInvoicePdf')}
              </Button>
            </div>
          </div>
        ) : null}
        {!invoice && !hasCustomer && items.length > 0 && canManageInvoice ? (
          <p className="pos-ticket__hint">{t('invoiceCustomerRequired')}</p>
        ) : null}
        {invoiceHint ? <p className="pos-ticket__hint">{invoiceHint}</p> : null}
        {hasCustomer && !customerTaxId && canManageInvoice && onOpenCustomer ? (
          <Button onClick={onOpenCustomer}>{t('openCustomer')}</Button>
        ) : null}
        {error ? <p className="pos-ticket__error">{error}</p> : null}
        <div className="pos-ticket__actions">
          {canManageInvoice && !invoice ? (
            <Button disabled={!canIssueInvoice} onClick={onIssueInvoice}>
              {t('issueInvoice')}
            </Button>
          ) : null}
          {canManageInvoice && invoice ? (
            <Button
              type="button"
              disabled={false}
              aria-disabled={false}
              onClick={() => onOpenInvoice()}
            >
              {t('openInvoice')}
            </Button>
          ) : null}
          <Button
            variant="primary"
            className="pos-pay"
            disabled={!canPay}
            onClick={() => setPayOpen(true)}
          >
            {t('posPay')}
          </Button>
        </div>
      </div>

      {payOpen ? (
        <Modal title={t('posPay')} onClose={() => setPayOpen(false)}>
          <div className="pos-pay-dialog">
            <div className="pos-pay-dialog__due">
              <span>{t('saleTotal')}</span>
              <strong>{formatMoney(totals.total, locale, currency)}</strong>
            </div>
            <div className="pos-ticket__field">
              <span className="pos-ticket__label">{t('paymentMethod')}</span>
              <div className="pos-methods">
                {METHODS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={
                      method === item ? 'pos-method pos-method--active' : 'pos-method'
                    }
                    aria-pressed={method === item}
                    onClick={() => onMethodChange(item)}
                  >
                    {t(methodLabel(item))}
                  </button>
                ))}
              </div>
            </div>
            {method === 'card' ? (
              <div className="pos-ticket__extras">
                <Select
                  name="bankName"
                  value={bankName}
                  onChange={(event) => onBankNameChange(event.target.value)}
                >
                  <option value="">{t('selectBank')}</option>
                  {POS_BANKS.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                  <option value="other">{t('paymentBankOther')}</option>
                </Select>
                <Input
                  name="terminalName"
                  value={terminalName}
                  onChange={(event) => onTerminalNameChange(event.target.value)}
                />
              </div>
            ) : null}
            {method === 'bank_transfer' ? (
              <div className="pos-ticket__extras">
                <Select
                  name="transferBank"
                  value={bankName}
                  onChange={(event) => onBankNameChange(event.target.value)}
                >
                  <option value="">{t('selectBank')}</option>
                  {POS_BANKS.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                  <option value="other">{t('paymentBankOther')}</option>
                </Select>
                <Input
                  name="accountReference"
                  value={accountReference}
                  onChange={(event) => onAccountReferenceChange(event.target.value)}
                />
                <Input
                  name="paymentReference"
                  value={paymentReference}
                  onChange={(event) => onPaymentReferenceChange(event.target.value)}
                />
              </div>
            ) : null}
            {method === 'other' ? (
              <Input
                name="methodDetail"
                value={methodDetail}
                placeholder={t('otherMethodName')}
                onChange={(event) => onMethodDetailChange(event.target.value)}
              />
            ) : null}
            {method === 'on_credit' ? (
              <>
                <div className="pos-totals__row">
                  <span>{t('navCustomers')}</span>
                  <span>{customerName || '—'}</span>
                </div>
                <div className="pos-totals__row">
                  <span>{t('saleTotal')}</span>
                  <span>{formatMoney(totals.total, locale, currency)}</span>
                </div>
                <div className="pos-totals__row">
                  <span>{t('payNowAmount')}</span>
                  <span>{formatMoney(0, locale, currency)}</span>
                </div>
                <div className="pos-totals__row pos-totals__row--due">
                  <span>{t('debtAmount')}</span>
                  <span>{formatMoney(totals.total, locale, currency)}</span>
                </div>
                <label className="pos-ticket__field">
                  <span className="pos-ticket__label">{t('debtDueDate')}</span>
                  <Input
                    type="date"
                    name="dueDate"
                    value={dueDate}
                    onChange={(event) => onDueDateChange(event.target.value)}
                  />
                </label>
                <Input
                  name="paymentComment"
                  value={paymentComment}
                  placeholder={t('saleCommentPlaceholder')}
                  onChange={(event) => onPaymentCommentChange(event.target.value)}
                />
                {!hasCustomer ? (
                  <p className="pos-ticket__error">{t('saleOnCreditCustomerRequired')}</p>
                ) : null}
                <Button
                  variant="primary"
                  className="pos-pay"
                  disabled={!hasCustomer || !canSettleOnCredit}
                  onClick={() => {
                    onPay()
                    setPayOpen(false)
                  }}
                >
                  {t('confirmOnCredit')}
                </Button>
              </>
            ) : (
              <>
                <Input
                  name="paymentComment"
                  value={paymentComment}
                  placeholder={t('paymentComment')}
                  onChange={(event) => onPaymentCommentChange(event.target.value)}
                />
                <label className="pos-ticket__field">
                  <span className="pos-ticket__label">{t('posTendered')}</span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    name="tendered"
                    value={tenderedInput}
                    onChange={(event) => onTenderedChange(event.target.value)}
                  />
                </label>
                <div className="pos-pay-dialog__change">
                  <span>{t('posChange')}</span>
                  <strong>{formatMoney(change, locale, currency)}</strong>
                </div>
                {insufficientFunds ? (
                  <p className="pos-ticket__error">{t('posInsufficientFunds')}</p>
                ) : null}
                <Button
                  variant="primary"
                  className="pos-pay"
                  disabled={insufficientFunds || !canConfirmPayment}
                  onClick={() => {
                    onPay()
                    setPayOpen(false)
                  }}
                >
                  {t('confirmPayment')}
                </Button>
              </>
            )}
          </div>
        </Modal>
      ) : null}
    </aside>
  )
}
