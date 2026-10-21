import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useCompanies } from '../../app/context/company-context'
import { useContacts } from '../../app/context/contact-context'
import { useCustomers } from '../../app/context/customer-context'
import { useLocalization } from '../../app/context/localization-context'
import { useOrganization } from '../../app/context/organization-context'
import { useProducts } from '../../app/context/product-context'
import { useRental } from '../../app/context/rental-context'
import { useWarehouses } from '../../app/context/warehouse-context'
import type { DomainErrorCode, Id, ProductCategory } from '../../core/types'
import { rentalCustomerPhone } from '../../core/services'
import { getCustomerDisplayName } from '../crm/customers/customer-name'
import { ProductImageThumb } from '../inventory/components/ProductImageThumb'
import { formatMoney } from '../sales/pos-format'
import { Button } from '../../shared/ui'
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from './rental-datetime'
import { rentalWhatsAppHref } from './rental-status'

type RentalBookingFormProps = {
  categories: ProductCategory[]
  onCreated: (bookingId: Id) => void
  onCancel: () => void
  onEditCustomer: () => void
}

type SubmitError =
  | 'customer'
  | 'phone'
  | 'interval'
  | 'product'
  | 'noFree'
  | 'overLimit'
  | 'generic'
  | null

export function RentalBookingForm({
  categories,
  onCreated,
  onCancel,
  onEditCustomer,
}: RentalBookingFormProps) {
  const { t, locale } = useLocalization()
  const { settings } = useOrganization()
  const { customers } = useCustomers()
  const { contacts, getContact } = useContacts()
  const { companies } = useCompanies()
  const { products } = useProducts()
  const { warehouses } = useWarehouses()
  const { createBooking, createPersonCustomer, getAvailability } = useRental()
  const [customerId, setCustomerId] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [customerFormError, setCustomerFormError] = useState<
    'denied' | 'duplicate' | 'invalid' | 'phone' | null
  >(null)
  const [duplicateNotice, setDuplicateNotice] = useState(false)
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [startAt, setStartAt] = useState(
    toDatetimeLocalValue(new Date().toISOString()),
  )
  const [endAt, setEndAt] = useState(
    toDatetimeLocalValue(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()),
  )
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [subtotal, setSubtotal] = useState('0')
  const [discount, setDiscount] = useState('0')
  const [prepayment, setPrepayment] = useState('0')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<SubmitError>(null)

  const selectedCustomer = customers.find((item) => item.id === customerId)
  const phone = selectedCustomer
    ? rentalCustomerPhone(selectedCustomer, {
        getContact: (id) => getContact(id),
        getCompany: (id) => companies.find((company) => company.id === id),
      })
    : undefined
  const whatsapp = phone ? rentalWhatsAppHref(phone) : undefined

  const startIso = fromDatetimeLocalValue(startAt)
  const endIso = fromDatetimeLocalValue(endAt)
  const intervalValid = Boolean(startIso && endIso && startIso < endIso)

  useEffect(() => {
    if (!warehouseId && warehouses[0]) {
      setWarehouseId(warehouses[0].id)
    }
  }, [warehouseId, warehouses])

  const selectedProduct = products.find((item) => item.id === productId)
  const availability = useMemo(() => {
    if (!productId || !warehouseId || !intervalValid || !startIso || !endIso) {
      return undefined
    }
    return getAvailability({
      productId,
      warehouseId,
      startAt: startIso,
      endAt: endIso,
    })
  }, [endIso, getAvailability, intervalValid, productId, startIso, warehouseId])

  const availableQty = availability?.available ?? 0

  useEffect(() => {
    if (!selectedProduct) {
      return
    }
    setSubtotal(String(selectedProduct.basePrice * quantity))
  }, [quantity, selectedProduct])

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase()
    if (!query) {
      return customers
    }
    return customers.filter((customer) => {
      const name = getCustomerDisplayName(customer, contacts, companies).toLowerCase()
      const customerPhone =
        rentalCustomerPhone(customer, {
          getContact: (id) => getContact(id),
          getCompany: (id) => companies.find((company) => company.id === id),
        }) ?? ''
      return name.includes(query) || customerPhone.toLowerCase().includes(query)
    })
  }, [companies, contacts, customerQuery, customers, getContact])

  const categoryName = (categoryId?: string) =>
    categories.find((category) => category.id === categoryId)?.name ?? '—'

  const total = Math.max(0, Number(subtotal) - Number(discount))

  const selectCustomer = (id: Id) => {
    setCustomerId(id)
    setCustomerQuery('')
    setAddingCustomer(false)
    setCustomerFormError(null)
    setDuplicateNotice(false)
    setError(null)
  }

  const handleCreateCustomer = () => {
    const created = createPersonCustomer({
      fullName: newName,
      phone: newPhone,
    })
    if (typeof created === 'string') {
      const code: DomainErrorCode = created
      setCustomerFormError(
        code === 'ACCESS_DENIED' || code === 'MODULE_NOT_ENABLED'
          ? 'denied'
          : code === 'CUSTOMER_PHONE_REQUIRED'
            ? 'phone'
            : 'invalid',
      )
      return
    }
    if (created.status === 'duplicate') {
      setCustomerId(created.customer.id)
      setCustomerQuery('')
      setAddingCustomer(false)
      setCustomerFormError('duplicate')
      setDuplicateNotice(true)
      setError(null)
      return
    }
    setNewName('')
    setNewPhone('')
    setDuplicateNotice(false)
    selectCustomer(created.customer.id)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!customerId) {
      setError('customer')
      return
    }
    if (!phone) {
      setError('phone')
      return
    }
    if (!intervalValid) {
      setError('interval')
      return
    }
    if (!productId) {
      setError('product')
      return
    }
    if (availableQty <= 0) {
      setError('noFree')
      return
    }
    if (quantity > availableQty) {
      setError('overLimit')
      return
    }

    const created = createBooking({
      customerId,
      warehouseId,
      startAt: startIso,
      endAt: endIso,
      items: [{ productId, quantity }],
      subtotal: Number(subtotal) || 0,
      discount: Number(discount) || 0,
      total,
      prepayment: Number(prepayment) || 0,
      comment,
    })

    if (!created) {
      setError('generic')
      return
    }

    onCreated(created.id)
  }

  return (
    <form className="warehouse-form settings-section rental-booking-form" onSubmit={handleSubmit}>
      <div className="meracle-form-group">
        <p className="meracle-form-group__title">{t('navCustomers')}</p>
      {selectedCustomer ? (
        <div className="rental-customer-card">
          <div>
            <p>{getCustomerDisplayName(selectedCustomer, contacts, companies)}</p>
            <p className="workspace-muted">
              {t('phone')}: {phone ?? t('rentalPhoneMissing')}
            </p>
            {duplicateNotice ? (
              <p className="warehouse-field__error">{t('rentalCustomerPhoneExists')}</p>
            ) : null}
          </div>
          <div className="rental-customer-card__actions">
            {phone ? <a href={`tel:${phone}`}>{t('rentalCall')}</a> : null}
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noreferrer">
                {t('rentalWhatsapp')}
              </a>
            ) : null}
            <Button type="button" onClick={() => setCustomerId('')}>
              {t('rentalChangeCustomer')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <label className="warehouse-field">
            <span className="settings-field__label">{t('navCustomers')}</span>
            <input
              className="warehouse-input"
              type="search"
              value={customerQuery}
              placeholder={t('rentalSearchCustomer')}
              onChange={(event) => setCustomerQuery(event.target.value)}
            />
            <select
              className="warehouse-input"
              value={customerId}
              onChange={(event) => selectCustomer(event.target.value)}
            >
              <option value="">{t('dealPartyNone')}</option>
              {filteredCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {getCustomerDisplayName(customer, contacts, companies)}
                </option>
              ))}
            </select>
          </label>
          {addingCustomer ? (
              <div className="rental-new-customer">
                <p className="settings-field__label">{t('rentalNewCustomer')}</p>
                <label className="warehouse-field">
                  <span className="settings-field__label">{t('rentalCustomerFullName')}</span>
                  <input
                    className="warehouse-input"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                  />
                </label>
                <label className="warehouse-field">
                  <span className="settings-field__label">{t('phone')}</span>
                  <input
                    className="warehouse-input"
                    value={newPhone}
                    onChange={(event) => setNewPhone(event.target.value)}
                  />
                </label>
                {customerFormError === 'denied' ? (
                  <p className="warehouse-field__error">{t('rentalCustomerCreateDenied')}</p>
                ) : null}
                {customerFormError === 'duplicate' ? (
                  <p className="warehouse-field__error">{t('rentalCustomerPhoneExists')}</p>
                ) : null}
                {customerFormError === 'phone' ? (
                  <p className="warehouse-field__error">{t('rentalPhoneRequiredForBooking')}</p>
                ) : null}
                {customerFormError === 'invalid' ? (
                  <p className="warehouse-field__error">{t('rentalCustomerCreateInvalid')}</p>
                ) : null}
                <div className="modal__actions">
                  <Button
                    type="button"
                    onClick={() => {
                      setAddingCustomer(false)
                      setCustomerFormError(null)
                    }}
                  >
                    {t('cancel')}
                  </Button>
                  <Button variant="primary" type="button" onClick={handleCreateCustomer}>
                    {t('rentalSaveCustomer')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" onClick={() => setAddingCustomer(true)}>
                + {t('rentalAddCustomer')}
              </Button>
            )}
        </>
      )}

      {selectedCustomer && !phone ? (
        <Button type="button" onClick={onEditCustomer}>
          {t('rentalFillPhone')}
        </Button>
      ) : null}
      </div>

      <div className="meracle-form-group">
        <p className="meracle-form-group__title">{t('rentalPeriod')}</p>
      <label className="warehouse-field">
        <span className="settings-field__label">{t('rentalIssueAt')}</span>
        <input
          className="warehouse-input"
          type="datetime-local"
          value={startAt}
          onChange={(event) => setStartAt(event.target.value)}
        />
      </label>
      <label className="warehouse-field">
        <span className="settings-field__label">{t('rentalReturnAt')}</span>
        <input
          className="warehouse-input"
          type="datetime-local"
          value={endAt}
          onChange={(event) => setEndAt(event.target.value)}
        />
      </label>

      {warehouses.length > 1 ? (
        <label className="warehouse-field">
          <span className="settings-field__label">{t('navWarehouses')}</span>
          <select
            className="warehouse-input"
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
          >
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {warehouses.length === 0 ? (
        <p className="warehouse-field__error">{t('rentalNoWarehouse')}</p>
      ) : null}
      </div>

      <div className="meracle-form-group">
        <p className="meracle-form-group__title">{t('navNomenclature')}</p>
      <div className="rental-product-picker">
        {products
          .filter((product) => product.status === 'active')
          .map((product) => {
            const productAvailability =
              warehouseId && intervalValid && startIso && endIso
                ? getAvailability({
                    productId: product.id,
                    warehouseId,
                    startAt: startIso,
                    endAt: endIso,
                  })
                : undefined
            return (
              <button
                key={product.id}
                type="button"
                className={
                  productId === product.id
                    ? 'rental-product-picker__item rental-product-picker__item--on'
                    : 'rental-product-picker__item'
                }
                onClick={() => {
                  setProductId(product.id)
                  setQuantity(1)
                  setError(null)
                }}
              >
                <ProductImageThumb imageUrl={product.imageUrl} name={product.name} />
                <span>{product.name}</span>
                <span className="workspace-muted">{product.sku}</span>
                <span className="workspace-muted">
                  {formatMoney(product.basePrice, locale, settings.currency)}
                </span>
                <span className="workspace-muted">{categoryName(product.categoryId)}</span>
                <span>
                  {t('rentalAvailable')}: {productAvailability?.available ?? '—'} {t('rentalPcs')}
                </span>
              </button>
            )
          })}
      </div>

      {productId && !intervalValid ? (
        <p className="warehouse-field__error">{t('rentalIntervalInvalid')}</p>
      ) : null}
      {productId && intervalValid && availableQty <= 0 ? (
        <p className="warehouse-field__error">{t('rentalNoQuantityAvailable')}</p>
      ) : null}

      <label className="warehouse-field">
        <span className="settings-field__label">{t('rentalQuantity')}</span>
        <div className="rental-qty">
          <Button
            type="button"
            disabled={quantity <= 1}
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
          >
            −
          </Button>
          <input
            className="warehouse-input"
            type="number"
            min="1"
            max={Math.max(1, availableQty)}
            value={quantity}
            onChange={(event) => {
              const next = Number(event.target.value)
              setQuantity(Number.isFinite(next) && next > 0 ? Math.floor(next) : 1)
            }}
          />
          <Button
            type="button"
            disabled={availableQty <= 0 || quantity >= availableQty}
            onClick={() =>
              setQuantity((value) => Math.min(availableQty || value, value + 1))
            }
          >
            +
          </Button>
        </div>
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('rentalSubtotal')}</span>
        <input
          className="warehouse-input"
          type="number"
          min="0"
          value={subtotal}
          onChange={(event) => setSubtotal(event.target.value)}
        />
      </label>
      <label className="warehouse-field">
        <span className="settings-field__label">{t('rentalDiscount')}</span>
        <input
          className="warehouse-input"
          type="number"
          min="0"
          value={discount}
          onChange={(event) => setDiscount(event.target.value)}
        />
      </label>
      <p className="workspace-muted">
        {t('rentalTotal')}: {total}
      </p>
      <label className="warehouse-field">
        <span className="settings-field__label">{t('rentalPrepayment')}</span>
        <input
          className="warehouse-input"
          type="number"
          min="0"
          value={prepayment}
          onChange={(event) => setPrepayment(event.target.value)}
        />
      </label>
      <label className="warehouse-field">
        <span className="settings-field__label">{t('rentalComment')}</span>
        <textarea
          className="warehouse-input"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>
      </div>

      {error === 'customer' ? (
        <p className="warehouse-field__error">{t('rentalCustomerRequired')}</p>
      ) : null}
      {error === 'phone' ? (
        <p className="warehouse-field__error">{t('rentalPhoneRequiredForBooking')}</p>
      ) : null}
      {error === 'interval' ? (
        <p className="warehouse-field__error">{t('rentalIntervalInvalid')}</p>
      ) : null}
      {error === 'product' ? (
        <p className="warehouse-field__error">{t('rentalProductRequired')}</p>
      ) : null}
      {error === 'noFree' ? (
        <p className="warehouse-field__error">{t('rentalNoQuantityAvailable')}</p>
      ) : null}
      {error === 'overLimit' ? (
        <p className="warehouse-field__error">
          {t('rentalAvailableOnly')} {availableQty} {t('rentalPcs')}
        </p>
      ) : null}
      {error === 'generic' ? (
        <p className="warehouse-field__error">{t('rentalBookingInvalid')}</p>
      ) : null}

      <div className="modal__actions">
        <Button
          variant="primary"
          type="submit"
          disabled={Boolean(productId && intervalValid && availableQty <= 0)}
        >
          {t('rentalReserve')}
        </Button>
        <Button type="button" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  )
}
