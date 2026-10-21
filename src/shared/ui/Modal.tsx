import type { ReactNode } from 'react'
import { useLocalization } from '../../app/context/localization-context'

type ModalProps = {
  title: string
  children: ReactNode
  onClose: () => void
  size?: 'confirm' | 'form' | 'wide'
}

export function Modal({ title, children, onClose, size = 'form' }: ModalProps) {
  const { t } = useLocalization()
  const sizeClass = size === 'form' ? '' : ` modal--${size}`
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`modal${sizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button type="button" className="btn btn--ghost modal__close" onClick={onClose} aria-label={t('cancel')}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
