import { useEffect, useState, type FormEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import type { SaleReturnDraft } from '../../../app/context/sale-return-context'
import type { SaleRecord } from '../../../app/context/sales-context'

type ReturnableSaleItem = {
  saleItemId: string
  productName: string
  soldQuantity: number
  returnedQuantity: number
  returnableQuantity: number
  unitPrice: number
}

type SaleReturnFormProps = {
  sales: SaleRecord[]
  initialSaleId?: string
  getItemOptions: (saleId: string) => ReturnableSaleItem[]
  onSubmit: (draft: SaleReturnDraft) => boolean
}

export function SaleReturnForm({
  sales,
  initialSaleId = '',
  getItemOptions,
  onSubmit,
}: SaleReturnFormProps) {
  const { t } = useLocalization()
  const [saleId, setSaleId] = useState(initialSaleId)
  const [saleItemId, setSaleItemId] = useState('')
  const [quantityInput, setQuantityInput] = useState('')
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSaleId(initialSaleId)
    setSaleItemId('')
  }, [initialSaleId])

  const itemOptions = saleId ? getItemOptions(saleId) : []
  const selectedItem = itemOptions.find((item) => item.saleItemId === saleItemId)
  const returnTotal =
    selectedItem && Number.isFinite(Number(quantityInput))
      ? Number(quantityInput) * selectedItem.unitPrice
      : 0

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!saleId) {
      setError(t('selectSale'))
      return
    }

    if (!saleItemId || !selectedItem) {
      setError(t('selectProduct'))
      return
    }

    const quantity = Number(quantityInput)

    if (quantityInput.trim() === '' || Number.isNaN(quantity)) {
      setError(t('quantityMustBeNumber'))
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError(t('returnInvalidQuantity'))
      return
    }

    if (quantity > selectedItem.returnableQuantity) {
      setError(t('returnInvalidQuantity'))
      return
    }

    if (!reason.trim()) {
      setError(t('returnReasonRequired'))
      return
    }

    const created = onSubmit({
      saleId,
      reason: reason.trim(),
      note: comment.trim() || undefined,
      items: [{ saleItemId, quantity }],
    })

    if (!created) {
      setError(t('returnInvalidQuantity'))
      return
    }

    setSaleItemId('')
    setQuantityInput('')
    setError(null)
  }

  if (sales.length === 0) {
    return (
      <div className="warehouse-empty settings-section">
        <p>{t('noSalesForReturn')}</p>
      </div>
    )
  }

  return (
    <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
      <h2>{t('createReturn')}</h2>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('returnSale')}</span>
        <select
          className="warehouse-input"
          name="saleId"
          value={saleId}
          onChange={(event) => {
            setSaleId(event.target.value)
            setSaleItemId('')
            setQuantityInput('')
            setError(null)
          }}
        >
          <option value="">{t('selectSale')}</option>
          {sales.map((record) => (
            <option key={record.sale.id} value={record.sale.id}>
              {record.sale.total} {record.sale.currency}
            </option>
          ))}
        </select>
      </label>

      {saleId ? (
        itemOptions.filter((item) => item.returnableQuantity > 0).length === 0 ? (
          <p className="warehouse-field__error">{t('noReturnableItems')}</p>
        ) : (
          <label className="warehouse-field">
            <span className="settings-field__label">{t('returnProduct')}</span>
            <select
              className="warehouse-input"
              name="saleItemId"
              value={saleItemId}
              onChange={(event) => {
                setSaleItemId(event.target.value)
                setQuantityInput('')
                setError(null)
              }}
            >
              <option value="">{t('selectProduct')}</option>
              {itemOptions
                .filter((item) => item.returnableQuantity > 0)
                .map((item) => (
                  <option key={item.saleItemId} value={item.saleItemId}>
                    {item.productName}
                  </option>
                ))}
            </select>
          </label>
        )
      ) : null}

      {selectedItem ? (
        <>
          <p className="settings-field__value">
            {t('soldQuantity')}: {selectedItem.soldQuantity}
          </p>
          <p className="settings-field__value">
            {t('alreadyReturned')}: {selectedItem.returnedQuantity}
          </p>
          <p className="settings-field__value">
            {t('returnableQuantity')}: {selectedItem.returnableQuantity}
          </p>
          <label className="warehouse-field">
            <span className="settings-field__label">{t('returnQuantity')}</span>
            <input
              className="warehouse-input"
              type="number"
              name="quantity"
              min="0"
              step="any"
              value={quantityInput}
              disabled={selectedItem.returnableQuantity <= 0}
              onChange={(event) => {
                setQuantityInput(event.target.value)
                setError(null)
              }}
            />
          </label>
          <div className="warehouse-field">
            <span className="settings-field__label">{t('returnTotal')}</span>
            <span className="settings-field__value">{returnTotal}</span>
          </div>
        </>
      ) : null}

      <label className="warehouse-field">
        <span className="settings-field__label">{t('returnReason')}</span>
        <input
          className="warehouse-input"
          value={reason}
          required
          onChange={(event) => {
            setReason(event.target.value)
            setError(null)
          }}
        />
      </label>
      <label className="warehouse-field">
        <span className="settings-field__label">{t('returnComment')}</span>
        <textarea
          className="warehouse-input"
          rows={2}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>

      {error ? <p className="warehouse-field__error">{error}</p> : null}

      <div className="warehouse-form__actions">
        <button
          type="submit"
          className="module-switch module-switch--on"
          disabled={
            !saleId ||
            !selectedItem ||
            selectedItem.returnableQuantity <= 0 ||
            !reason.trim()
          }
        >
          {t('createReturn')}
        </button>
      </div>
    </form>
  )
}
