import { useRef, useState, type ChangeEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import {
  parseProductImageUrl,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MIME_TYPES,
} from '../../../core/types'
import { Button } from '../../../shared/ui'
import { ProductImageThumb } from './ProductImageThumb'

type ProductImageFieldProps = {
  imageUrl?: string
  onChange: (imageUrl: string | undefined) => void
}

const ACCEPT = PRODUCT_IMAGE_MIME_TYPES.join(',')

export function ProductImageField({ imageUrl, onChange }: ProductImageFieldProps) {
  const { t } = useLocalization()
  const inputRef = useRef<HTMLInputElement>(null)
  const [errorKey, setErrorKey] = useState<'productPhotoInvalidType' | 'productPhotoTooLarge' | null>(
    null,
  )

  const openPicker = () => {
    inputRef.current?.click()
  }

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
      setErrorKey('productPhotoTooLarge')
      return
    }

    if (
      file.type &&
      !(PRODUCT_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)
    ) {
      setErrorKey('productPhotoInvalidType')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseProductImageUrl(reader.result)
      if (!parsed) {
        setErrorKey('productPhotoInvalidType')
        return
      }
      setErrorKey(null)
      onChange(parsed)
    }
    reader.onerror = () => {
      setErrorKey('productPhotoInvalidType')
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="product-photo-field">
      <span className="settings-field__label">{t('productPhoto')}</span>
      <div className="product-photo-field__box">
        <ProductImageThumb imageUrl={imageUrl} name={t('productPhoto')} size="md" />
        <div className="product-photo-field__actions">
          <input
            ref={inputRef}
            className="product-photo-field__input"
            type="file"
            accept={ACCEPT}
            onChange={handleFile}
          />
          {imageUrl ? (
            <>
              <Button type="button" onClick={openPicker}>
                {t('productPhotoChange')}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setErrorKey(null)
                  onChange(undefined)
                }}
              >
                {t('productPhotoRemove')}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={openPicker}>
              {t('productPhotoChoose')}
            </Button>
          )}
        </div>
        {!imageUrl ? (
          <p className="product-photo-field__hint">{t('productPhotoAdd')}</p>
        ) : null}
      </div>
      {errorKey ? (
        <span className="warehouse-field__error">{t(errorKey)}</span>
      ) : null}
    </div>
  )
}
