import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useInventory } from '../../context/inventory-context'
import { useLocalization } from '../../context/localization-context'
import { useCompanies } from '../../context/company-context'
import { useContacts } from '../../context/contact-context'
import { useCustomers } from '../../context/customer-context'
import { useOrganization } from '../../context/organization-context'
import { useProducts } from '../../context/product-context'
import { useInternalReceipts } from '../../context/internal-receipt-context'
import { useSales } from '../../context/sales-context'
import type { SaleItemDraft } from '../../context/sales-context'
import { useUsers } from '../../context/user-context'
import { useWarehouses } from '../../context/warehouse-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import type { PaymentMethod, Product } from '../../../core/types'
import { isPhysicalProduct } from '../../../core/types/product'
import {
  translations,
  type TranslationKey,
} from '../../../core/localization/translations'
import { getCustomerDisplayName } from '../../../modules/crm/customers/customer-name'
import { PosCategories } from '../../../modules/sales/components/PosCategories'
import { PosCatalog } from '../../../modules/sales/components/PosCatalog'
import { filterPosCatalog, type PosCategoryFilter } from '../../../modules/sales/pos-catalog-filter'
import { formatMoney } from '../../../modules/sales/pos-format'
import { InternalReceiptView } from '../../../modules/sales/components/InternalReceiptView'
import { printInternalReceipt } from '../../../modules/sales/print-internal-receipt'
import { PosHeader } from '../../../modules/sales/components/PosHeader'
import { PosHistory } from '../../../modules/sales/components/PosHistory'
import { PosSuccess } from '../../../modules/sales/components/PosSuccess'
import { PosTicket } from '../../../modules/sales/components/PosTicket'
import { Modal } from '../../../shared/ui'
import { calcLineTotal, calcSaleTotals, getAvailableQuantity } from '../../../modules/sales/sale-stock'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { useAppPath } from '../useAppPath'
import {
  clearSalesWorkspaceDraft,
  readSalesWorkspaceDraft,
  saveSalesWorkspaceDraft,
} from '../sales-workspace-draft'
import {
  createSaleInvoiceForUser,
  downloadSaleInvoicePdf,
  findActiveSaleInvoiceForUser,
  generateSaleInvoicePdfForUser,
  logSaleInvoicePdfDiagnostics,
  openSaleInvoicePdf,
} from '../../../core/services'

type SalesPageProps = {
  onNavigate: (path: string) => void
}

type SuccessState = {
  saleId: string
  total: number
  change: number
  method: PaymentMethod
  receiptId: string
  receiptNumber: string
  customerName?: string
  paidAmount?: number
  remainingAmount?: number
}

function isTranslationKey(value: string): value is TranslationKey {
  return value in translations
}

function formatPosError(
  error: { code: string; availableQuantity?: number; details?: string },
  t: (key: TranslationKey) => string,
) {
  if (error.code === 'INSUFFICIENT_STOCK' || error.code === 'PRODUCT_NOT_AVAILABLE') {
    return `${t('saleInsufficientStock')} ${error.availableQuantity ?? 0}`
  }
  if (error.code === 'ORGANIZATION_PAYMENT_DETAILS_REQUIRED') {
    return error.details
      ? `${t('ORGANIZATION_PAYMENT_DETAILS_REQUIRED')}: ${error.details}`
      : t('ORGANIZATION_PAYMENT_DETAILS_REQUIRED')
  }
  if (isTranslationKey(error.code)) {
    return t(error.code)
  }
  return t('ACCESS_DENIED')
}

export function SalesPage({ onNavigate }: SalesPageProps) {
  const { t, locale } = useLocalization()
  const { navigate } = useAppPath()
  const { currentUser, hasFinancialAccess } = useAccess()
  const { organization, settings, modules } = useOrganization()
  const { warehouses } = useWarehouses()
  const { products } = useProducts()
  const { getStock } = useInventory()
  const { customers } = useCustomers()
  const { contacts } = useContacts()
  const { companies } = useCompanies()
  const { users } = useUsers()
  const { sales, createSale, updateSale, cancelSale, checkoutSale, checkoutOnCredit, getSale } = useSales()
  const { getById } = useInternalReceipts()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const searchRef = useRef<HTMLInputElement>(null)
  const restoredRef = useRef(false)
  const [view, setView] = useState<'sale' | 'history'>('sale')
  const [warehouseId, setWarehouseId] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<PosCategoryFilter>('all')
  const [cartOpen, setCartOpen] = useState(false)
  const [saleId, setSaleId] = useState<string | null>(null)
  const [items, setItems] = useState<SaleItemDraft[]>([])
  const [customerId, setCustomerId] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [tenderedInput, setTenderedInput] = useState('0')
  const [comment, setComment] = useState('')
  const [bankName, setBankName] = useState('')
  const [terminalName, setTerminalName] = useState('POS-01')
  const [accountReference, setAccountReference] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentComment, setPaymentComment] = useState('')
  const [methodDetail, setMethodDetail] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [invoiceHint, setInvoiceHint] = useState<string | null>(null)
  const [success, setSuccess] = useState<SuccessState | null>(null)
  const [priceByProductId, setPriceByProductId] = useState<Record<string, number>>({})

  const lockWarehouse = currentUser?.role === 'sales_employee'
  const warehousesEnabled = modules.warehouses === true
  const canEditPrice = hasFinancialAccess('sales.update')
  const canIssueDocs =
    modules.sales === true &&
    (hasFinancialAccess('sales.documents.create') ||
      hasFinancialAccess('financial_documents.manage'))
  const productById = Object.fromEntries(products.map((product) => [product.id, product]))
  const activeProducts = products.filter((product) => product.status === 'active')
  const posCategories = useMemo(() => {
    void version
    return persistence.productCategories
      .list(organization.id)
      .filter((category) => category.status === 'active')
      .sort((left, right) => left.name.localeCompare(right.name, 'ru'))
  }, [organization.id, persistence, version])
  const warehouseNameById = Object.fromEntries(
    warehouses.map((warehouse) => [warehouse.id, warehouse.name]),
  )
  const selectedCustomer = customers.find((customer) => customer.id === customerId)
  const customerOptions = customers
    .filter((customer) => customer.status === 'active')
    .map((customer) => ({
      id: customer.id,
      name: getCustomerDisplayName(customer, contacts, companies),
      taxId: customer.taxId ?? '',
    }))
  const totals = calcSaleTotals(
    items.map((item) => calcLineTotal(item.quantity, item.unitPrice, item.discount)),
    0,
  )
  const tendered = Number(tenderedInput)
  const payMethod = method === 'invoice' ? 'cash' : method
  const insufficientFunds =
    payMethod !== 'on_credit' &&
    items.length > 0 &&
    (!Number.isFinite(tendered) || tendered < totals.total)
  const canCompleteSale = hasFinancialAccess('sales.complete')
  const canCreatePayment = hasFinancialAccess('payments.create')
  const canOpenPay = Boolean(saleId) && items.length > 0 && canCompleteSale
  const canPay = canOpenPay && canCreatePayment
  const canSettleOnCredit = canOpenPay

  const activeInvoice = useMemo(() => {
    void version
    const lookupId = success?.saleId ?? saleId
    if (!lookupId || !currentUser) {
      return null
    }
    const listed = findActiveSaleInvoiceForUser(persistence, currentUser, lookupId)
    return listed.ok ? listed.value : null
  }, [currentUser, persistence, saleId, success?.saleId, version])

  useEffect(() => {
    if (!currentUser) {
      return
    }
    if (currentUser.role === 'sales_employee') {
      setWarehouseId(currentUser.warehouseId ?? '')
      return
    }
    if (!warehousesEnabled) {
      setWarehouseId('')
      return
    }
    setWarehouseId((current) =>
      current && warehouses.some((warehouse) => warehouse.id === current)
        ? current
        : (warehouses[0]?.id ?? ''),
    )
  }, [currentUser, warehouses, warehousesEnabled])

  useEffect(() => {
    setTenderedInput((current) => {
      if (payMethod === 'on_credit') {
        return '0'
      }
      if (payMethod !== 'cash') {
        return String(totals.total)
      }
      const value = Number(current)
      if (!Number.isFinite(value) || value === 0) {
        return String(totals.total)
      }
      return current
    })
  }, [payMethod, totals.total])

  useEffect(() => {
    if (view === 'sale' && !success) {
      searchRef.current?.focus()
    }
  }, [success, view])

  useEffect(() => {
    if (restoredRef.current) {
      return
    }
    restoredRef.current = true
    const draft = readSalesWorkspaceDraft()
    if (!draft) {
      return
    }
    if (draft.customerId) {
      setCustomerId(draft.customerId)
    }
    if (draft.warehouseId) {
      setWarehouseId(draft.warehouseId)
    }
    if (draft.saleId) {
      const record = getSale(draft.saleId)
      if (record && record.sale.status === 'draft') {
        setSaleId(record.sale.id)
        setItems(
          record.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
          })),
        )
        setCustomerId(draft.customerId || record.sale.customerId || '')
        setComment(record.sale.note ?? '')
      }
    }
    clearSalesWorkspaceDraft()
  }, [getSale])

  const getHasInventory = (productId: string) => {
    const product = productById[productId]
    if (!isPhysicalProduct(product)) {
      return true
    }
    return warehouseId ? Boolean(getStock(warehouseId, productId)) : false
  }

  const getAvailable = (productId: string) => {
    const product = productById[productId]
    if (!isPhysicalProduct(product)) {
      return Number.POSITIVE_INFINITY
    }
    return warehouseId ? getAvailableQuantity(getStock(warehouseId, productId)) : 0
  }

  const getPrice = (productId: string) => {
    const inCart = items.find((item) => item.productId === productId)
    if (inCart) {
      return inCart.unitPrice
    }
    if (priceByProductId[productId] != null) {
      return priceByProductId[productId]
    }
    return productById[productId]?.basePrice ?? 0
  }

  const persistCart = (
    nextItems: SaleItemDraft[],
    nextCustomerId = customerId,
    nextNote = comment,
  ): string | null => {
    const hasPhysical = nextItems.some((item) =>
      isPhysicalProduct(productById[item.productId]),
    )
    if (hasPhysical && !warehouseId) {
      setError(
        t(
          warehousesEnabled
            ? lockWarehouse
              ? 'USER_WAREHOUSE_REQUIRED'
              : 'saleWarehouseRequired'
            : 'productUnavailableWithoutWarehouse',
        ),
      )
      return null
    }

    const draft = {
      warehouseId: hasPhysical ? warehouseId : undefined,
      discount: 0,
      note: nextNote.trim() || undefined,
      invoiceDueDate: dueDate.trim() || undefined,
      customerId: nextCustomerId || undefined,
      items: nextItems,
    }

    if (!saleId) {
      if (nextItems.length === 0) {
        setItems([])
        return null
      }
      const created = createSale(draft)
      if (!created.ok) {
        setError(formatPosError(created.error, t))
        return null
      }
      const nextId = created.saleId ?? null
      setSaleId(nextId)
      setItems(nextItems)
      setError(null)
      return nextId
    }

    if (nextItems.length === 0) {
      cancelSale(saleId)
      setSaleId(null)
      setItems([])
      setError(null)
      return null
    }

    const updated = updateSale(saleId, draft)
    if (!updated.ok) {
      setError(formatPosError(updated.error, t))
      return null
    }
    setItems(nextItems)
    setError(null)
    return saleId
  }

  const resetSale = () => {
    if (saleId) {
      const current = sales.find((record) => record.sale.id === saleId)
      if (current?.sale.status === 'draft') {
        cancelSale(saleId)
      }
    }
    setSaleId(null)
    setItems([])
    setCustomerId('')
    setMethod('cash')
    setTenderedInput('0')
    setComment('')
    setBankName('')
    setTerminalName('POS-01')
    setAccountReference('')
    setPaymentReference('')
    setPaymentComment('')
    setMethodDetail('')
    setDueDate('')
    setError(null)
    setInvoiceHint(null)
    setSuccess(null)
    setSearch('')
    clearSalesWorkspaceDraft()
  }

  const handleWarehouseChange = (nextWarehouseId: string) => {
    if (nextWarehouseId === warehouseId) {
      return
    }
    resetSale()
    setWarehouseId(nextWarehouseId)
  }

  const handleAdd = (product: Product) => {
    if (isPhysicalProduct(product) && !warehousesEnabled) {
      setError(t('productUnavailableWithoutWarehouse'))
      return
    }
    const available = getAvailable(product.id)
    const current = items.find((item) => item.productId === product.id)
    const nextQuantity = (current?.quantity ?? 0) + 1
    if (isPhysicalProduct(product) && (available <= 0 || nextQuantity > available)) {
      setError(`${t('saleInsufficientStock')} ${available}`)
      return
    }
    const unitPrice = current?.unitPrice ?? getPrice(product.id)
    const nextItems = current
      ? items.map((item) =>
          item.productId === product.id ? { ...item, quantity: nextQuantity } : item,
        )
      : [...items, { productId: product.id, quantity: 1, unitPrice, discount: 0 }]
    persistCart(nextItems)
  }

  const openInvoiceDocument = async (
    mode: 'print' | 'download',
    invoiceId = activeInvoice?.id,
  ) => {
    if (!currentUser) {
      setError(t('CURRENT_USER_REQUIRED'))
      return
    }
    if (!invoiceId) {
      setError(t('INVOICE_NOT_FOUND'))
      return
    }
    setError(null)
    setInvoiceHint(null)
    setHistoryError(null)
    try {
      const pdf = await generateSaleInvoicePdfForUser(
        persistence,
        currentUser,
        invoiceId,
      )
      if (!pdf.ok) {
        logSaleInvoicePdfDiagnostics('SalesPage.openInvoiceDocument', pdf.error)
        setError(formatPosError(pdf.error, t))
        return
      }
      if (mode === 'download') {
        downloadSaleInvoicePdf(pdf.value.filename, pdf.value.bytes)
        return
      }
      openSaleInvoicePdf(pdf.value.bytes)
    } catch (error) {
      logSaleInvoicePdfDiagnostics('SalesPage.openInvoiceDocument', error)
      setError(t('INVOICE_PDF_FAILED'))
    }
  }

  const handleIssueInvoice = () => {
    if (items.length === 0) {
      return
    }
    if (!customerId) {
      setInvoiceHint(t('invoiceCustomerRequired'))
      return
    }
    if (!canIssueDocs) {
      setError(t('ACCESS_DENIED'))
      return
    }
    const persistedId = persistCart(items, customerId)
    if (!persistedId || !currentUser) {
      return
    }
    const existing = findActiveSaleInvoiceForUser(persistence, currentUser, persistedId)
    if (existing.ok && existing.value) {
      setInvoiceHint(null)
      setError(null)
      return
    }
    const created = createSaleInvoiceForUser(persistence, currentUser, {
      saleId: persistedId,
    })
    if (!created.ok) {
      if (created.error.code === 'INVOICE_ALREADY_ISSUED') {
        setInvoiceHint(null)
        setError(null)
        return
      }
      if (created.error.code === 'CUSTOMER_TAX_ID_REQUIRED') {
        setInvoiceHint(t('CUSTOMER_TAX_ID_REQUIRED'))
        setError(null)
        return
      }
      setError(formatPosError(created.error, t))
      return
    }
    setInvoiceHint(t('invoiceIssued'))
    setError(null)
  }

  const handleCreateCustomer = () => {
    const persistedId = persistCart(items, customerId)
    saveSalesWorkspaceDraft({
      saleId: persistedId ?? saleId ?? '',
      warehouseId,
      customerId,
    })
    navigate('/customers?returnTo=/sales')
  }

  const handleOpenCustomer = () => {
    if (!customerId) {
      handleCreateCustomer()
      return
    }
    const persistedId = persistCart(items, customerId)
    saveSalesWorkspaceDraft({
      saleId: persistedId ?? saleId ?? '',
      warehouseId,
      customerId,
    })
    navigate(`/customers?returnTo=/sales&customerId=${encodeURIComponent(customerId)}`)
  }

  const handlePay = () => {
    if (!saleId) {
      return
    }
    if (payMethod === 'on_credit') {
      if (!customerId) {
        setInvoiceHint(t('saleOnCreditCustomerRequired'))
        setError(t('saleOnCreditCustomerRequired'))
        return
      }
      persistCart(items, customerId)
      const targetId = saleId
      const result = checkoutOnCredit(targetId, {
        dueDate: dueDate.trim() || undefined,
        comment: paymentComment.trim() || comment.trim() || undefined,
      })
      if (!result.ok) {
        setError(formatPosError(result.error, t))
        return
      }
      setSuccess({
        saleId: result.value.saleId,
        total: result.value.total,
        change: 0,
        method: 'on_credit',
        receiptId: '',
        receiptNumber: '',
        customerName:
          customerOptions.find((item) => item.id === result.value.customerId)?.name ?? '',
        paidAmount: result.value.paidAmount,
        remainingAmount: result.value.remainingAmount,
      })
      setSaleId(null)
      setItems([])
      setError(null)
      setInvoiceHint(null)
      return
    }
    const result = checkoutSale(saleId, {
      amount: tendered,
      method: payMethod,
      bankName: bankName || undefined,
      terminalName: payMethod === 'card' ? terminalName || undefined : undefined,
      accountReference:
        payMethod === 'bank_transfer' ? accountReference || undefined : undefined,
      paymentReference: paymentReference || undefined,
      paymentComment: paymentComment || undefined,
      methodDetail: payMethod === 'other' ? methodDetail || undefined : undefined,
    })
    if (!result.ok) {
      setError(formatPosError(result.error, t))
      return
    }
    setSuccess({
      saleId: result.value.saleId,
      total: totals.total,
      change: result.value.change,
      method: payMethod,
      receiptId: result.value.receiptId,
      receiptNumber: result.value.receiptNumber,
    })
    setSaleId(null)
    setItems([])
    setError(null)
  }

  const filteredProducts = filterPosCatalog(activeProducts, search, categoryId)

  if (!currentUser) {
    return <AuthRequiredState />
  }

  const canIssueInvoice =
    canIssueDocs && items.length > 0 && Boolean(customerId) && !activeInvoice

  return (
    <section className="workspace-page pos-page">
      <PosHeader
        companyName={organization.legalName?.trim() || organization.name}
        currentUser={currentUser}
        warehouses={warehouses}
        warehouseId={warehouseId}
        lockWarehouse={lockWarehouse}
        warehousesEnabled={warehousesEnabled}
        view={view}
        customerId={customerId}
        customers={customerOptions}
        selectedCustomer={selectedCustomer}
        onWarehouseChange={handleWarehouseChange}
        onViewChange={setView}
        onCustomerChange={(nextId) => {
          setCustomerId(nextId)
          if (items.length > 0) {
            persistCart(items, nextId)
          }
        }}
        onCreateCustomer={handleCreateCustomer}
      />

      {view === 'history' ? (
        <>
          {historyError || error ? (
            <p className="pos-ticket__error">{historyError || error}</p>
          ) : null}
          <PosHistory
            records={sales}
            warehouseNameById={warehouseNameById}
            productById={productById}
            users={users}
            locale={locale}
            onOpenSale={(id) => onNavigate(`/sales/${id}`)}
          />
        </>
      ) : success ? (
        <PosSuccess
          saleId={success.saleId}
          total={success.total}
          change={success.change}
          method={success.method}
          locale={locale}
          currency={settings.currency}
          receiptNumber={success.receiptNumber}
          customerName={success.customerName}
          paidAmount={success.paidAmount}
          remainingAmount={success.remainingAmount}
          invoice={activeInvoice}
          onOpenInvoice={() => {
            if (activeInvoice) {
              void openInvoiceDocument('print', activeInvoice.id)
            }
          }}
          onOpenReceipt={() => onNavigate(`/sales/${success.saleId}?receipt=1`)}
          onPrintReceipt={() => {
            setReceiptId(success.receiptId)
            window.setTimeout(() => printInternalReceipt(), 50)
          }}
          onOpenSale={() => onNavigate(`/sales/${success.saleId}`)}
          onOpenDebt={() => onNavigate('/finance?tab=debts')}
          onNewSale={resetSale}
        />
      ) : (
        <div className="pos-workspace">
          <PosCategories
            categories={posCategories}
            selected={categoryId}
            onSelect={setCategoryId}
          />
          <PosCatalog
            products={filteredProducts}
            totalCount={activeProducts.length}
            locale={locale}
            currency={settings.currency}
            catalogEmpty={activeProducts.length === 0}
            warehousesEnabled={warehousesEnabled}
            search={search}
            searchRef={searchRef}
            getAvailable={getAvailable}
            getHasInventory={getHasInventory}
            getPrice={getPrice}
            onSearchChange={setSearch}
            onSearchEnter={() => {
              if (filteredProducts.length === 1) {
                handleAdd(filteredProducts[0])
              }
            }}
            onAdd={handleAdd}
          />
          <button
            type="button"
            className="pos-cart-fab"
            onClick={() => setCartOpen(true)}
            aria-label={`${t('posOpenCart')}, ${items.length} ${t('posItemCount').toLowerCase()}, ${formatMoney(totals.total, locale, settings.currency)}`}
            title={`${t('posOpenCart')} · ${formatMoney(totals.total, locale, settings.currency)}`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 1.9-1.4L22 8H6" />
              <circle cx="10" cy="20" r="1.3" />
              <circle cx="18" cy="20" r="1.3" />
            </svg>
            <span className="pos-cart-fab__count">{items.length}</span>
          </button>
          <div
            className={cartOpen ? 'pos-ticket-shell is-open' : 'pos-ticket-shell'}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setCartOpen(false)
              }
            }}
          >
          <PosTicket
            items={items}
            products={activeProducts}
            customerName={
              customerOptions.find((item) => item.id === customerId)?.name ?? ''
            }
            customerTaxId={selectedCustomer?.taxId ?? ''}
            method={payMethod}
            tenderedInput={tenderedInput}
            comment={comment}
            bankName={bankName}
            terminalName={terminalName}
            accountReference={accountReference}
            paymentReference={paymentReference}
            paymentComment={paymentComment}
            methodDetail={methodDetail}
            locale={locale}
            currency={settings.currency}
            error={error}
            invoiceHint={invoiceHint}
            canPay={canOpenPay}
            canConfirmPayment={canPay}
            canSettleOnCredit={canSettleOnCredit}
            canIssueInvoice={canIssueInvoice}
            canManageInvoice={canIssueDocs}
            insufficientFunds={insufficientFunds}
            hasCustomer={Boolean(customerId)}
            dueDate={dueDate}
            invoice={activeInvoice}
            getAvailable={getAvailable}
            onMethodChange={setMethod}
            onTenderedChange={setTenderedInput}
            onCommentChange={(value) => {
              setComment(value)
              if (items.length > 0) {
                persistCart(items, customerId, value)
              }
            }}
            onDueDateChange={setDueDate}
            onBankNameChange={setBankName}
            onTerminalNameChange={setTerminalName}
            onAccountReferenceChange={setAccountReference}
            onPaymentReferenceChange={setPaymentReference}
            onPaymentCommentChange={setPaymentComment}
            onMethodDetailChange={setMethodDetail}
            onQuantityChange={(productId, quantity) => {
              if (quantity <= 0) {
                persistCart(items.filter((item) => item.productId !== productId))
                return
              }
              const available = getAvailable(productId)
              if (isPhysicalProduct(productById[productId]) && quantity > available) {
                setError(`${t('saleInsufficientStock')} ${available}`)
                return
              }
              persistCart(
                items.map((item) =>
                  item.productId === productId ? { ...item, quantity } : item,
                ),
              )
            }}
            onRemove={(productId) =>
              persistCart(items.filter((item) => item.productId !== productId))
            }
            onPriceChange={(productId, unitPrice) => {
              if (!canEditPrice || !Number.isFinite(unitPrice) || unitPrice < 0) {
                return
              }
              setPriceByProductId((current) => ({ ...current, [productId]: unitPrice }))
              persistCart(
                items.map((item) =>
                  item.productId === productId ? { ...item, unitPrice } : item,
                ),
              )
            }}
            onDiscountChange={(productId, discount) => {
              if (!canEditPrice || !Number.isFinite(discount) || discount < 0) {
                return
              }
              const line = items.find((item) => item.productId === productId)
              if (!line) {
                return
              }
              persistCart(
                items.map((item) =>
                  item.productId === productId
                    ? { ...item, discount: Math.min(discount, line.quantity * line.unitPrice) }
                    : item,
                ),
              )
            }}
            canEditPrice={canEditPrice}
            onPay={handlePay}
            onIssueInvoice={handleIssueInvoice}
            onOpenInvoice={() => {
              if (activeInvoice) {
                void openInvoiceDocument('print', activeInvoice.id)
              }
            }}
            onDownloadInvoice={() => {
              if (activeInvoice) {
                void openInvoiceDocument('download', activeInvoice.id)
              }
            }}
            onOpenCustomer={handleOpenCustomer}
            onCloseCart={cartOpen ? () => setCartOpen(false) : undefined}
          />
          </div>
        </div>
      )}
      {receiptId && getById(receiptId) ? (
        <Modal title={t('internalReceipt')} onClose={() => setReceiptId(null)}>
          <InternalReceiptView
            receipt={getById(receiptId)!}
            locale={locale}
            onPrint={printInternalReceipt}
          />
        </Modal>
      ) : null}
    </section>
  )
}
